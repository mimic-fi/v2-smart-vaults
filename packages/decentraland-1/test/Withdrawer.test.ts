import { assertEvent, assertIndirectEvent, fp, getSigners } from '@mimic-fi/v2-helpers'
import {
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
  let action: Contract, smartVault: Contract, mimic: Mimic, token: Contract
  let owner: SignerWithAddress, other: SignerWithAddress, recipient: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, recipient, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('Withdrawer', mimic, owner, smartVault)
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

  describe('setToken', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenRole = action.interface.getSighash('setToken')
        await action.connect(owner).authorize(owner.address, setTokenRole)
        action = action.connect(owner)
      })

      it('sets the token in', async () => {
        await action.setToken(token.address)

        expect(await action.token()).to.be.equal(token.address)
      })

      it('emits an event', async () => {
        const tx = await action.setToken(token.address)

        await assertEvent(tx, 'TokenSet', { token })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setToken(token.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    const threshold = fp(2)

    beforeEach('set recipient', async () => {
      const setRecipientRole = action.interface.getSighash('setRecipient')
      await action.connect(owner).authorize(owner.address, setRecipientRole)
      await action.connect(owner).setRecipient(recipient.address)
    })

    beforeEach('set token', async () => {
      const setTokenRole = action.interface.getSighash('setToken')
      await action.connect(owner).authorize(owner.address, setTokenRole)
      await action.connect(owner).setToken(token.address)
    })

    beforeEach('set threshold', async () => {
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)
      await action.connect(owner).setThreshold(token.address, threshold)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the threshold has passed', () => {
          const amount = threshold

          beforeEach('fund smart vault', async () => {
            await token.mint(smartVault.address, amount)
          })

          it('calls the withdraw primitive', async () => {
            const previousFeeCollectorBalance = await token.balanceOf(feeCollector.address)

            const tx = await action.call()

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
            const tx = await action.call()

            await assertEvent(tx, 'Executed')
          })

          it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
            const previousBalance = await token.balanceOf(feeCollector.address)

            await action.call()

            const currentBalance = await token.balanceOf(feeCollector.address)
            expect(currentBalance).to.be[refunds ? 'gt' : 'equal'](previousBalance)
          })
        })

        context('when the threshold has not passed', () => {
          beforeEach('fund smart vault', async () => {
            await token.mint(smartVault.address, threshold.sub(1))
          })

          it('reverts', async () => {
            await expect(action.call()).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
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
          await action.connect(owner).setLimits(fp(100), 0, token.address)
        })

        beforeEach('set native token price feed for gas 1:1', async () => {
          const feed = await createPriceFeedMock(fp(1))
          const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
          await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
          await smartVault.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, token.address, feed.address)
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
