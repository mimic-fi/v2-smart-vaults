import { assertEvent, deploy, fp, getSigners } from '@mimic-fi/v2-helpers'
import { createSmartVault, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

describe('Receiver', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic, owner: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('Receiver', [smartVault.address])
  })

  describe('call', () => {
    context('when it has some balance', () => {
      const balance = fp(0.5)

      beforeEach('send value', async () => {
        await owner.sendTransaction({ to: action.address, value: balance })
      })

      it('forwards balance to the smart vault', async () => {
        const previousActionBalance = await ethers.provider.getBalance(action.address)
        const previousSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)

        await action.call()

        const currentActionBalance = await ethers.provider.getBalance(action.address)
        expect(currentActionBalance).to.be.equal(previousActionBalance.sub(balance))

        const currentSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
        expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(balance))
      })

      it('emits an Executed event', async () => {
        const tx = await action.call()

        await assertEvent(tx, 'Executed')
      })
    })

    context('when it does not have balance', () => {
      it('reverts', async () => {
        await expect(action.call()).to.be.revertedWith('RECEIVER_BALANCE_ZERO')
      })
    })
  })
})
