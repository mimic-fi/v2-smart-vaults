import { advanceTime, assertEvent, deploy, getSigners, MONTH, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('TimeLockedAction', () => {
  let action: Contract, wallet: Contract
  let admin: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, admin, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    wallet = await deploy('WalletMock', [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS])
    action = await deploy('TimeLockedActionMock', [admin.address, wallet.address])
  })

  describe('setTimeLock', () => {
    const period = MONTH

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTimeLockRole = action.interface.getSighash('setTimeLock')
        await action.connect(admin).authorize(admin.address, setTimeLockRole)
        action = action.connect(admin)
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

  describe('execute', () => {
    const period = MONTH

    beforeEach('set time lock', async () => {
      const setTimeLockRole = action.interface.getSighash('setTimeLock')
      await action.connect(admin).authorize(admin.address, setTimeLockRole)
      await action.connect(admin).setTimeLock(period)
    })

    beforeEach('execute once', async () => {
      const previousNextResetTime = await action.nextResetTime()

      await action.execute()

      expect(await action.nextResetTime()).to.be.equal(previousNextResetTime.add(period))
    })

    context('when the time-lock has not expired', () => {
      it('reverts', async () => {
        await expect(action.execute()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
      })
    })

    context('when the time-lock has expired', () => {
      beforeEach('advance time', async () => {
        await advanceTime(period)
      })

      it('does not revert', async () => {
        const previousNextResetTime = await action.nextResetTime()

        await expect(action.execute()).not.to.be.reverted

        expect(await action.nextResetTime()).to.be.equal(previousNextResetTime.add(period))
      })
    })
  })
})
