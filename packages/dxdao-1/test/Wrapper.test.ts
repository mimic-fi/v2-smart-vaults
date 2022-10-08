import { assertEvent, assertIndirectEvent, fp, getSigners } from '@mimic-fi/v2-helpers'
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

describe('Wrapper', () => {
  let action: Contract, wallet: Contract, mimic: Mimic
  let owner: SignerWithAddress, recipient: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, recipient, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    wallet = await createWallet(mimic, owner)
    action = await createAction('Wrapper', mimic, owner, wallet)
  })

  beforeEach('authorize action', async () => {
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

  describe('call', () => {
    const balance = fp(0.5)

    beforeEach('fund wallet token', async () => {
      await owner.sendTransaction({ to: wallet.address, value: balance })
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
            const setPriceFeedRole = wallet.interface.getSighash('setPriceFeed')
            await wallet.connect(owner).authorize(owner.address, setPriceFeedRole)
            await wallet.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, usdc.address, feed.address)
          })

          it('calls the wrap primitive', async () => {
            const tx = await action.call()

            await assertIndirectEvent(tx, wallet.interface, 'Wrap', { wrapped: balance, data: '0x' })
          })

          it('calls the withdraw primitive', async () => {
            const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

            const tx = await action.call()

            const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
            const refund = currentBalance.sub(previousBalance)

            await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
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

            const tx = await action.call()

            const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
            if (refunds) await assertRelayedBaseCost(tx, currentBalance.sub(previousBalance))
            else expect(currentBalance).to.be.equal(previousBalance)
          })
        })

        context('when the min amount does not pass the threshold', () => {
          beforeEach('set threshold', async () => {
            const usdc = await createTokenMock()
            const setThresholdRole = action.interface.getSighash('setThreshold')
            await action.connect(owner).authorize(owner.address, setThresholdRole)
            await action.connect(owner).setThreshold(usdc.address, balance.mul(3))

            const feed = await createPriceFeedMock(fp(2))
            const setPriceFeedRole = wallet.interface.getSighash('setPriceFeed')
            await wallet.connect(owner).authorize(owner.address, setPriceFeedRole)
            await wallet.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, usdc.address, feed.address)
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
