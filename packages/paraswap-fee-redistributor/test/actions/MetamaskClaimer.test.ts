import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  fp,
  getSigner,
  getSigners,
  instanceAt,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  createSmartVault,
  createTokenMock,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { defaultAbiCoder, getContractAddress } from 'ethers/lib/utils'
import { ethers } from 'hardhat'

describe('MetamaskClaimer', () => {
  let action: Contract, smartVault: Contract, safe: Contract, metamaskFeeDistributor: Contract, mimic: Mimic
  let owner: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, feeCollector] = await getSigners()
  })

  async function deploySafe(): Promise<Contract> {
    const artifact = '@gnosis.pm/safe-contracts/build/artifacts/contracts/GnosisSafe.sol/GnosisSafe'
    const implementation = (await deploy(artifact)).address.slice(2)
    const proxyBytecode = `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${implementation}5af43d82803e903d91602b57fd5bf3`

    const deployer = await getSigner()
    const addressQuery = { from: deployer.address, nonce: await deployer.getTransactionCount() }
    await deployer.sendTransaction({ data: proxyBytecode })
    return instanceAt(artifact, await getContractAddress(addressQuery))
  }

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    safe = await deploySafe()
    metamaskFeeDistributor = await deploy('MetamaskFeeDistributorMock')

    action = await deploy('MetamaskClaimer', [
      {
        admin: owner.address,
        registry: mimic.registry.address,
        smartVault: smartVault.address,
        safe: safe.address,
        metamaskFeeDistributor: metamaskFeeDistributor.address,
        relayer: owner.address,
        gasPriceLimit: 100e9,
        gasToken: mimic.wrappedNativeToken.address,
      },
    ])

    await safe.setup([smartVault.address], 1, ZERO_ADDRESS, '0x', ZERO_ADDRESS, ZERO_ADDRESS, 0, ZERO_ADDRESS)
  })

  describe('initialization', () => {
    it('initializes the action as expected', async () => {
      const authorizeRole = action.interface.getSighash('authorize')
      expect(await action.isAuthorized(owner.address, authorizeRole)).to.be.true

      const unauthorizeRole = action.interface.getSighash('unauthorize')
      expect(await action.isAuthorized(owner.address, unauthorizeRole)).to.be.true

      expect(await action.registry()).to.be.equal(mimic.registry.address)
      expect(await action.smartVault()).to.be.equal(smartVault.address)
      expect(await action.safe()).to.be.equal(safe.address)
      expect(await action.metamaskFeeDistributor()).to.be.equal(metamaskFeeDistributor.address)

      expect(await action.isRelayer(owner.address)).to.be.true
      expect(await action.gasPriceLimit()).to.be.eq(100e9)
      expect(await action.txCostLimit()).to.be.eq(0)
      expect(await action.gasToken()).to.be.equal(mimic.wrappedNativeToken.address)
    })
  })

  describe('setSafe', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setSafeRole = action.interface.getSighash('setSafe')
        await action.connect(owner).authorize(owner.address, setSafeRole)
        action = action.connect(owner)
      })

      it('sets the safe address', async () => {
        await action.setSafe(owner.address)

        expect(await action.safe()).to.be.equal(owner.address)
      })

      it('emits an event', async () => {
        const tx = await action.setSafe(owner.address)

        await assertEvent(tx, 'SafeSet', { safe: owner })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setSafe(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setMetamaskFeeDistributor', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setMetamaskFeeDistributorRole = action.interface.getSighash('setMetamaskFeeDistributor')
        await action.connect(owner).authorize(owner.address, setMetamaskFeeDistributorRole)
        action = action.connect(owner)
      })

      it('sets the distributor address', async () => {
        await action.setMetamaskFeeDistributor(owner.address)

        expect(await action.metamaskFeeDistributor()).to.be.equal(owner.address)
      })

      it('emits an event', async () => {
        const tx = await action.setMetamaskFeeDistributor(owner.address)

        await assertEvent(tx, 'MetamaskFeeDistributorSet', { metamaskFeeDistributor: owner })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setMetamaskFeeDistributor(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setGasToken', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setGasTokenRole = action.interface.getSighash('setGasToken')
        await action.connect(owner).authorize(owner.address, setGasTokenRole)
        action = action.connect(owner)
      })

      context('when the given token is not the zero address', () => {
        it('sets the gas token address', async () => {
          await action.setGasToken(owner.address)

          expect(await action.gasToken()).to.be.equal(owner.address)
        })

        it('emits an event', async () => {
          const tx = await action.setGasToken(owner.address)

          await assertEvent(tx, 'GasTokenSet', { gasToken: owner })
        })
      })

      context('when the given token is the zero address', () => {
        it('reverts', async () => {
          await expect(action.setGasToken(ZERO_ADDRESS)).to.be.revertedWith('GAS_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setGasToken(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    beforeEach('authorize action', async () => {
      const callRole = smartVault.interface.getSighash('call')
      await smartVault.connect(owner).authorize(action.address, callRole)
      const withdrawRole = smartVault.interface.getSighash('withdraw')
      await smartVault.connect(owner).authorize(action.address, withdrawRole)
    })

    beforeEach('set fee collector', async () => {
      const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
      await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
      await smartVault.connect(owner).setFeeCollector(feeCollector.address)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the token is an ERC20', () => {
          let token: Contract
          const amount = fp(10)

          beforeEach('deploy token and fund fee distributor', async () => {
            token = await createTokenMock()
            await token.mint(owner.address, amount)
            await token.connect(owner).approve(metamaskFeeDistributor.address, amount)
            await metamaskFeeDistributor.connect(owner).assign(token.address, amount, safe.address)
          })

          it('calls the call primitive to claim metamask', async () => {
            const tx = await action.call(token.address)

            const metamaskClaimData = metamaskFeeDistributor.interface.encodeFunctionData('withdraw', [[token.address]])
            const contractSignature = `${defaultAbiCoder.encode(['uint256', 'uint256'], [smartVault.address, 0])}01`
            const callData = safe.interface.encodeFunctionData('execTransaction', [
              metamaskFeeDistributor.address,
              0,
              metamaskClaimData,
              0,
              0,
              0,
              0,
              ZERO_ADDRESS,
              ZERO_ADDRESS,
              contractSignature,
            ])

            await assertIndirectEvent(tx, smartVault.interface, 'Call', {
              target: safe.address,
              callData,
              value: 0,
              data: '0x',
            })
          })

          it('calls the call primitive to transfer tokens', async () => {
            const tx = await action.call(token.address)

            const transferData = token.interface.encodeFunctionData('transfer', [smartVault.address, amount])
            const contractSignature = `${defaultAbiCoder.encode(['uint256', 'uint256'], [smartVault.address, 0])}01`
            const callData = safe.interface.encodeFunctionData('execTransaction', [
              token.address,
              0,
              transferData,
              0,
              0,
              0,
              0,
              ZERO_ADDRESS,
              ZERO_ADDRESS,
              contractSignature,
            ])

            await assertIndirectEvent(tx, smartVault.interface, 'Call', {
              target: safe.address,
              callData,
              value: 0,
              data: '0x',
            })
          })

          it('transfers the claimed balance to the smart vault', async () => {
            const previousBalance = await token.balanceOf(smartVault.address)

            await action.call(token.address)

            const currentBalance = await token.balanceOf(smartVault.address)
            expect(currentBalance).to.be.equal(previousBalance.add(amount))
          })

          it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
            const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

            const tx = await action.call(token.address)

            const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
            expect(currentBalance).to.be[refunds ? 'gt' : 'equal'](previousBalance)

            if (refunds) {
              const redeemedCost = currentBalance.sub(previousBalance)
              await assertRelayedBaseCost(tx, redeemedCost, 0.12)
            }
          })
        })

        context('when the token is the native token', () => {
          const token = NATIVE_TOKEN_ADDRESS
          const amount = fp(0.1)

          beforeEach('deploy token and fund fee distributor', async () => {
            await metamaskFeeDistributor.connect(owner).assign(ZERO_ADDRESS, amount, safe.address, { value: amount })
          })

          it('calls the call primitive to claim metamask', async () => {
            const tx = await action.call(token)

            const metamaskClaimData = metamaskFeeDistributor.interface.encodeFunctionData('withdraw', [[ZERO_ADDRESS]])
            const contractSignature = `${defaultAbiCoder.encode(['uint256', 'uint256'], [smartVault.address, 0])}01`
            const callData = safe.interface.encodeFunctionData('execTransaction', [
              metamaskFeeDistributor.address,
              0,
              metamaskClaimData,
              0,
              0,
              0,
              0,
              ZERO_ADDRESS,
              ZERO_ADDRESS,
              contractSignature,
            ])

            await assertIndirectEvent(tx, smartVault.interface, 'Call', {
              target: safe.address,
              callData,
              value: 0,
              data: '0x',
            })
          })

          it('calls the call primitive to send value', async () => {
            const tx = await action.call(token)

            const contractSignature = `${defaultAbiCoder.encode(['uint256', 'uint256'], [smartVault.address, 0])}01`
            const callData = safe.interface.encodeFunctionData('execTransaction', [
              smartVault.address,
              amount,
              '0x',
              0,
              0,
              0,
              0,
              ZERO_ADDRESS,
              ZERO_ADDRESS,
              contractSignature,
            ])

            await assertIndirectEvent(tx, smartVault.interface, 'Call', {
              target: safe.address,
              callData,
              value: 0,
              data: '0x',
            })
          })

          it('transfers the claimed balance to the smart vault', async () => {
            const previousBalance = await ethers.provider.getBalance(smartVault.address)

            await action.call(token)

            const currentBalance = await ethers.provider.getBalance(smartVault.address)
            expect(currentBalance).to.be.equal(previousBalance.add(amount))
          })

          it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
            const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

            const tx = await action.call(token)

            const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
            expect(currentBalance).to.be[refunds ? 'gt' : 'equal'](previousBalance)

            if (refunds) {
              const redeemedCost = currentBalance.sub(previousBalance)
              await assertRelayedBaseCost(tx, redeemedCost, 0.1)
            }
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('enable relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(owner).authorize(owner.address, setRelayerRole)
          await action.connect(owner).setRelayer(owner.address, true)
        })

        beforeEach('fund smart vault to pay gas', async () => {
          await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(0.1) })
          await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, fp(0.1))
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        beforeEach('disable relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(owner).authorize(owner.address, setRelayerRole)
          await action.connect(owner).setRelayer(owner.address, false)
        })

        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
