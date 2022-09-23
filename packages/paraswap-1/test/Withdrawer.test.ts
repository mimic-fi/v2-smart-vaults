import { assertEvent, assertIndirectEvent, deploy, fp, getSigners } from '@mimic-fi/v2-helpers'
import { createClone } from '@mimic-fi/v2-registry'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('Withdrawer', () => {
  let action: Contract, wallet: Contract, registry: Contract, priceOracle: Contract, wrappedNativeToken: Contract
  let admin: SignerWithAddress, recipient: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, admin, recipient, feeCollector] = await getSigners()
  })

  beforeEach('deploy wallet', async () => {
    wrappedNativeToken = await deploy('WrappedNativeTokenMock')
    registry = await deploy('@mimic-fi/v2-registry/artifacts/contracts/registry/Registry.sol/Registry', [admin.address])
    wallet = await createClone(
      registry,
      admin,
      '@mimic-fi/v2-wallet/artifacts/contracts/Wallet.sol/Wallet',
      [wrappedNativeToken.address, registry.address],
      [admin.address]
    )
  })

  beforeEach('set price oracle', async () => {
    priceOracle = await createClone(registry, admin, 'PriceOracleMock', [])
    const setPriceOracleRole = wallet.interface.getSighash('setPriceOracle')
    await wallet.connect(admin).authorize(admin.address, setPriceOracleRole)
    await wallet.connect(admin).setPriceOracle(priceOracle.address)
  })

  beforeEach('set fee collector', async () => {
    const setFeeCollectorRole = wallet.interface.getSighash('setFeeCollector')
    await wallet.connect(admin).authorize(admin.address, setFeeCollectorRole)
    await wallet.connect(admin).setFeeCollector(feeCollector.address)
  })

  beforeEach('deploy action', async () => {
    action = await deploy('Withdrawer', [admin.address, wallet.address])
    const wrapRole = wallet.interface.getSighash('withdraw')
    await wallet.connect(admin).authorize(action.address, wrapRole)
  })

  describe('call', () => {
    const balance = fp(2)

    beforeEach('fund wallet', async () => {
      await wrappedNativeToken.connect(admin).deposit({ value: balance })
      await wrappedNativeToken.connect(admin).transfer(wallet.address, balance)
    })

    beforeEach('set recipient', async () => {
      const setRecipientRole = action.interface.getSighash('setRecipient')
      await action.connect(admin).authorize(admin.address, setRecipientRole)
      await action.connect(admin).setRecipient(recipient.address)
    })

    const itPerformsTheExpectedCall = (refunds: boolean) => {
      it('calls the withdraw primitive', async () => {
        const previousBalance = await wrappedNativeToken.balanceOf(feeCollector.address)

        const tx = await action.call()

        const currentBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
        const refund = currentBalance.sub(previousBalance)

        await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
          token: wrappedNativeToken,
          recipient,
          amount: balance.sub(refund),
          fee: 0,
          data: '0x',
        })
      })

      it('emits an Executed event', async () => {
        const tx = await action.call()

        await assertEvent(tx, 'Executed')
      })

      it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
        const previousBalance = await wrappedNativeToken.balanceOf(feeCollector.address)

        await action.call()

        const currentBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
        expect(currentBalance).to.be[refunds ? 'gt' : 'eq'](previousBalance)
      })
    }

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(admin).authorize(admin.address, callRole)
        action = action.connect(admin)
      })

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(admin).authorize(admin.address, setRelayerRole)
          await action.connect(admin).setRelayer(admin.address, true)

          const setLimitsRole = action.interface.getSighash('setLimits')
          await action.connect(admin).authorize(admin.address, setLimitsRole)
          await action.connect(admin).setLimits(fp(100), 0, wrappedNativeToken.address)
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
