import { advanceTime, currentTimestamp, deploy, MONTH } from '@mimic-fi/v2-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('TimeLock', () => {
  let config: Contract

  beforeEach('deploy time-lock config', async () => {
    config = await deploy('TimeLockMock')
  })

  describe('initialize', () => {
    const delay = MONTH

    context('when the time-lock has not been initialized before', () => {
      context('when no initial delay was set', () => {
        const initialDelay = 0

        it('can be initialized', async () => {
          expect(await config.isSet()).to.be.false

          await config.initialize(initialDelay, delay)
          expect(await config.isSet()).to.be.true

          const now = await currentTimestamp()
          const timeLock = await config.getTimeLock()
          expect(timeLock.delay).to.be.equal(delay)
          expect(timeLock.nextResetTime).to.be.equal(now)
        })
      })

      context('when an initial delay is set', () => {
        const initialDelay = 2 * MONTH

        it('can be initialized', async () => {
          expect(await config.isSet()).to.be.false

          await config.initialize(initialDelay, delay)
          expect(await config.isSet()).to.be.true

          const now = await currentTimestamp()
          const timeLock = await config.getTimeLock()
          expect(timeLock.delay).to.be.equal(delay)
          expect(timeLock.nextResetTime).to.be.equal(now.add(initialDelay))
        })
      })
    })

    context('when the time-lock has been initialized before', () => {
      context('when no initial delay was set', () => {
        beforeEach('initialize', async () => {
          await config.setDelay(delay)
        })

        it('reverts', async () => {
          expect(await config.isSet()).to.be.true
          await expect(config.initialize(0, delay)).to.be.revertedWith('TIME_LOCK_ALREADY_INITIALIZED')
        })
      })

      context('when an initial delay was set', () => {
        const initialDelay = 2 * MONTH

        beforeEach('initialize', async () => {
          await config.initialize(initialDelay, delay)
        })

        it('reverts', async () => {
          expect(await config.isSet()).to.be.true
          await expect(config.initialize(initialDelay, delay)).to.be.revertedWith('TIME_LOCK_ALREADY_INITIALIZED')
        })
      })
    })
  })

  describe('validate', () => {
    context('when the time-lock has not been initialized', () => {
      it('is considered valid', async () => {
        expect(await config.isValid()).to.be.true
        await expect(config.validate()).not.to.be.reverted
      })

      it('is not updated', async () => {
        const previousTimeLock = await config.getTimeLock()

        await config.validate()

        const currentTimeLock = await config.getTimeLock()
        expect(currentTimeLock.delay).to.be.equal(previousTimeLock.delay)
        expect(currentTimeLock.nextResetTime).to.be.equal(previousTimeLock.nextResetTime)
      })
    })

    context('when the time-lock has been initialized', () => {
      const delay = MONTH

      context('when no initial delay was set', () => {
        beforeEach('initialize', async () => {
          await config.setDelay(delay)
        })

        it('applies the time-lock correctly', async () => {
          expect(await config.isValid()).to.be.true
          await expect(config.validate()).not.to.be.reverted

          const now = await currentTimestamp()
          const timeLock = await config.getTimeLock()
          expect(timeLock.delay).to.be.equal(delay)
          expect(timeLock.nextResetTime).to.be.equal(now.add(delay))
        })
      })

      context('when an initial delay was set', () => {
        const initialDelay = 2 * MONTH

        beforeEach('initialize', async () => {
          await config.initialize(initialDelay, delay)
        })

        it('reverts', async () => {
          expect(await config.isValid()).to.be.false
          await expect(config.validate()).to.be.revertedWith('TIME_LOCK_FORBIDDEN')

          await advanceTime(initialDelay)

          expect(await config.isValid()).to.be.true
          await expect(config.validate()).not.to.be.reverted

          const now = await currentTimestamp()
          const timeLock = await config.getTimeLock()
          expect(timeLock.delay).to.be.equal(delay)
          expect(timeLock.nextResetTime).to.be.equal(now.add(delay))
        })
      })
    })
  })
})
