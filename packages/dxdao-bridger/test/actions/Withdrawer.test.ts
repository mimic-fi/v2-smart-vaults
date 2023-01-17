import {
  assertEvent,
  assertIndirectEvent,
  assertNoIndirectEvent,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  createAction,
  createSmartVault,
  createTokenMock,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('Withdrawer', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, recipient: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, recipient, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('Withdrawer', mimic, owner, smartVault)
  })

  beforeEach('authorize action', async () => {
    const wrapRole = smartVault.interface.getSighash('wrap')
    await smartVault.connect(owner).authorize(action.address, wrapRole)
    const withdrawRole = smartVault.interface.getSighash('withdraw')
    await smartVault.connect(owner).authorize(action.address, withdrawRole)
  })

  beforeEach('set fee collector', async () => {
    const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
    await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
    await smartVault.connect(owner).setFeeCollector(feeCollector.address)
  })

  describe('call', () => {
    beforeEach('set recipient', async () => {
      const setRecipientRole = action.interface.getSighash('setRecipient')
      await action.connect(owner).authorize(owner.address, setRecipientRole)
      await action.connect(owner).setRecipient(recipient.address)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the requested token is the native token', () => {
          const amount = fp(0.1)
          const token = NATIVE_TOKEN_ADDRESS

          beforeEach('fund smart vault', async () => {
            await owner.sendTransaction({ to: smartVault.address, value: amount })
          })

          context('when the given amount passes the threshold', () => {
            const threshold = amount

            beforeEach('set threshold', async () => {
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(owner).authorize(owner.address, setThresholdRole)
              await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, threshold)
            })

            it('can executes', async () => {
              const canExecute = await action.canExecute(token)

              expect(canExecute).to.be.true
            })

            it('calls the wrap primitive', async () => {
              const tx = await action.call(token)

              await assertIndirectEvent(tx, smartVault.interface, 'Wrap', {
                amount,
                wrapped: amount,
                data: '0x',
              })
            })

            it('calls the withdraw primitive', async () => {
              const previousRecipientBalance = await mimic.wrappedNativeToken.balanceOf(recipient.address)
              const previousFeeCollectorBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

              const tx = await action.call(token)

              const currentFeeCollectorBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
              const refund = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

              const currentRecipientBalance = await mimic.wrappedNativeToken.balanceOf(recipient.address)
              expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount).sub(refund))

              await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
                token: mimic.wrappedNativeToken,
                recipient: recipient.address,
                withdrawn: amount.sub(refund),
                fee: 0,
                data: '0x',
              })
            })

            it('emits an Executed event', async () => {
              const tx = await action.call(token)

              await assertEvent(tx, 'Executed')
            })

            if (refunds) {
              it('refunds gas', async () => {
                const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                const tx = await action.call(token)

                const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                expect(currentBalance).to.be.gt(previousBalance)

                const redeemedCost = currentBalance.sub(previousBalance)
                await assertRelayedBaseCost(tx, redeemedCost, 0.2)
              })
            } else {
              it('does not refund gas', async () => {
                const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                await action.call(token)

                const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                expect(currentBalance).to.be.equal(previousBalance)
              })
            }
          })

          context('when the given amount does not pass the threshold', () => {
            const threshold = amount.mul(2)

            beforeEach('set threshold', async () => {
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(owner).authorize(owner.address, setThresholdRole)
              await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, threshold)
            })

            it('reverts', async () => {
              await expect(action.call(token)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the requested token is the wrapped native token', () => {
          let token: Contract
          const amount = fp(0.1)

          beforeEach('set token', async () => {
            token = mimic.wrappedNativeToken
          })

          beforeEach('fund smart vault', async () => {
            await mimic.wrappedNativeToken.connect(owner).deposit({ value: amount })
            await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, amount)
          })

          context('when the given amount passes the threshold', () => {
            const threshold = amount

            beforeEach('set threshold', async () => {
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(owner).authorize(owner.address, setThresholdRole)
              await action.connect(owner).setThreshold(token.address, threshold)
            })

            it('can executes', async () => {
              const canExecute = await action.canExecute(token.address)

              expect(canExecute).to.be.true
            })

            it('does not call the wrap primitive', async () => {
              const tx = await action.call(token.address)

              await assertNoIndirectEvent(tx, smartVault.interface, 'Wrap')
            })

            it('calls the withdraw primitive', async () => {
              const previousRecipientBalance = await mimic.wrappedNativeToken.balanceOf(recipient.address)
              const previousFeeCollectorBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

              const tx = await action.call(token.address)

              const currentFeeCollectorBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
              const refund = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

              const currentRecipientBalance = await mimic.wrappedNativeToken.balanceOf(recipient.address)
              expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount).sub(refund))

              await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
                token: mimic.wrappedNativeToken.address,
                recipient,
                withdrawn: amount.sub(refund),
                fee: 0,
                data: '0x',
              })
            })

            it('emits an Executed event', async () => {
              const tx = await action.call(token.address)

              await assertEvent(tx, 'Executed')
            })

            if (refunds) {
              it('refunds gas', async () => {
                const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                const tx = await action.call(token.address)

                const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                expect(currentBalance).to.be.gt(previousBalance)

                const redeemedCost = currentBalance.sub(previousBalance)
                await assertRelayedBaseCost(tx, redeemedCost, 0.1)
              })
            } else {
              it('does not refund gas', async () => {
                const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                await action.call(token.address)

                const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                expect(currentBalance).to.be.equal(previousBalance)
              })
            }
          })

          context('when the given amount does not pass the threshold', () => {
            const threshold = amount.mul(2)

            beforeEach('set threshold', async () => {
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(owner).authorize(owner.address, setThresholdRole)
              await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, threshold)
            })

            it('reverts', async () => {
              await expect(action.call(token.address)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the requested token is another token', () => {
          let token: Contract
          const amount = fp(0.1)

          beforeEach('set token', async () => {
            token = await createTokenMock()
          })

          beforeEach('fund smart vault', async () => {
            await token.mint(smartVault.address, amount)
          })

          if (refunds) {
            beforeEach('fund smart vault to pay tx gas', async () => {
              await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(0.01) })
              await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, fp(0.01))
            })
          }

          context('when the given amount passes the threshold', () => {
            const threshold = amount

            beforeEach('set threshold', async () => {
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(owner).authorize(owner.address, setThresholdRole)
              await action.connect(owner).setThreshold(token.address, threshold)
            })

            it('can executes', async () => {
              const canExecute = await action.canExecute(token.address)

              expect(canExecute).to.be.true
            })

            it('does not call the wrap primitive', async () => {
              const tx = await action.call(token.address)

              await assertNoIndirectEvent(tx, smartVault.interface, 'Wrap')
            })

            it('calls the withdraw primitive', async () => {
              const tx = await action.call(token.address)

              await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
                token,
                recipient,
                withdrawn: amount,
                fee: 0,
                data: '0x',
              })
            })

            it('emits an Executed event', async () => {
              const tx = await action.call(token.address)

              await assertEvent(tx, 'Executed')
            })

            if (refunds) {
              it('refunds gas', async () => {
                const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                const tx = await action.call(token.address)

                const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                expect(currentBalance).to.be.gt(previousBalance)

                const redeemedCost = currentBalance.sub(previousBalance)
                await assertRelayedBaseCost(tx, redeemedCost, 0.1)
              })
            } else {
              it('does not refund gas', async () => {
                const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                await action.call(token.address)

                const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                expect(currentBalance).to.be.equal(previousBalance)
              })
            }
          })

          context('when the given amount does not pass the threshold', () => {
            const threshold = amount.mul(2)

            beforeEach('set threshold', async () => {
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(owner).authorize(owner.address, setThresholdRole)
              await action.connect(owner).setThreshold(token.address, threshold)
            })

            it('reverts', async () => {
              await expect(action.call(token.address)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
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
