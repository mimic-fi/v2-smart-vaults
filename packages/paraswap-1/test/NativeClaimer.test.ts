import {
  assertEvent,
  assertIndirectEvent,
  assertNoIndirectEvent,
  deploy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { createClone } from '@mimic-fi/v2-registry'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('NativeClaimer', () => {
  let action: Contract, wallet: Contract, registry: Contract, priceOracle: Contract, wrappedNativeToken: Contract
  let admin: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, admin, other, feeCollector] = await getSigners()
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
    action = await deploy('NativeClaimer', [admin.address, wallet.address])
    const callRole = wallet.interface.getSighash('call')
    await wallet.connect(admin).authorize(action.address, callRole)
    const wrapRole = wallet.interface.getSighash('wrap')
    await wallet.connect(admin).authorize(action.address, wrapRole)
    const withdrawRole = wallet.interface.getSighash('withdraw')
    await wallet.connect(admin).authorize(action.address, withdrawRole)
  })

  describe('setFeeClaimer', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
        await action.connect(admin).authorize(admin.address, setFeeClaimerRole)
        action = action.connect(admin)
      })

      it('sets the swap signer', async () => {
        await action.setFeeClaimer(other.address)

        expect(await action.feeClaimer()).to.be.equal(other.address)
      })

      it('emits an event', async () => {
        const tx = await action.setFeeClaimer(other.address)

        await assertEvent(tx, 'FeeClaimerSet', { feeClaimer: other })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setFeeClaimer(other.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    let feeClaimer: Contract, token: string

    beforeEach('deploy token', async () => {
      feeClaimer = await deploy('FeeClaimerMock')
      const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
      await action.connect(admin).authorize(admin.address, setFeeClaimerRole)
      await action.connect(admin).setFeeClaimer(feeClaimer.address)
    })

    const itPerformsTheExpectedCall = (refunds: boolean) => {
      const itCallsTheCallPrimitive = () => {
        it('calls the call primitive', async () => {
          const tx = await action.call(token)

          const data = feeClaimer.interface.encodeFunctionData('withdrawAllERC20', [token, wallet.address])
          await assertIndirectEvent(tx, wallet.interface, 'Call', { target: feeClaimer, data, value: 0 })
        })

        it('emits an Executed event', async () => {
          const tx = await action.call(token)

          await assertEvent(tx, 'Executed')
        })
      }

      const itRefundsGasCorrectly = () => {
        it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
          const previousBalance = await wrappedNativeToken.balanceOf(feeCollector.address)

          await action.call(token)

          const currentBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
          expect(currentBalance).to.be[refunds ? 'gt' : 'eq'](previousBalance)
        })
      }

      context('when the token to collect is the native token', () => {
        const balance = fp(0.5)

        beforeEach('set token', async () => {
          token = NATIVE_TOKEN_ADDRESS
          await admin.sendTransaction({ to: feeClaimer.address, value: balance })
        })

        context('when the min amount passes the threshold', () => {
          beforeEach('set threshold', async () => {
            const usdc = await deploy('TokenMock', ['TKN'])
            await priceOracle.mockRate(fp(2))
            const setThresholdRole = action.interface.getSighash('setThreshold')
            await action.connect(admin).authorize(admin.address, setThresholdRole)
            await action.connect(admin).setThreshold(usdc.address, balance)
          })

          context('when the fee claim succeeds', () => {
            beforeEach('mock succeeds', async () => {
              await feeClaimer.mockFail(false)
            })

            itCallsTheCallPrimitive()

            itRefundsGasCorrectly()

            it('calls the wrap primitive', async () => {
              const tx = await action.call(token)

              await assertIndirectEvent(tx, wallet.interface, 'Wrap', { amount: balance, data: '0x' })
            })
          })

          context('when the fee claim fails', () => {
            beforeEach('mock fail', async () => {
              await feeClaimer.mockFail(true)
            })

            it('reverts', async () => {
              await expect(action.call(token)).to.be.revertedWith('FEE_CLAIMER_WITHDRAW_FAILED')
            })
          })
        })

        context('when the min amount does not pass the threshold', () => {
          beforeEach('set threshold', async () => {
            const usdc = await deploy('TokenMock', ['TKN'])
            await priceOracle.mockRate(fp(2))
            const setThresholdRole = action.interface.getSighash('setThreshold')
            await action.connect(admin).authorize(admin.address, setThresholdRole)
            await action.connect(admin).setThreshold(usdc.address, balance.mul(3))
          })

          it('reverts', async () => {
            await expect(action.call(token)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
          })
        })
      })

      context('when the token to collect is the wrapped native token', () => {
        const balance = fp(2)

        beforeEach('set token', async () => {
          token = wrappedNativeToken.address
          await wrappedNativeToken.connect(admin).deposit({ value: balance })
          await wrappedNativeToken.connect(admin).transfer(feeClaimer.address, balance)
        })

        context('when the min amount passes the threshold', () => {
          beforeEach('set threshold', async () => {
            const usdc = await deploy('TokenMock', ['TKN'])
            await priceOracle.mockRate(fp(2))
            const setThresholdRole = action.interface.getSighash('setThreshold')
            await action.connect(admin).authorize(admin.address, setThresholdRole)
            await action.connect(admin).setThreshold(usdc.address, balance)
          })

          context('when the fee claim succeeds', () => {
            beforeEach('mock succeeds', async () => {
              await feeClaimer.mockFail(false)
            })

            itCallsTheCallPrimitive()

            itRefundsGasCorrectly()

            it('does not call the wrap primitive', async () => {
              const tx = await action.call(token)

              await assertNoIndirectEvent(tx, wallet.interface, 'Wrap')
            })
          })

          context('when the fee claim fails', () => {
            beforeEach('mock fail', async () => {
              await feeClaimer.mockFail(true)
            })

            it('reverts', async () => {
              await expect(action.call(token)).to.be.revertedWith('FEE_CLAIMER_WITHDRAW_FAILED')
            })
          })
        })

        context('when the min amount does not pass the threshold', () => {
          beforeEach('set threshold', async () => {
            const usdc = await deploy('TokenMock', ['TKN'])
            await priceOracle.mockRate(fp(2))
            const setThresholdRole = action.interface.getSighash('setThreshold')
            await action.connect(admin).authorize(admin.address, setThresholdRole)
            await action.connect(admin).setThreshold(usdc.address, balance.mul(3))
          })

          it('reverts', async () => {
            await expect(action.call(token)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
          })
        })
      })

      context('when the token to collect is an ERC20', () => {
        beforeEach('set token', async () => {
          token = (await deploy('TokenMock', ['TKN'])).address
        })

        it('reverts', async () => {
          await expect(action.call(token)).to.be.revertedWith('NATIVE_CLAIMER_INVALID_TOKEN')
        })
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
        await expect(action.call(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
