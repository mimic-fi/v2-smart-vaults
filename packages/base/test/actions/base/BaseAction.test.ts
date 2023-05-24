import { assertEvent, deploy, fp, getSigners, NATIVE_TOKEN_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { createSmartVault, createTokenMock, Mimic, setupMimic } from '../../../dist'

describe('BaseAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('setup dependencies', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
  })

  beforeEach('deploy action', async () => {
    action = await deploy('BaseAction', [
      {
        owner: owner.address,
        smartVault: smartVault.address,
      },
    ])
  })

  describe('pause', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const pauseRole = action.interface.getSighash('pause')
        await action.connect(owner).authorize(owner.address, pauseRole)
        action = action.connect(owner)
      })

      context('when the action is not paused', () => {
        it('can be paused', async () => {
          const tx = await action.pause()

          expect(await action.isPaused()).to.be.true

          await assertEvent(tx, 'Paused')
        })
      })

      context('when the action is paused', () => {
        beforeEach('pause', async () => {
          await action.pause()
        })

        it('cannot be paused', async () => {
          await expect(action.pause()).to.be.revertedWith('ACTION_ALREADY_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.pause()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('unpause', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const unpauseRole = action.interface.getSighash('unpause')
        await action.connect(owner).authorize(owner.address, unpauseRole)
        action = action.connect(owner)
      })

      context('when the action is not paused', () => {
        it('cannot be unpaused', async () => {
          await expect(action.unpause()).to.be.revertedWith('ACTION_ALREADY_UNPAUSED')
        })
      })

      context('when the action is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = action.interface.getSighash('pause')
          await action.connect(owner).authorize(owner.address, pauseRole)
          await action.pause()
        })

        it('can be unpaused', async () => {
          const tx = await action.unpause()

          expect(await action.isPaused()).to.be.false

          await assertEvent(tx, 'Unpaused')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.unpause()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('transferToSmartVault', () => {
    const balance = fp(1)

    context('when the sender has permissions', async () => {
      beforeEach('authorize sender', async () => {
        const transferToSmartVaultRole = action.interface.getSighash('transferToSmartVault')
        await action.connect(owner).authorize(owner.address, transferToSmartVaultRole)
        action = action.connect(owner)
      })

      context('when the token is ETH', () => {
        const token = NATIVE_TOKEN_ADDRESS

        beforeEach('fund action', async () => {
          await other.sendTransaction({ to: action.address, value: balance })
        })

        it('transfers it to smart vault', async () => {
          const previousActionBalance = await action.getActionBalance(token)
          const previousSmartVaultBalance = await action.getSmartVaultBalance(token)

          await action.transferToSmartVault(token, balance)

          const currentActionBalance = await action.getActionBalance(token)
          expect(currentActionBalance).to.be.equal(previousActionBalance.sub(balance))

          const currentSmartVaultBalance = await action.getSmartVaultBalance(token)
          expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(balance))
        })
      })

      context('when the token is an ERC20', () => {
        let token: Contract

        beforeEach('fund action', async () => {
          token = await createTokenMock()
          await token.mint(action.address, balance)
        })

        it('transfers it to smart vault', async () => {
          const previousActionBalance = await action.getActionBalance(token.address)
          const previousSmartVaultBalance = await action.getSmartVaultBalance(token.address)

          await action.transferToSmartVault(token.address, balance)

          const currentActionBalance = await action.getActionBalance(token.address)
          expect(currentActionBalance).to.be.equal(previousActionBalance.sub(balance))

          const currentSmartVaultBalance = await action.getSmartVaultBalance(token.address)
          expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(balance))
        })
      })
    })

    context('when the sender does not have permissions', async () => {
      beforeEach('set sender', async () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.transferToSmartVault(NATIVE_TOKEN_ADDRESS, balance)).to.be.revertedWith(
          'SENDER_NOT_ALLOWED'
        )
      })
    })
  })
})
