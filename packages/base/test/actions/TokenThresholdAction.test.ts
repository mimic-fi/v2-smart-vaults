import { assertEvent, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { createAction, createSmartVault, Mimic, setupMimic } from '../../dist'
import { createPriceFeedMock, createTokenMock } from '../../src/samples'

describe('TokenThresholdAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('TokenThresholdActionMock', mimic, owner, smartVault)
  })

  describe('setThreshold', () => {
    const amount = fp(1)
    const token = ZERO_ADDRESS

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setThresholdRole = action.interface.getSighash('setThreshold')
        await action.connect(owner).authorize(owner.address, setThresholdRole)
        action = action.connect(owner)
      })

      it('sets the swap signer', async () => {
        await action.setThreshold(token, amount)

        expect(await action.thresholdToken()).to.be.equal(token)
        expect(await action.thresholdAmount()).to.be.equal(amount)
      })

      it('emits an event', async () => {
        const tx = await action.setThreshold(token, amount)

        await assertEvent(tx, 'ThresholdSet', { token, amount })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setThreshold(token, amount)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('validate', () => {
    let token: Contract, thresholdToken: Contract

    const rate = 2
    const thresholdAmount = fp(2)

    beforeEach('deploy tokens', async () => {
      token = await createTokenMock()
      thresholdToken = await createTokenMock()
    })

    beforeEach('set threshold', async () => {
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)
      await action.connect(owner).setThreshold(thresholdToken.address, thresholdAmount)
    })

    beforeEach('mock price feed', async () => {
      const feed = await createPriceFeedMock(fp(rate))
      const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
      await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
      await smartVault.connect(owner).setPriceFeed(token.address, thresholdToken.address, feed.address)
    })

    context('when the given amount is lower than the set limit', () => {
      const amount = thresholdAmount.div(rate).sub(1)

      it('reverts', async () => {
        await expect(action.validateThreshold(token.address, amount)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
      })
    })

    context('when the given amount is greater than the set limit', () => {
      const amount = thresholdAmount.div(rate).add(1)

      it('does not revert', async () => {
        await expect(action.validateThreshold(token.address, amount)).not.to.be.reverted
      })
    })
  })
})
