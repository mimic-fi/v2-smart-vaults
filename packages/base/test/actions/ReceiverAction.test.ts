import { deploy, fp, getSigners, NATIVE_TOKEN_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import { createSmartVault, createTokenMock, Mimic, setupMimic } from '../../dist'

describe('ReceiverAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('ReceiverActionMock', [smartVault.address, owner.address, mimic.registry.address])
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
          const previousActionBalance = await ethers.provider.getBalance(action.address)
          const previousSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)

          await action.transferToSmartVault(token, balance)

          const currentActionBalance = await ethers.provider.getBalance(action.address)
          expect(currentActionBalance).to.be.equal(previousActionBalance.sub(balance))

          const currentSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
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
          const previousActionBalance = await token.balanceOf(action.address)
          const previousSmartVaultBalance = await token.balanceOf(smartVault.address)

          await action.transferToSmartVault(token.address, balance)

          const currentActionBalance = await token.balanceOf(action.address)
          expect(currentActionBalance).to.be.equal(previousActionBalance.sub(balance))

          const currentSmartVaultBalance = await token.balanceOf(smartVault.address)
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
