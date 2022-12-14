import { assertIndirectEvent, fp, getSigners, NATIVE_TOKEN_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import { createAction, createSmartVault, createTokenMock, Mimic, setupMimic } from '..'

describe('WithdrawalAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('ReceiverActionMock', mimic, owner, smartVault)
  })

  describe('withdraw', () => {
    const balance = fp(1)

    context('when the sender has permissions', async () => {
      beforeEach('authorize sender', async () => {
        const withdrawRole = action.interface.getSighash('withdraw')
        await action.connect(owner).authorize(owner.address, withdrawRole)
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

          await action.withdraw(token, balance)

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

          await action.withdraw(token.address, balance)

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
        await expect(action.withdraw(NATIVE_TOKEN_ADDRESS, balance)).to.be.revertedWith('SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('collect', () => {
    const balance = fp(1)

    beforeEach('authorize action', async () => {
      const collectRole = smartVault.interface.getSighash('collect')
      await smartVault.connect(owner).authorize(action.address, collectRole)
    })

    context('when the token is ETH', () => {
      const token = NATIVE_TOKEN_ADDRESS

      beforeEach('fund action', async () => {
        await other.sendTransaction({ to: action.address, value: balance })
      })

      it('wraps it and collects it from the smart vault', async () => {
        const previousActionNativeTokenBalance = await ethers.provider.getBalance(action.address)
        const previousSmartVaultNativeTokenBalance = await ethers.provider.getBalance(smartVault.address)
        const previousActionWrappedNativeTokenBalance = await mimic.wrappedNativeToken.balanceOf(action.address)
        const previousSmartVaultWrappedNativeTokenBalance = await mimic.wrappedNativeToken.balanceOf(smartVault.address)

        const tx = await action.collect(token, balance)

        await assertIndirectEvent(tx, smartVault.interface, 'Collect', {
          from: action,
          token: mimic.wrappedNativeToken,
          collected: balance,
          data: '0x',
        })

        const currentActionNativeTokenBalance = await ethers.provider.getBalance(action.address)
        expect(currentActionNativeTokenBalance).to.be.equal(previousActionNativeTokenBalance.sub(balance))

        const currentActionWrappedNativeTokenBalance = await mimic.wrappedNativeToken.balanceOf(action.address)
        expect(currentActionWrappedNativeTokenBalance).to.be.equal(previousActionWrappedNativeTokenBalance)

        const currentSmartVaultNativeTokenBalance = await ethers.provider.getBalance(smartVault.address)
        expect(currentSmartVaultNativeTokenBalance).to.be.equal(previousSmartVaultNativeTokenBalance)

        const currentSmartVaultWrappedNativeTokenBalance = await mimic.wrappedNativeToken.balanceOf(smartVault.address)
        const expectedSmartVaultWrappedNativeTokenBalance = previousSmartVaultWrappedNativeTokenBalance.add(balance)
        expect(currentSmartVaultWrappedNativeTokenBalance).to.be.equal(expectedSmartVaultWrappedNativeTokenBalance)
      })
    })

    context('when the token is an ERC20', () => {
      let token: Contract

      beforeEach('fund action', async () => {
        token = await createTokenMock()
        await token.mint(action.address, balance)
      })

      it('collects it from the smart vault', async () => {
        const previousActionBalance = await token.balanceOf(action.address)
        const previousSmartVaultBalance = await token.balanceOf(smartVault.address)

        const tx = await action.collect(token.address, balance)

        await assertIndirectEvent(tx, smartVault.interface, 'Collect', {
          from: action,
          token,
          collected: balance,
          data: '0x',
        })

        const currentActionBalance = await token.balanceOf(action.address)
        expect(currentActionBalance).to.be.equal(previousActionBalance.sub(balance))

        const currentSmartVaultBalance = await token.balanceOf(smartVault.address)
        expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(balance))
      })
    })
  })
})
