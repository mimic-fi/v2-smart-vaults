import { assertEvent, assertIndirectEvent, deploy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('WithdrawalAction', () => {
  let action: Contract, wallet: Contract, token: Contract
  let admin: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, admin, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    token = await deploy('TokenMock', ['TKN'])
    wallet = await deploy('WalletMock', [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS])
    action = await deploy('WithdrawalActionMock', [admin.address, wallet.address])
  })

  describe('setRecipient', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setRecipientRole = action.interface.getSighash('setRecipient')
        await action.connect(admin).authorize(admin.address, setRecipientRole)
        action = action.connect(admin)
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
    let recipient
    const amount = fp(10)

    beforeEach('set recipient', async () => {
      recipient = other
      const setRecipientRole = action.interface.getSighash('setRecipient')
      await action.connect(admin).authorize(admin.address, setRecipientRole)
      await action.connect(admin).setRecipient(recipient.address)
    })

    it('can request to withdraw all funds of a token from the wallet', async () => {
      await token.mint(wallet.address, amount)

      const tx = await action.withdrawAll(token.address)

      await assertIndirectEvent(tx, wallet.interface, 'Withdraw', { token, amount, recipient, data: '0x' })
    })

    it('can request to withdraw the requested amount of a token from the wallet', async () => {
      const tx = await action.withdraw(token.address, amount)

      await assertIndirectEvent(tx, wallet.interface, 'Withdraw', { token, amount, recipient, data: '0x' })
    })
  })
})
