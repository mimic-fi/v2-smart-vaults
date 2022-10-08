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
import {
  assertRelayedBaseCost,
  createAction,
  createPriceFeedMock,
  createTokenMock,
  createWallet,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('NativeClaimer', () => {
  let action: Contract, wallet: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    wallet = await createWallet(mimic, owner)
    action = await createAction('NativeClaimer', mimic, owner, wallet)
  })

  describe('setFeeClaimer', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
        await action.connect(owner).authorize(owner.address, setFeeClaimerRole)
        action = action.connect(owner)
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
    let feeClaimer: Contract, token: string, thresholdToken: string

    const thresholdRate = 2

    beforeEach('authorize action', async () => {
      const callRole = wallet.interface.getSighash('call')
      await wallet.connect(owner).authorize(action.address, callRole)
      const wrapRole = wallet.interface.getSighash('wrap')
      await wallet.connect(owner).authorize(action.address, wrapRole)
      const withdrawRole = wallet.interface.getSighash('withdraw')
      await wallet.connect(owner).authorize(action.address, withdrawRole)
    })

    beforeEach('set fee collector', async () => {
      const setFeeCollectorRole = wallet.interface.getSighash('setFeeCollector')
      await wallet.connect(owner).authorize(owner.address, setFeeCollectorRole)
      await wallet.connect(owner).setFeeCollector(feeCollector.address)
    })

    beforeEach('deploy fee claimer', async () => {
      feeClaimer = await deploy('FeeClaimerMock')
      const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
      await action.connect(owner).authorize(owner.address, setFeeClaimerRole)
      await action.connect(owner).setFeeClaimer(feeClaimer.address)
    })

    beforeEach('deploy threshold token', async () => {
      thresholdToken = (await createTokenMock()).address
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)

      const feed = await createPriceFeedMock(fp(thresholdRate))
      const setPriceFeedRole = wallet.interface.getSighash('setPriceFeed')
      await wallet.connect(owner).authorize(owner.address, setPriceFeedRole)
      await wallet.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, thresholdToken, feed.address)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        const itCallsTheCallPrimitive = () => {
          it('calls the call primitive', async () => {
            const tx = await action.call(token)

            const callData = feeClaimer.interface.encodeFunctionData('withdrawAllERC20', [token, wallet.address])
            await assertIndirectEvent(tx, wallet.interface, 'Call', {
              target: feeClaimer,
              callData,
              value: 0,
              data: '0x',
            })
          })

          it('emits an Executed event', async () => {
            const tx = await action.call(token)

            await assertEvent(tx, 'Executed')
          })
        }

        const itRefundsGasCorrectly = () => {
          it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
            const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

            const tx = await action.call(token)

            const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
            if (refunds) await assertRelayedBaseCost(tx, currentBalance.sub(previousBalance))
            else expect(currentBalance).to.be.equal(previousBalance)
          })
        }

        context('when the token to collect is the native token', () => {
          const balance = fp(0.5)

          beforeEach('set token', async () => {
            token = NATIVE_TOKEN_ADDRESS
          })

          beforeEach('fund fee claimer', async () => {
            await owner.sendTransaction({ to: feeClaimer.address, value: balance })
          })

          context('when the amount to claim passes the threshold', () => {
            const thresholdAmount = balance.mul(thresholdRate)

            beforeEach('set threshold', async () => {
              await action.connect(owner).setThreshold(thresholdToken, thresholdAmount)
            })

            context('when the fee claim succeeds', () => {
              beforeEach('mock succeeds', async () => {
                await feeClaimer.mockFail(false)
              })

              itCallsTheCallPrimitive()

              itRefundsGasCorrectly()

              it('calls the wrap primitive', async () => {
                const tx = await action.call(token)

                await assertIndirectEvent(tx, wallet.interface, 'Wrap', { wrapped: balance, data: '0x' })
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

          context('when the amount to claim does not pass the threshold', () => {
            const thresholdAmount = balance.mul(thresholdRate).add(1)

            beforeEach('set threshold', async () => {
              await action.connect(owner).setThreshold(thresholdToken, thresholdAmount)
            })

            it('reverts', async () => {
              await expect(action.call(token)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the token to collect is the wrapped native token', () => {
          const balance = fp(2)

          beforeEach('set token', async () => {
            token = mimic.wrappedNativeToken.address
            const feed = await createPriceFeedMock(fp(2))
            const setPriceFeedRole = wallet.interface.getSighash('setPriceFeed')
            await wallet.connect(owner).authorize(owner.address, setPriceFeedRole)
            await wallet.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, thresholdToken, feed.address)
          })

          beforeEach('fund fee claimer', async () => {
            await mimic.wrappedNativeToken.connect(owner).deposit({ value: balance })
            await mimic.wrappedNativeToken.connect(owner).transfer(feeClaimer.address, balance)
          })

          context('when the amount to claim passes the threshold', () => {
            const thresholdAmount = balance.mul(thresholdRate)

            beforeEach('set threshold', async () => {
              await action.connect(owner).setThreshold(thresholdToken, thresholdAmount)
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

          context('when the amount to claim does not pass the threshold', () => {
            const thresholdAmount = balance.mul(thresholdRate).add(1)

            beforeEach('set threshold', async () => {
              await action.connect(owner).setThreshold(thresholdToken, thresholdAmount)
            })

            it('reverts', async () => {
              await expect(action.call(token)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the token to collect is an ERC20', () => {
          beforeEach('set token', async () => {
            token = (await createTokenMock()).address
          })

          it('reverts', async () => {
            await expect(action.call(token)).to.be.revertedWith('NATIVE_CLAIMER_INVALID_TOKEN')
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(owner).authorize(owner.address, setRelayerRole)
          await action.connect(owner).setRelayer(owner.address, true)

          const setLimitsRole = action.interface.getSighash('setLimits')
          await action.connect(owner).authorize(owner.address, setLimitsRole)
          await action.connect(owner).setLimits(fp(100), 0, mimic.wrappedNativeToken.address)
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
