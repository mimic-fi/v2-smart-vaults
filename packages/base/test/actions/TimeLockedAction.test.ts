import { advanceTime, assertEvent, currentTimestamp, getSigners, MONTH } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { createAction, createSmartVault, Mimic, setupMimic } from '../../dist'

describe('TimeLockedAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('TimeLockedActionMock', mimic, owner, smartVault)
  })

  describe('setTimeLock', () => {
    const period = MONTH

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTimeLockRole = action.interface.getSighash('setTimeLock')
        await action.connect(owner).authorize(owner.address, setTimeLockRole)
        action = action.connect(owner)
      })

      it('sets the time lock', async () => {
        const previousNextResetTime = await action.nextResetTime()

        await action.setTimeLock(period)

        expect(await action.period()).to.be.equal(period)
        expect(await action.nextResetTime()).to.be.equal(previousNextResetTime)
      })

      it('emits an event', async () => {
        const tx = await action.setTimeLock(period)

        await assertEvent(tx, 'TimeLockSet', { period })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTimeLock(period)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    const period = MONTH

    beforeEach('set time lock', async () => {
      const setTimeLockRole = action.interface.getSighash('setTimeLock')
      await action.connect(owner).authorize(owner.address, setTimeLockRole)
      await action.connect(owner).setTimeLock(period)
    })

    beforeEach('call once', async () => {
      await action.call()
      const timestamp = await currentTimestamp()

      expect(await action.nextResetTime()).to.be.equal(timestamp.add(period))
    })

    context('when the time-lock has not expired', () => {
      it('reverts', async () => {
        await expect(action.call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
      })
    })

    context('when the time-lock has expired', () => {
      beforeEach('advance time', async () => {
        await advanceTime(period)
      })

      it('does not revert', async () => {
        await expect(action.call()).not.to.be.reverted
        const timestamp = await currentTimestamp()

        expect(await action.nextResetTime()).to.be.equal(timestamp.add(period))
      })
    })
  })
})
