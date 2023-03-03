import {
  advanceTime,
  assertEvent,
  assertNoEvent,
  currentTimestamp,
  DAY,
  deploy,
  getSigner,
  MONTH,
  setNextBlockTimestamp,
} from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('TimeLockConfig', () => {
  let action: Contract, admin: SignerWithAddress

  before('load admin', async () => {
    admin = await getSigner(2)
  })

  describe('setTimeLockDelay', () => {
    const delay = MONTH

    beforeEach('deploy action', async () => {
      action = await deploy('TimeLockConfigMock', [0, 0])
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
        await action.authorize(admin.address, setTimeLockDelayRole)
        action = action.connect(admin)
      })

      it('sets the time lock', async () => {
        const previousTimeLock = await action.getTimeLock()

        await action.setTimeLockDelay(delay)

        const timeLock = await action.getTimeLock()
        expect(timeLock.delay).to.be.equal(delay)
        expect(timeLock.expiresAt).to.be.equal(previousTimeLock.expiresAt)
      })

      it('emits an event', async () => {
        const tx = await action.setTimeLockDelay(delay)

        await assertEvent(tx, 'TimeLockDelaySet', { delay })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setTimeLockDelay(delay)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('validate', () => {
    context('without initial delay', () => {
      const initialDelay = 0

      context('without time-lock delay', () => {
        const timeLockDelay = 0

        beforeEach('deploy action', async () => {
          action = await deploy('TimeLockConfigMock', [initialDelay, timeLockDelay])
        })

        it('has no time-lock delay', async () => {
          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(0)
          expect(timeLock.expiresAt).to.be.equal(0)
        })

        it('has no initial delay', async () => {
          await expect(action.call()).not.to.be.reverted
        })

        it('does not update the expiration date', async () => {
          const tx = await action.call()
          await assertNoEvent(tx, 'TimeLockExpireSet')

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(0)
          expect(timeLock.expiresAt).to.be.equal(0)
        })

        it('can be updated at any time in the future', async () => {
          const newTimeLockDelay = DAY
          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.authorize(admin.address, setTimeLockDelayRole)
          await action.connect(admin).setTimeLockDelay(newTimeLockDelay)

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(newTimeLockDelay)
          expect(timeLock.expiresAt).to.be.equal(0)

          await action.call()
          await expect(action.call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')

          await advanceTime(newTimeLockDelay)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpireSet')

          const now = await currentTimestamp()
          const updatedTimeLock = await action.getTimeLock()
          expect(updatedTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(updatedTimeLock.expiresAt).to.be.equal(now.add(newTimeLockDelay))
        })
      })

      context('with time-lock delay', () => {
        const timeLockDelay = MONTH

        beforeEach('deploy action', async () => {
          action = await deploy('TimeLockConfigMock', [initialDelay, timeLockDelay])
        })

        it('has a time-lock delay', async () => {
          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(timeLockDelay)
          expect(timeLock.expiresAt).to.be.equal(0)
        })

        it('has no initial delay', async () => {
          await expect(action.call()).not.to.be.reverted
        })

        it('must wait to be valid again after the first execution', async () => {
          await action.call()
          await expect(action.call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')

          await advanceTime(timeLockDelay)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpireSet')

          const now = await currentTimestamp()
          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(timeLockDelay)
          expect(timeLock.expiresAt).to.be.equal(now.add(timeLockDelay))
        })

        it('can be changed at any time in the future without affecting the previous expiration date', async () => {
          await action.call()
          const previousTimeLock = await action.getTimeLock()

          const newTimeLockDelay = DAY
          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.authorize(admin.address, setTimeLockDelayRole)
          await action.connect(admin).setTimeLockDelay(newTimeLockDelay)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(newTimeLock.expiresAt).to.be.equal(previousTimeLock.expiresAt)

          await setNextBlockTimestamp(previousTimeLock.expiresAt)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpireSet')

          const now = await currentTimestamp()
          const updatedTimeLock = await action.getTimeLock()
          expect(updatedTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(updatedTimeLock.expiresAt).to.be.equal(now.add(newTimeLockDelay))
        })

        it('can be unset at any time in the future without affecting the previous expiration date', async () => {
          await action.call()
          const initialTimeLock = await action.getTimeLock()

          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.authorize(admin.address, setTimeLockDelayRole)
          await action.connect(admin).setTimeLockDelay(0)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(0)
          expect(newTimeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)

          await setNextBlockTimestamp(initialTimeLock.expiresAt)
          const tx = await action.call()
          await assertNoEvent(tx, 'TimeLockExpireSet')

          const currentTimeLock = await action.getTimeLock()
          expect(currentTimeLock.delay).to.be.equal(0)
          expect(currentTimeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)
        })
      })
    })

    context('when an initial delay', () => {
      const initialDelay = 2 * MONTH

      context('without time-lock delay', () => {
        const timeLockDelay = 0

        beforeEach('deploy action', async () => {
          action = await deploy('TimeLockConfigMock', [initialDelay, timeLockDelay])
        })

        it('has only an initial delay', async () => {
          const now = await currentTimestamp()

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(0)
          expect(timeLock.expiresAt).to.be.equal(now.add(initialDelay))
        })

        it('can be validated any number of times right after the initial delay', async () => {
          const initialTimeLock = await action.getTimeLock()

          await expect(action.call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')

          await advanceTime(initialDelay)
          const tx = await action.call()
          await assertNoEvent(tx, 'TimeLockExpireSet')

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(initialTimeLock.delay)
          expect(timeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)
        })

        it('can be changed at any time in the future without affecting the previous expiration date', async () => {
          const initialTimeLock = await action.getTimeLock()

          const newTimeLockDelay = DAY
          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.authorize(admin.address, setTimeLockDelayRole)
          await action.connect(admin).setTimeLockDelay(newTimeLockDelay)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(newTimeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)

          await setNextBlockTimestamp(initialTimeLock.expiresAt)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpireSet')

          const now = await currentTimestamp()
          const updatedTimeLock = await action.getTimeLock()
          expect(updatedTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(updatedTimeLock.expiresAt).to.be.equal(now.add(newTimeLockDelay))
        })
      })

      context('with a time-lock delay', () => {
        const timeLockDelay = MONTH

        beforeEach('deploy action', async () => {
          action = await deploy('TimeLockConfigMock', [initialDelay, timeLockDelay])
        })

        it('has a time-lock with an initial delay', async () => {
          const now = await currentTimestamp()

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(timeLockDelay)
          expect(timeLock.expiresAt).to.be.equal(now.add(initialDelay))
        })

        it('can be validated once right after the initial delay', async () => {
          await expect(action.call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')

          await advanceTime(initialDelay)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpireSet')

          const now = await currentTimestamp()
          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(timeLockDelay)
          expect(timeLock.expiresAt).to.be.equal(now.add(timeLockDelay))

          await expect(action.call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
        })

        it('can be changed at any time in the future without affecting the previous expiration date', async () => {
          const initialTimeLock = await action.getTimeLock()

          const newTimeLockDelay = DAY
          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.authorize(admin.address, setTimeLockDelayRole)
          await action.connect(admin).setTimeLockDelay(newTimeLockDelay)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(newTimeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)

          await setNextBlockTimestamp(initialTimeLock.expiresAt)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpireSet')

          const now = await currentTimestamp()
          const updatedTimeLock = await action.getTimeLock()
          expect(updatedTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(updatedTimeLock.expiresAt).to.be.equal(now.add(newTimeLockDelay))
        })

        it('can be unset at any time in the future without affecting the previous expiration date', async () => {
          const initialTimeLock = await action.getTimeLock()

          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.authorize(admin.address, setTimeLockDelayRole)
          await action.connect(admin).setTimeLockDelay(0)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(0)
          expect(newTimeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)

          await setNextBlockTimestamp(initialTimeLock.expiresAt)
          const tx = await action.call()
          await assertNoEvent(tx, 'TimeLockExpireSet')

          const currentTimeLock = await action.getTimeLock()
          expect(currentTimeLock.delay).to.be.equal(0)
          expect(currentTimeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)
        })
      })
    })
  })
})
