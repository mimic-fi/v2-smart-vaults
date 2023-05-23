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
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { createSmartVault, Mimic, setupMimic } from '../../../dist'

describe('TimeLockedAction', () => {
  let owner: SignerWithAddress
  let action: Contract, smartVault: Contract, mimic: Mimic

  before('setup dependencies', async () => {
    owner = await getSigner(2)
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
  })

  beforeEach('deploy action', async () => {
    action = await deploy('TimeLockedActionMock', [
      {
        baseConfig: {
          owner: owner.address,
          smartVault: smartVault.address,
        },
        timeLockConfig: {
          delay: 0,
          nextExecutionTimestamp: 0,
        },
      },
    ])
  })

  describe('setTimeLockDelay', () => {
    const delay = MONTH

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
        await action.connect(owner).authorize(owner.address, setTimeLockDelayRole)
        action = action.connect(owner)
      })

      it('sets the time lock delay', async () => {
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

  describe('setTimeLockExpiration', () => {
    const expiration = '123719273'

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setTimeLockExpirationRole = action.interface.getSighash('setTimeLockExpiration')
        await action.connect(owner).authorize(owner.address, setTimeLockExpirationRole)
        action = action.connect(owner)
      })

      it('sets the time lock expiration', async () => {
        const previousTimeLock = await action.getTimeLock()

        await action.setTimeLockExpiration(expiration)

        const timeLock = await action.getTimeLock()
        expect(timeLock.delay).to.be.equal(previousTimeLock.delay)
        expect(timeLock.expiresAt).to.be.equal(expiration)
      })

      it('emits an event', async () => {
        const tx = await action.setTimeLockExpiration(expiration)

        await assertEvent(tx, 'TimeLockExpirationSet', { expiration })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setTimeLockExpiration(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    context('when no initial expiration timestamp is set', () => {
      const nextExecutionTimestamp = 0

      context('without time-lock delay', () => {
        const delay = 0

        beforeEach('deploy action', async () => {
          action = await deploy('TimeLockedActionMock', [
            {
              baseConfig: {
                owner: owner.address,
                smartVault: smartVault.address,
              },
              timeLockConfig: {
                delay,
                nextExecutionTimestamp,
              },
            },
          ])
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
          await assertNoEvent(tx, 'TimeLockExpirationSet')

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(0)
          expect(timeLock.expiresAt).to.be.equal(0)
        })

        it('can be updated at any time in the future', async () => {
          const newTimeLockDelay = DAY
          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.connect(owner).authorize(owner.address, setTimeLockDelayRole)
          await action.connect(owner).setTimeLockDelay(newTimeLockDelay)

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(newTimeLockDelay)
          expect(timeLock.expiresAt).to.be.equal(0)

          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpirationSet')
          await expect(action.call()).to.be.revertedWith('ACTION_TIME_LOCK_NOT_EXPIRED')

          const { expiresAt: previousExpiration } = await action.getTimeLock()
          await advanceTime(newTimeLockDelay)
          const tx2 = await action.call()
          await assertEvent(tx2, 'TimeLockExpirationSet')

          const updatedTimeLock = await action.getTimeLock()
          expect(updatedTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(updatedTimeLock.expiresAt).to.be.equal(previousExpiration.add(newTimeLockDelay))
        })
      })

      context('with an initial timestamp', () => {
        const delay = MONTH

        beforeEach('deploy action', async () => {
          action = await deploy('TimeLockedActionMock', [
            {
              baseConfig: {
                owner: owner.address,
                smartVault: smartVault.address,
              },
              timeLockConfig: {
                delay,
                nextExecutionTimestamp,
              },
            },
          ])
        })

        it('has a time-lock delay', async () => {
          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(delay)
          expect(timeLock.expiresAt).to.be.equal(0)
        })

        it('has no initial delay', async () => {
          await expect(action.call()).not.to.be.reverted
        })

        it('must wait to be valid again after the first execution', async () => {
          await action.call()
          await expect(action.call()).to.be.revertedWith('ACTION_TIME_LOCK_NOT_EXPIRED')

          const { expiresAt: previousExpiration } = await action.getTimeLock()
          await advanceTime(delay)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(delay)
          expect(timeLock.expiresAt).to.be.equal(previousExpiration.add(delay))
        })

        it('can be changed at any time in the future without affecting the previous expiration date', async () => {
          await action.call()
          const previousTimeLock = await action.getTimeLock()

          const newTimeLockDelay = DAY
          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.connect(owner).authorize(owner.address, setTimeLockDelayRole)
          await action.connect(owner).setTimeLockDelay(newTimeLockDelay)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(newTimeLock.expiresAt).to.be.equal(previousTimeLock.expiresAt)

          const { expiresAt: previousExpiration } = await action.getTimeLock()
          await setNextBlockTimestamp(previousTimeLock.expiresAt)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          const updatedTimeLock = await action.getTimeLock()
          expect(updatedTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(updatedTimeLock.expiresAt).to.be.equal(previousExpiration.add(newTimeLockDelay))
        })

        it('can be unset at any time in the future without affecting the previous expiration date', async () => {
          await action.call()
          const initialTimeLock = await action.getTimeLock()

          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.connect(owner).authorize(owner.address, setTimeLockDelayRole)
          await action.connect(owner).setTimeLockDelay(0)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(0)
          expect(newTimeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)

          const { expiresAt: previousExpiration } = await action.getTimeLock()
          await setNextBlockTimestamp(initialTimeLock.expiresAt)
          const tx = await action.call()
          await assertNoEvent(tx, 'TimeLockExpirationSet')

          const currentTimeLock = await action.getTimeLock()
          expect(currentTimeLock.delay).to.be.equal(0)
          expect(currentTimeLock.expiresAt).to.be.equal(previousExpiration)
        })
      })
    })

    context('when an initial expiration timestamp is set', () => {
      let initialExpirationTimestamp: BigNumber
      const initialDelay = 2 * MONTH

      beforeEach('set initial timestamp', async () => {
        initialExpirationTimestamp = (await currentTimestamp()).add(initialDelay)
      })

      context('without time-lock delay', () => {
        const delay = 0

        beforeEach('deploy action', async () => {
          action = await deploy('TimeLockedActionMock', [
            {
              baseConfig: {
                owner: owner.address,
                smartVault: smartVault.address,
              },
              timeLockConfig: {
                delay,
                nextExecutionTimestamp: initialExpirationTimestamp,
              },
            },
          ])
        })

        it('has an initial expiration timestamp', async () => {
          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(0)
          expect(timeLock.expiresAt).to.be.equal(initialExpirationTimestamp)
        })

        it('can be validated any number of times right after the initial delay', async () => {
          const initialTimeLock = await action.getTimeLock()

          await expect(action.call()).to.be.revertedWith('ACTION_TIME_LOCK_NOT_EXPIRED')

          await advanceTime(initialExpirationTimestamp)
          const tx = await action.call()
          await assertNoEvent(tx, 'TimeLockExpirationSet')

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(initialTimeLock.delay)
          expect(timeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)
        })

        it('can be changed at any time in the future without affecting the previous expiration date', async () => {
          const initialTimeLock = await action.getTimeLock()

          const newTimeLockDelay = DAY
          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.connect(owner).authorize(owner.address, setTimeLockDelayRole)
          await action.connect(owner).setTimeLockDelay(newTimeLockDelay)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(newTimeLock.expiresAt).to.be.equal(initialTimeLock.expiresAt)

          await setNextBlockTimestamp(initialTimeLock.expiresAt)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          const now = await currentTimestamp()
          const updatedTimeLock = await action.getTimeLock()
          expect(updatedTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(updatedTimeLock.expiresAt).to.be.equal(now.add(newTimeLockDelay))
        })
      })

      context('with a time-lock delay', () => {
        const delay = MONTH

        beforeEach('deploy action', async () => {
          action = await deploy('TimeLockedActionMock', [
            {
              baseConfig: {
                owner: owner.address,
                smartVault: smartVault.address,
              },
              timeLockConfig: {
                delay,
                nextExecutionTimestamp: initialExpirationTimestamp,
              },
            },
          ])
        })

        it('has a time-lock with an initial delay', async () => {
          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(delay)
          expect(timeLock.expiresAt).to.be.equal(initialExpirationTimestamp)
        })

        it('can be validated once right after the initial delay', async () => {
          await expect(action.call()).to.be.revertedWith('ACTION_TIME_LOCK_NOT_EXPIRED')

          await setNextBlockTimestamp(initialExpirationTimestamp)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          const timeLock = await action.getTimeLock()
          expect(timeLock.delay).to.be.equal(delay)
          expect(timeLock.expiresAt).to.be.equal(initialExpirationTimestamp.add(delay))

          await expect(action.call()).to.be.revertedWith('ACTION_TIME_LOCK_NOT_EXPIRED')
        })

        it('can be changed at any time in the future without affecting the previous expiration date', async () => {
          const newTimeLockDelay = DAY
          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.connect(owner).authorize(owner.address, setTimeLockDelayRole)
          await action.connect(owner).setTimeLockDelay(newTimeLockDelay)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(newTimeLock.expiresAt).to.be.equal(initialExpirationTimestamp)

          await setNextBlockTimestamp(initialExpirationTimestamp)
          const tx = await action.call()
          await assertEvent(tx, 'TimeLockExpirationSet')

          const updatedTimeLock = await action.getTimeLock()
          expect(updatedTimeLock.delay).to.be.equal(newTimeLockDelay)
          expect(updatedTimeLock.expiresAt).to.be.equal(initialExpirationTimestamp.add(newTimeLockDelay))
        })

        it('can be unset at any time in the future without affecting the previous expiration date', async () => {
          const setTimeLockDelayRole = action.interface.getSighash('setTimeLockDelay')
          await action.connect(owner).authorize(owner.address, setTimeLockDelayRole)
          await action.connect(owner).setTimeLockDelay(0)

          const newTimeLock = await action.getTimeLock()
          expect(newTimeLock.delay).to.be.equal(0)
          expect(newTimeLock.expiresAt).to.be.equal(initialExpirationTimestamp)

          await setNextBlockTimestamp(initialExpirationTimestamp)
          const tx = await action.call()
          await assertNoEvent(tx, 'TimeLockExpirationSet')

          const currentTimeLock = await action.getTimeLock()
          expect(currentTimeLock.delay).to.be.equal(0)
          expect(currentTimeLock.expiresAt).to.be.equal(initialExpirationTimestamp)
        })
      })
    })
  })
})
