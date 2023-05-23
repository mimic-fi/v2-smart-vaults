import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyActionConfig, createSmartVault, createTokenMock, Mimic, setupMimic } from '../../../dist'
import { assertRelayedBaseCost } from '../../../src/asserts'

describe('WithdrawerAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up dependencies', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
    mimic = await setupMimic(true)
  })

  beforeEach('deploy action', async () => {
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('WithdrawerAction', [
      {
        recipient: other.address,
        actionConfig: buildEmptyActionConfig(owner, smartVault),
      },
    ])
  })

  beforeEach('authorize action', async () => {
    const withdrawRole = smartVault.interface.getSighash('withdraw')
    await smartVault.connect(owner).authorize(action.address, withdrawRole)
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
          newRecipient = other
        })

        it('sets the recipient', async () => {
          await action.setRecipient(newRecipient.address)

          const recipient = await action.getRecipient()
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
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setRecipient(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    let token: Contract
    let recipient: SignerWithAddress
    const threshold = fp(2)

    beforeEach('set token and recipient', async () => {
      recipient = other
      token = await createTokenMock()
    })

    beforeEach('set recipient', async () => {
      const setRecipientRole = action.interface.getSighash('setRecipient')
      await action.connect(owner).authorize(owner.address, setRecipientRole)
      await action.connect(owner).setRecipient(recipient.address)
    })

    beforeEach('set token acceptance', async () => {
      token = await createTokenMock()
      const setTokensAcceptanceListRole = action.interface.getSighash('setTokensAcceptanceList')
      await action.connect(owner).authorize(owner.address, setTokensAcceptanceListRole)
      await action.connect(owner).setTokensAcceptanceList([token.address], [])
    })

    beforeEach('set token allow-list', async () => {
      const setTokensAcceptanceTypeRole = action.interface.getSighash('setTokensAcceptanceType')
      await action.connect(owner).authorize(owner.address, setTokensAcceptanceTypeRole)
      await action.connect(owner).setTokensAcceptanceType(1)
    })

    beforeEach('set threshold', async () => {
      const setDefaultTokenThresholdRole = action.interface.getSighash('setDefaultTokenThreshold')
      await action.connect(owner).authorize(owner.address, setDefaultTokenThresholdRole)
      await action.connect(owner).setDefaultTokenThreshold({ token: token.address, min: threshold, max: 0 })
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
        context('when the given token is allowed', () => {
          context('when the threshold has passed', () => {
            const amount = threshold

            beforeEach('fund smart vault', async () => {
              await token.mint(smartVault.address, amount)
            })

            it('calls the withdraw primitive', async () => {
              const previousFeeCollectorBalance = await token.balanceOf(feeCollector.address)

              const tx = await action.call(token.address, amount)

              const currentFeeCollectorBalance = await token.balanceOf(feeCollector.address)
              const refund = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

              await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
                token,
                recipient,
                withdrawn: amount.sub(refund),
                fee: 0,
                data: '0x',
              })
            })

            it('emits an Executed event', async () => {
              const tx = await action.call(token.address, amount)

              await assertEvent(tx, 'Executed')
            })

            it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
              const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

              const tx = await action.call(token.address, amount)

              const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
              expect(currentBalance).to.be[refunds ? 'gt' : 'equal'](previousBalance)

              if (refunds) {
                const redeemedCost = currentBalance.sub(previousBalance)
                await assertRelayedBaseCost(tx, redeemedCost, 0.05)
              }
            })
          })

          context('when the threshold has not passed', () => {
            const amount = threshold.sub(1)

            beforeEach('fund smart vault', async () => {
              await token.mint(smartVault.address, amount)
            })

            it('reverts', async () => {
              await expect(action.call(token.address, amount)).to.be.revertedWith('ACTION_TOKEN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the given token is not allowed', () => {
          it('reverts', async () => {
            await expect(action.call(NATIVE_TOKEN_ADDRESS, 0)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayersRole = action.interface.getSighash('setRelayers')
          await action.connect(owner).authorize(owner.address, setRelayersRole)
          await action.connect(owner).setRelayers([owner.address], [])
        })

        beforeEach('set relay gas token', async () => {
          const setRelayGasTokenRole = action.interface.getSighash('setRelayGasToken')
          await action.connect(owner).authorize(owner.address, setRelayGasTokenRole)
          await action.connect(owner).setRelayGasToken(mimic.wrappedNativeToken.address)
        })

        beforeEach('fund smart vault with wrapped native token to pay gas', async () => {
          await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(0.001) })
          await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, fp(0.001))
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.connect(other).call(token.address, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
