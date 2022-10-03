import { assertEvent, deploy, fp, getSigners, NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { createWallet, Mimic, setupMimic } from '..'

describe('TokenThresholdAction', () => {
  let action: Contract, wallet: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    wallet = await createWallet(mimic, owner)
    action = await deploy('TokenThresholdActionMock', [owner.address, wallet.address])
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
    const rate = 2
    const token = ZERO_ADDRESS
    const thresholdAmount = fp(2)
    const thresholdToken = NATIVE_TOKEN_ADDRESS

    beforeEach('set threshold', async () => {
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)
      await action.connect(owner).setThreshold(thresholdToken, thresholdAmount)
    })

    beforeEach('mock rate', async () => {
      await mimic.priceOracle.mockRate(token, thresholdToken, fp(rate))
    })

    context('when the given amount is lower than the set limit', () => {
      const amount = thresholdAmount.div(rate).sub(1)

      it('reverts', async () => {
        await expect(action.validateThreshold(token, amount)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
      })
    })

    context('when the given amount is greater than the set limit', () => {
      const amount = thresholdAmount.div(rate).add(1)

      it('does not revert', async () => {
        await expect(action.validateThreshold(token, amount)).not.to.be.reverted
      })
    })
  })
})
