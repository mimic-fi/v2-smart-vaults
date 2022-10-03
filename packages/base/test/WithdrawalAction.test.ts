import { assertEvent, assertIndirectEvent, deploy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { createTokenMock, createWallet, Mimic, setupMimic } from '..'

describe('WithdrawalAction', () => {
  let action: Contract, wallet: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    wallet = await createWallet(mimic, owner)
    action = await deploy('WithdrawalActionMock', [owner.address, wallet.address])
  })

  beforeEach('authorize action', async () => {
    const withdrawRole = wallet.interface.getSighash('withdraw')
    await wallet.connect(owner).authorize(action.address, withdrawRole)
  })

  describe('setRecipient', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setRecipientRole = action.interface.getSighash('setRecipient')
        await action.connect(owner).authorize(owner.address, setRecipientRole)
        action = action.connect(owner)
      })

      context('when the new address is not zero', async () => {
        let newRecipient: SignerWithAddress

        beforeEach('set new recipient', async () => {
          newRecipient = other
        })

        it('sets the recipient', async () => {
          await action.setRecipient(newRecipient.address)

          const recipient = await action.recipient()
          expect(recipient).to.be.equal(newRecipient.address)
        })

        it('emits an event', async () => {
          const tx = await action.setRecipient(newRecipient.address)
          await assertEvent(tx, 'RecipientSet', { recipient: newRecipient })
        })
      })

      context('when the new address is zero', async () => {
        const newRecipient = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setRecipient(newRecipient)).to.be.revertedWith('RECIPIENT_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setRecipient(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('withdraw', () => {
    const amount = fp(10)

    let token: Contract
    let recipient: SignerWithAddress

    beforeEach('deploy token and fund wallet', async () => {
      token = await createTokenMock()
      await token.mint(wallet.address, amount)
    })

    beforeEach('set recipient', async () => {
      recipient = other
      const setRecipientRole = action.interface.getSighash('setRecipient')
      await action.connect(owner).authorize(owner.address, setRecipientRole)
      await action.connect(owner).setRecipient(recipient.address)
    })

    it('can request to withdraw all funds of a token from the wallet', async () => {
      await token.mint(wallet.address, amount)

      const tx = await action.withdrawAll(token.address)

      await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
        token,
        withdrawn: amount.mul(2),
        recipient,
        data: '0x',
      })
    })

    it('can request to withdraw the requested amount of a token from the wallet', async () => {
      const tx = await action.withdraw(token.address, amount)

      await assertIndirectEvent(tx, wallet.interface, 'Withdraw', { token, withdrawn: amount, recipient, data: '0x' })
    })
  })
})
