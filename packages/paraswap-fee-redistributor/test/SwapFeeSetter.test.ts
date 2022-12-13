import { advanceTime, assertEvent, fp, getSigners, MONTH, NATIVE_TOKEN_ADDRESS } from '@mimic-fi/v2-helpers'
import { createAction, createSmartVault, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('SwapFeeSetter', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('SwapFeeSetter', mimic, owner, smartVault)
  })

  beforeEach('authorize action', async () => {
    const withdrawRole = smartVault.interface.getSighash('withdraw')
    await smartVault.connect(owner).authorize(action.address, withdrawRole)
    const setSwapFeeRole = smartVault.interface.getSighash('setSwapFee')
    await smartVault.connect(owner).authorize(action.address, setSwapFeeRole)
  })

  beforeEach('set fee collector', async () => {
    const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
    await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
    await smartVault.connect(owner).setFeeCollector(feeCollector.address)
  })

  describe('setFees', () => {
    const fees = [
      { pct: fp(0.01), cap: fp(50), token: NATIVE_TOKEN_ADDRESS, period: MONTH },
      { pct: fp(0.02), cap: fp(60), token: NATIVE_TOKEN_ADDRESS, period: MONTH * 2 },
    ]

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setFeesRole = action.interface.getSighash('setFees')
        await action.connect(owner).authorize(owner.address, setFeesRole)
        action = action.connect(owner)
      })

      context('when the fees where not set', () => {
        it('sets the swap signer', async () => {
          await action.setFees(fees)

          const fee0 = await action.fees(0)
          expect(fee0.pct).to.be.equal(fees[0].pct)
          expect(fee0.cap).to.be.equal(fees[0].cap)
          expect(fee0.token).to.be.equal(fees[0].token)
          expect(fee0.period).to.be.equal(fees[0].period)

          const fee1 = await action.fees(1)
          expect(fee1.pct).to.be.equal(fees[1].pct)
          expect(fee1.cap).to.be.equal(fees[1].cap)
          expect(fee1.token).to.be.equal(fees[1].token)
          expect(fee1.period).to.be.equal(fees[1].period)
        })

        it('emits an event', async () => {
          const tx = await action.setFees(fees)

          const event = await assertEvent(tx, 'FeesSet')
          expect(event.args.fees.length).to.be.equal(2)

          const fee0 = await event.args.fees[0]
          expect(fee0.pct).to.be.equal(fees[0].pct)
          expect(fee0.cap).to.be.equal(fees[0].cap)
          expect(fee0.token).to.be.equal(fees[0].token)
          expect(fee0.period).to.be.equal(fees[0].period)

          const fee1 = await event.args.fees[1]
          expect(fee1.pct).to.be.equal(fees[1].pct)
          expect(fee1.cap).to.be.equal(fees[1].cap)
          expect(fee1.token).to.be.equal(fees[1].token)
          expect(fee1.period).to.be.equal(fees[1].period)
        })
      })

      context('when the fees were already set', () => {
        beforeEach('set fees', async () => {
          await action.setFees(fees)
        })

        it('reverts', async () => {
          await expect(action.setFees(fees)).to.be.revertedWith('FEES_ALREADY_SET')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setFees(fees)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    const timeLock = MONTH

    beforeEach('set time-lock', async () => {
      const setTimeLockRole = action.interface.getSighash('setTimeLock')
      await action.connect(owner).authorize(owner.address, setTimeLockRole)
      await action.connect(owner).setTimeLock(timeLock)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      context('when the fees were set', () => {
        const fees = [
          { pct: fp(0.01), cap: fp(50), token: undefined, period: MONTH * 3 },
          { pct: fp(0.02), cap: fp(60), token: undefined, period: MONTH * 2 },
        ]

        beforeEach('set fees', async () => {
          fees[0].token = mimic.wrappedNativeToken.address
          fees[1].token = mimic.wrappedNativeToken.address

          const setFeesRole = action.interface.getSighash('setFees')
          await action.connect(owner).authorize(owner.address, setFeesRole)
          await action.setFees(fees)
        })

        const itPerformsTheExpectedCall = (refunds: boolean) => {
          context('when the time-lock has expired', () => {
            context('when the fees were not executed', () => {
              it('sets the swap fee', async () => {
                await action.call()

                const swapFee0 = await smartVault.swapFee()
                expect(swapFee0.pct).to.be.equal(fees[0].pct)
                expect(swapFee0.cap).to.be.equal(fees[0].cap)
                expect(swapFee0.token).to.be.equal(fees[0].token)
                expect(swapFee0.period).to.be.equal(fees[0].period)

                await expect(action.call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
                await advanceTime(timeLock)
                await action.call()

                const swapFee1 = await smartVault.swapFee()
                expect(swapFee1.pct).to.be.equal(fees[1].pct)
                expect(swapFee1.cap).to.be.equal(fees[1].cap)
                expect(swapFee1.token).to.be.equal(fees[1].token)
                expect(swapFee1.period).to.be.equal(fees[1].period)
              })

              it('emits an Executed event', async () => {
                const tx = await action.call()

                await assertEvent(tx, 'Executed')
              })

              it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
                const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                await action.call()

                const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                expect(currentBalance).to.be[refunds ? 'gt' : 'equal'](previousBalance)
              })
            })

            context('when all the fees were executed', () => {
              beforeEach('execute all fees', async () => {
                await action.call()
                await advanceTime(timeLock)
                await action.call()
                await advanceTime(timeLock)
              })

              it('reverts', async () => {
                await expect(action.call()).to.be.revertedWith('FEE_CONFIGS_ALREADY_EXECUTED')
              })
            })
          })

          context('when the time-lock has not expired', () => {
            beforeEach('execute', async () => {
              await action.call()
            })

            it('reverts', async () => {
              await expect(action.call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
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

          beforeEach('fund smart vault', async () => {
            await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(10) })
            await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, fp(10))
          })

          itPerformsTheExpectedCall(true)
        })

        context('when the sender is not a relayer', () => {
          itPerformsTheExpectedCall(false)
        })
      })

      context('when the fees were not set', () => {
        it('reverts', async () => {
          await expect(action.call()).to.be.revertedWith('FEES_NOT_SET')
        })
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
