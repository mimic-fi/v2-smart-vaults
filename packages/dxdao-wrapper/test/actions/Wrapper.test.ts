import { assertEvent, assertIndirectEvent, fp, getSigners } from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  createAction,
  createSmartVault,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

describe('Wrapper', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, recipient: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, recipient, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('Wrapper', mimic, owner, smartVault)
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

      const itPerformsTheExpectedCall = (relayed: boolean) => {
        const threshold = fp(0.1)

        beforeEach('set threshold', async () => {
          const setThresholdRole = action.interface.getSighash('setThreshold')
          await action.connect(owner).authorize(owner.address, setThresholdRole)
          await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, threshold)
        })

        const itWrapsBalanceCorrectly = (wrapped: BigNumber) => {
          it('calls the wrap primitive', async () => {
            const tx = await action.call()

            await assertIndirectEvent(tx, smartVault.interface, 'Wrap', { wrapped, data: '0x' })
          })

          it('calls the withdraw primitive', async () => {
            const previousRecipientBalance = await mimic.wrappedNativeToken.balanceOf(recipient.address)
            const previousFeeCollectorBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

            const tx = await action.call()

            const currentFeeCollectorBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
            const gasRefund = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

            const currentRecipientBalance = await mimic.wrappedNativeToken.balanceOf(recipient.address)
            expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(wrapped).sub(gasRefund))

            await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
              token: mimic.wrappedNativeToken,
              recipient,
              withdrawn: wrapped.sub(gasRefund),
              fee: 0,
              data: '0x',
            })
          })

          it('emits an Executed event', async () => {
            const tx = await action.call()

            await assertEvent(tx, 'Executed')
          })

          if (relayed) {
            it('refunds gas', async () => {
              const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

              const tx = await action.call()

              const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
              expect(currentBalance).to.be.gt(previousBalance)

              const redeemedCost = currentBalance.sub(previousBalance)
              await assertRelayedBaseCost(tx, redeemedCost, 0.1)
            })
          } else {
            it('does not refund gas', async () => {
              const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

              await action.call()

              const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
              expect(currentBalance).to.be.equal(previousBalance)
            })
          }
        }

        const itCannotWrapBalance = () => {
          it('cannot execute', async () => {
            expect(await action.canExecute()).to.be.false
          })

          it('reverts', async () => {
            await expect(action.call()).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
          })
        }

        context('when there is balance only in the action', () => {
          context('when the action balance passes the threshold', () => {
            const balance = threshold

            beforeEach('fund the action and the smart vault', async () => {
              await owner.sendTransaction({ to: action.address, value: balance })
            })

            itWrapsBalanceCorrectly(balance)
          })

          context('when the action balance does not pass the threshold', () => {
            const balance = threshold.sub(1)

            beforeEach('fund the action and the smart vault', async () => {
              await owner.sendTransaction({ to: action.address, value: balance })
            })

            itCannotWrapBalance()
          })
        })

        context('when there is balance only in the smart vault', () => {
          context('when the smart vault balance passes the threshold', () => {
            const balance = threshold

            beforeEach('fund the action and the smart vault', async () => {
              await owner.sendTransaction({ to: smartVault.address, value: balance })
            })

            itWrapsBalanceCorrectly(balance)
          })

          context('when the smart vault balance does not pass the threshold', () => {
            const balance = threshold.sub(1)

            beforeEach('fund the action and the smart vault', async () => {
              await owner.sendTransaction({ to: smartVault.address, value: balance })
            })

            itCannotWrapBalance()
          })
        })

        context('when there is balance in both the action and the smart vault', () => {
          const totalBalance = threshold
          const balance = totalBalance.div(2)

          context('when the total balance passes the threshold', () => {
            beforeEach('fund the action and the smart vault', async () => {
              await owner.sendTransaction({ to: action.address, value: balance })
              await owner.sendTransaction({ to: smartVault.address, value: balance })
            })

            itWrapsBalanceCorrectly(totalBalance)
          })

          context('when the total balance does not pass the threshold', () => {
            const totalBalance = threshold.sub(1)
            const balance = totalBalance.div(2)

            beforeEach('fund the action and the smart vault', async () => {
              await owner.sendTransaction({ to: action.address, value: balance })
              await owner.sendTransaction({ to: smartVault.address, value: balance })
            })

            itCannotWrapBalance()
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(owner).authorize(owner.address, setRelayerRole)
          await action.connect(owner).setRelayer(owner.address, true)
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
