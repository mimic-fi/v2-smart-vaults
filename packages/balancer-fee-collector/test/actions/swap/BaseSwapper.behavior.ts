import { assertEvent, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { createAction, createSmartVault, createTokenMock, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

export function itBehavesLikeBaseSwapper(swapperContractName: string): void {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, swapSigner: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, swapSigner] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction(swapperContractName, mimic, owner, smartVault)
  })

  describe('setTokenOut', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setTokenOutRole = action.interface.getSighash('setTokenOut')
        await action.connect(owner).authorize(owner.address, setTokenOutRole)
        action = action.connect(owner)
      })

      context('when the token is not the zero address', () => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await createTokenMock()
        })

        it('sets the token out', async () => {
          await action.setTokenOut(token.address)

          expect(await action.tokenOut()).to.be.equal(token.address)
        })

        it('emits an event', async () => {
          const tx = await action.setTokenOut(token.address)

          await assertEvent(tx, 'TokenOutSet', { tokenOut: token })
        })
      })

      context('when the token out is the zero address', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setTokenOut(token)).to.be.revertedWith('SWAPPER_TOKEN_ADDRESS_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setSwapSigner(swapSigner.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setSwapSigner', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setSwapSignerRole = action.interface.getSighash('setSwapSigner')
        await action.connect(owner).authorize(owner.address, setSwapSignerRole)
        action = action.connect(owner)
      })

      it('sets the swap signer', async () => {
        await action.setSwapSigner(swapSigner.address)

        expect(await action.swapSigner()).to.be.equal(swapSigner.address)
      })

      it('emits an event', async () => {
        const tx = await action.setSwapSigner(swapSigner.address)

        await assertEvent(tx, 'SwapSignerSet', { swapSigner: swapSigner })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setSwapSigner(swapSigner.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setDefaultMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setDefaultMaxSlippageRole = action.interface.getSighash('setDefaultMaxSlippage')
        await action.connect(owner).authorize(owner.address, setDefaultMaxSlippageRole)
        action = action.connect(owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async () => {
          await action.setDefaultMaxSlippage(slippage)

          expect(await action.defaultMaxSlippage()).to.be.equal(slippage)
        })

        it('emits an event', async () => {
          const tx = await action.setDefaultMaxSlippage(slippage)

          await assertEvent(tx, 'DefaultMaxSlippageSet', { maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async () => {
          await expect(action.setDefaultMaxSlippage(slippage)).to.be.revertedWith('SWAPPER_DEFAULT_SLIPPAGE_ABOVE_1')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setDefaultMaxSlippage(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTokenMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenMaxSlippageRole = action.interface.getSighash('setTokenMaxSlippage')
        await action.connect(owner).authorize(owner.address, setTokenMaxSlippageRole)
        action = action.connect(owner)
      })

      context('when the token is not the zero address', () => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await createTokenMock()
        })

        context('when the slippage is not above one', () => {
          const slippage = fp(1)

          it('sets the slippage', async () => {
            await action.setTokenMaxSlippage(token.address, slippage)

            expect(await action.getTokenSlippage(token.address)).to.be.equal(slippage)
          })

          it('emits an event', async () => {
            const tx = await action.setTokenMaxSlippage(token.address, slippage)

            await assertEvent(tx, 'TokenMaxSlippageSet', { token, maxSlippage: slippage })
          })

          context('when the slippage is above one', () => {
            const slippage = fp(1).add(1)

            it('reverts', async () => {
              await expect(action.setTokenMaxSlippage(token.address, slippage)).to.be.revertedWith(
                'SWAPPER_TOKEN_SLIPPAGE_ABOVE_1'
              )
            })
          })
        })

        context('when the token is not the zero address', () => {
          const token = ZERO_ADDRESS

          it('reverts', async () => {
            await expect(action.setTokenMaxSlippage(token, 0)).to.be.revertedWith('SWAPPER_TOKEN_ADDRESS_ZERO')
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenMaxSlippage(ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setDeniedTokens', () => {
    let token1: Contract, token2: Contract

    beforeEach('deploy tokens', async () => {
      token1 = await createTokenMock()
      token2 = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setDeniedTokensRole = action.interface.getSighash('setDeniedTokens')
        await action.connect(owner).authorize(owner.address, setDeniedTokensRole)
        action = action.connect(owner)
      })

      it('sets the denied tokens', async () => {
        await action.setDeniedTokens([token1.address, token2.address], [true, false])

        expect(await action.isTokenDenied(token1.address)).to.be.true
        expect(await action.isTokenDenied(token2.address)).to.be.false
        expect(await action.getDeniedTokens()).to.have.lengthOf(1)

        await action.setDeniedTokens([token2.address], [true])

        const tokens = await action.getDeniedTokens()
        expect(tokens).to.have.lengthOf(2)
        expect(tokens[0]).to.be.equal(token1.address)
        expect(tokens[1]).to.be.equal(token2.address)
      })

      it('emits an event', async () => {
        const tx = await action.setDeniedTokens([token1.address, token2.address], [true, false])

        await assertEvent(tx, 'DeniedTokenSet', { token: token1, denied: true })
        await assertEvent(tx, 'DeniedTokenSet', { token: token2, denied: false })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setDeniedTokens([token1.address, token2.address], [true, false])).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })
}
