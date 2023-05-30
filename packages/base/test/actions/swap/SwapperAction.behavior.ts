import { assertEvent, fp, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { createTokenMock } from '@mimic-fi/v2-smart-vaults-base'
import { expect } from 'chai'
import { Contract } from 'ethers'

export function itBehavesLikeSwapperAction(): void {
  describe('setDefaultTokenOut', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setDefaultTokenOutRole = this.action.interface.getSighash('setDefaultTokenOut')
        await this.action.connect(this.owner).authorize(this.owner.address, setDefaultTokenOutRole)
        this.action = this.action.connect(this.owner)
      })

      it('sets the token out', async function () {
        await this.action.setDefaultTokenOut(token.address)

        expect(await this.action.getDefaultTokenOut()).to.be.equal(token.address)
      })

      it('emits an event', async function () {
        const tx = await this.action.setDefaultTokenOut(token.address)

        await assertEvent(tx, 'DefaultTokenOutSet', { tokenOut: token })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.action.setDefaultTokenOut(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setCustomTokensOut', () => {
    let token: Contract, tokenOut: Contract

    beforeEach('deploy token', async function () {
      token = await createTokenMock()
      tokenOut = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setCustomTokensOutRole = this.action.interface.getSighash('setCustomTokensOut')
        await this.action.connect(this.owner).authorize(this.owner.address, setCustomTokensOutRole)
        this.action = this.action.connect(this.owner)
      })

      it('sets the token out', async function () {
        await this.action.setCustomTokensOut([token.address], [tokenOut.address])

        const customTokenOut = await this.action.getCustomTokenOut(token.address)
        expect(customTokenOut[0]).to.be.equal(true)
        expect(customTokenOut[1]).to.be.equal(tokenOut.address)
      })

      it('emits an event', async function () {
        const tx = await this.action.setCustomTokensOut([token.address], [tokenOut.address])

        await assertEvent(tx, 'CustomTokenOutSet', { token, tokenOut })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.action.setCustomTokensOut([token.address], [tokenOut.address])).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('setDefaultMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setDefaultMaxSlippageRole = this.action.interface.getSighash('setDefaultMaxSlippage')
        await this.action.connect(this.owner).authorize(this.owner.address, setDefaultMaxSlippageRole)
        this.action = this.action.connect(this.owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await this.action.setDefaultMaxSlippage(slippage)

          expect(await this.action.getDefaultMaxSlippage()).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await this.action.setDefaultMaxSlippage(slippage)

          await assertEvent(tx, 'DefaultMaxSlippageSet', { maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(this.action.setDefaultMaxSlippage(slippage)).to.be.revertedWith('ACTION_SLIPPAGE_ABOVE_ONE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.action.setDefaultMaxSlippage(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setCustomMaxSlippages', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setCustomMaxSlippagesRole = this.action.interface.getSighash('setCustomMaxSlippages')
        await this.action.connect(this.owner).authorize(this.owner.address, setCustomMaxSlippagesRole)
        this.action = this.action.connect(this.owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await this.action.setCustomMaxSlippages([token.address], [slippage])

          const customMaxSlippage = await this.action.getCustomMaxSlippage(token.address)
          expect(customMaxSlippage[0]).to.be.equal(true)
          expect(customMaxSlippage[1]).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await this.action.setCustomMaxSlippages([token.address], [slippage])

          await assertEvent(tx, 'CustomMaxSlippageSet', { token, maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(this.action.setCustomMaxSlippages([token.address], [slippage])).to.be.revertedWith(
            'ACTION_SLIPPAGE_ABOVE_ONE'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.action.setCustomMaxSlippages([ZERO_ADDRESS], [0])).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })
}
