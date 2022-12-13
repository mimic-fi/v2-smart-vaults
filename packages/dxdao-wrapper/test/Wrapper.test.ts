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
    const balance = fp(0.5)

    beforeEach('fund smart vault token', async () => {
      await owner.sendTransaction({ to: smartVault.address, value: balance })
    })

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
        context('when the min amount passes the threshold', () => {
          beforeEach('set threshold and mock feed', async () => {
            const usdc = await createTokenMock()
            const setThresholdRole = action.interface.getSighash('setThreshold')
            await action.connect(owner).authorize(owner.address, setThresholdRole)
            await action.connect(owner).setThreshold(usdc.address, balance)

            const feed = await createPriceFeedMock(fp(2))
            const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
            await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
            await smartVault.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, usdc.address, feed.address)
          })

          it('calls the wrap primitive', async () => {
            const tx = await action.call()

            await assertIndirectEvent(tx, smartVault.interface, 'Wrap', { wrapped: balance, data: '0x' })
          })

          it('calls the withdraw primitive', async () => {
            const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

            const tx = await action.call()

            const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
            const refund = currentBalance.sub(previousBalance)

            await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
              token: mimic.wrappedNativeToken,
              recipient,
              withdrawn: balance.sub(refund),
              fee: 0,
              data: '0x',
            })
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

        context('when the min amount does not pass the threshold', () => {
          beforeEach('set threshold', async () => {
            const usdc = await createTokenMock()
            const setThresholdRole = action.interface.getSighash('setThreshold')
            await action.connect(owner).authorize(owner.address, setThresholdRole)
            await action.connect(owner).setThreshold(usdc.address, balance.mul(3))

            const feed = await createPriceFeedMock(fp(2))
            const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
            await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
            await smartVault.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, usdc.address, feed.address)
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
        await expect(action.call()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
