import { assertEvent, assertIndirectEvent, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  createAction,
  createPriceFeedMock,
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

  describe('setRecipient', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setRecipientRole = action.interface.getSighash('setRecipient')
        await action.connect(owner).authorize(owner.address, setRecipientRole)
        action = action.connect(owner)
      })

      context('when the new address is not zero', async () => {
        let newRecipient: SignerWithAddress

        beforeEach('set new recipient', async () => {
          newRecipient = owner
        })

        it('sets the recipient', async () => {
          await action.setRecipient(newRecipient.address)

          const recipient = await action.recipient()
          expect(recipient).to.be.equal(newRecipient.address)
        })

        it('emits an event', async () => {
          const tx = await action.setRecipient(newRecipient.address)
          await assertEvent(tx, 'RecipientSet', { recipient: newRecipient })
        })
      })

      context('when the new address is zero', async () => {
        const newRecipient = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setRecipient(newRecipient)).to.be.revertedWith('RECIPIENT_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(recipient)
      })

      it('reverts', async () => {
        await expect(action.setRecipient(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    let token: Contract

    beforeEach('set recipient', async () => {
      const setRecipientRole = action.interface.getSighash('setRecipient')
      await action.connect(owner).authorize(owner.address, setRecipientRole)
      await action.connect(owner).setRecipient(recipient.address)
    })

    beforeEach('set time-lock', async () => {
      const setTimeLockRole = action.interface.getSighash('setTimeLock')
      await action.connect(owner).authorize(owner.address, setTimeLockRole)
      await action.connect(owner).setTimeLock(60)
    })

    beforeEach('authorize action', async () => {
      const withdrawRole = smartVault.interface.getSighash('withdraw')
      await smartVault.connect(owner).authorize(action.address, withdrawRole)
    })

    beforeEach('set fee collector', async () => {
      const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
      await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
      await smartVault.connect(owner).setFeeCollector(feeCollector.address)
    })

    beforeEach('deploy token', async () => {
      token = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the time-lock has expired', () => {
          context('when there is a threshold set', () => {
            const tokenRate = 2 // 1 token = 2 wrapped native tokens
            const thresholdAmount = fp(0.1) // in wrapped native tokens
            const thresholdAmountInToken = thresholdAmount.div(tokenRate) // threshold expressed in token

            beforeEach('set threshold', async () => {
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(owner).authorize(owner.address, setThresholdRole)
              await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, thresholdAmount)

              const feed = await createPriceFeedMock(fp(tokenRate))
              const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
              await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
              await smartVault
                .connect(owner)
                .setPriceFeed(token.address, mimic.wrappedNativeToken.address, feed.address)
            })

            context('when the smart vault balance passes the threshold', () => {
              const balance = thresholdAmountInToken

              beforeEach('fund protocol fee withdrawer', async () => {
                await token.mint(smartVault.address, balance)
              })

              it('calls the withdraw primitive', async () => {
                const previousBalance = await token.balanceOf(feeCollector.address)

                const tx = await action.call(token.address)

                const currentBalance = await token.balanceOf(feeCollector.address)
                const refund = currentBalance.sub(previousBalance)

                await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
                  token,
                  recipient: recipient.address,
                  withdrawn: balance.sub(refund),
                  fee: 0,
                  data: '0x',
                })
              })

              it('emits an Executed event', async () => {
                const tx = await action.call(token.address)

                await assertEvent(tx, 'Executed')
              })

              it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
                const previousBalance = await token.balanceOf(feeCollector.address)

                const tx = await action.call(token.address)

                const currentBalance = await token.balanceOf(feeCollector.address)
                expect(currentBalance).to.be[refunds ? 'gt' : 'equal'](previousBalance)

                if (refunds) {
                  const redeemedCost = currentBalance.sub(previousBalance).mul(tokenRate)
                  await assertRelayedBaseCost(tx, redeemedCost, 0.15)
                }
              })
            })

            context('when the smart vault balance does not pass the threshold', () => {
              const balance = thresholdAmountInToken.div(2)

              beforeEach('fund protocol fee withdrawer', async () => {
                await token.mint(smartVault.address, balance)
              })

              it('reverts', async () => {
                await expect(action.call(token.address)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
              })
            })
          })

          context('when there is no threshold set', () => {
            it('reverts', async () => {
              await expect(action.call(token.address)).to.be.reverted
            })
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
        await expect(action.call(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
