import { assertEvent, deploy, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('BPTSwapper', () => {
  let action: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, balancer: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, balancer] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    action = await deploy('BPTSwapper', [balancer.address, owner.address, mimic.registry.address])
  })

  describe('initialize', () => {
    it('has a reference to the balancer vault', async () => {
      expect(await action.balancerVault()).to.be.equal(balancer.address)
    })
  })

  describe('setPayingGasToken', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setPayingGasTokenRole = action.interface.getSighash('setPayingGasToken')
        await action.connect(owner).authorize(owner.address, setPayingGasTokenRole)
        action = action.connect(owner)
      })

      context('when the given address is not zero', () => {
        it('sets the swap signer', async () => {
          await action.setPayingGasToken(other.address)

          expect(await action.payingGasToken()).to.be.equal(other.address)
        })

        it('emits an event', async () => {
          const tx = await action.setPayingGasToken(other.address)

          await assertEvent(tx, 'PayingGasTokenSet', { payingGasToken: other })
        })
      })

      context('when the given address is zero', () => {
        it('reverts', async () => {
          await expect(action.setPayingGasToken(ZERO_ADDRESS)).to.be.revertedWith('CLAIMER_PAYING_GAS_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setPayingGasToken(other.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
