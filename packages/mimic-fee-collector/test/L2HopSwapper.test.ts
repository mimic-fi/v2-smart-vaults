import { assertEvent, assertIndirectEvent, deploy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import {
  createAction,
  createSmartVault,
  createTokenMock,
  Mimic,
  MOCKS,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'

describe('L2HopSwapper', () => {
  let action: Contract, smartVault: Contract, token: Contract, hToken: Contract, hopL2Amm: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('L2HopSwapper', mimic, owner, smartVault)
  })

  beforeEach('deploy token and amm mock', async () => {
    token = await createTokenMock()
    hToken = await createTokenMock()
    hopL2Amm = await deploy(MOCKS.HOP_L2_AMM, [token.address, hToken.address])
  })

  beforeEach('authorize action', async () => {
    const swapRole = smartVault.interface.getSighash('swap')
    await smartVault.connect(owner).authorize(action.address, swapRole)
  })

  describe('setTokenAmm', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenAmmRole = action.interface.getSighash('setTokenAmm')
        await action.connect(owner).authorize(owner.address, setTokenAmmRole)
        action = action.connect(owner)
      })

      context('when the token address is not zero', () => {
        context('when the amm canonical token matches', () => {
          context('when setting the token amm', () => {
            const itSetsTheTokenAmm = () => {
              it('sets the token amm', async () => {
                await action.setTokenAmm(token.address, hopL2Amm.address)

                expect(await action.getTokenAmm(token.address)).to.be.equal(hopL2Amm.address)
              })

              it('emits an event', async () => {
                const tx = await action.setTokenAmm(token.address, hopL2Amm.address)

                await assertEvent(tx, 'TokenAmmSet', { token, amm: hopL2Amm.address })
              })
            }

            context('when the token amm was set', () => {
              beforeEach('set token amm', async () => {
                await action.setTokenAmm(token.address, hopL2Amm.address)
              })

              itSetsTheTokenAmm()
            })

            context('when the token amm was not set', () => {
              beforeEach('unset token amm', async () => {
                await action.setTokenAmm(token.address, ZERO_ADDRESS)
              })

              itSetsTheTokenAmm()
            })
          })

          context('when unsetting the token amm', () => {
            const itUnsetsTheTokenAmm = () => {
              it('unsets the token amm', async () => {
                await action.setTokenAmm(token.address, ZERO_ADDRESS)

                expect(await action.getTokenAmm(token.address)).to.be.equal(ZERO_ADDRESS)
              })

              it('emits an event', async () => {
                const tx = await action.setTokenAmm(token.address, ZERO_ADDRESS)

                await assertEvent(tx, 'TokenAmmSet', { token, amm: ZERO_ADDRESS })
              })
            }

            context('when the token amm was set', () => {
              beforeEach('set token amm', async () => {
                await action.setTokenAmm(token.address, hopL2Amm.address)
              })

              itUnsetsTheTokenAmm()
            })

            context('when the token was not set', () => {
              beforeEach('unset token amm', async () => {
                await action.setTokenAmm(token.address, ZERO_ADDRESS)
              })

              itUnsetsTheTokenAmm()
            })
          })
        })

        context('when the amm canonical token matches', () => {
          beforeEach('deploy another amm', async () => {
            hopL2Amm = await deploy(MOCKS.HOP_L2_AMM, [owner.address, owner.address])
          })

          it('reverts', async () => {
            await expect(action.setTokenAmm(token.address, hopL2Amm.address)).to.be.revertedWith(
              'SWAPPER_AMM_TOKEN_DOES_NOT_MATCH'
            )
          })
        })
      })

      context('when the token address is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setTokenAmm(token, hopL2Amm.address)).to.be.revertedWith('SWAPPER_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenAmm(token.address, hopL2Amm.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
        await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
        action = action.connect(owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async () => {
          await action.setMaxSlippage(slippage)

          expect(await action.maxSlippage()).to.be.equal(slippage)
        })

        it('emits an event', async () => {
          const tx = await action.setMaxSlippage(slippage)

          await assertEvent(tx, 'MaxSlippageSet', { maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async () => {
          await expect(action.setMaxSlippage(slippage)).to.be.revertedWith('SWAPPER_SLIPPAGE_ABOVE_ONE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setMaxSlippage(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    const SOURCE = 5
    const SLIPPAGE = fp(0.01)
    const BALANCE = fp(10)

    beforeEach('fund smart vault', async () => {
      await hToken.mint(smartVault.address, BALANCE)
    })

    beforeEach('fund swap connector', async () => {
      await mimic.swapConnector.mockRate(fp(1))
      await token.mint(await mimic.swapConnector.dex(), BALANCE)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      context('when the sender is not a relayer', () => {
        context('when the given token has an AMM set', () => {
          beforeEach('set token AMM', async () => {
            const setTokenAmmRole = action.interface.getSighash('setTokenAmm')
            await action.connect(owner).authorize(owner.address, setTokenAmmRole)
            await action.connect(owner).setTokenAmm(token.address, hopL2Amm.address)
          })

          context('when the slippage is below the limit', () => {
            const minAmountOut = BALANCE.sub(BALANCE.mul(SLIPPAGE).div(fp(1)))

            beforeEach('set max slippage', async () => {
              const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
              await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
              await action.connect(owner).setMaxSlippage(SLIPPAGE)
            })

            it('can executes', async () => {
              const canExecute = await action.canExecute(token.address, SLIPPAGE)
              expect(canExecute).to.be.true
            })

            it('calls the swap primitive', async () => {
              const data = defaultAbiCoder.encode(['address'], [hopL2Amm.address])

              const tx = await action.call(token.address, SLIPPAGE)

              await assertIndirectEvent(tx, smartVault.interface, 'Swap', {
                source: SOURCE,
                tokenIn: hToken.address,
                tokenOut: token.address,
                amountIn: BALANCE,
                minAmountOut,
                data,
              })
            })

            it('emits an Executed event', async () => {
              const tx = await action.call(token.address, SLIPPAGE)

              await assertEvent(tx, 'Executed')
            })
          })

          context('when the slippage is above the limit', () => {
            it('reverts', async () => {
              await expect(action.call(token.address, SLIPPAGE)).to.be.revertedWith('SWAPPER_SLIPPAGE_ABOVE_MAX')
            })
          })
        })

        context('when the given token does not have an AMM set', () => {
          it('reverts', async () => {
            await expect(action.call(token.address, SLIPPAGE)).to.be.revertedWith('SWAPPER_TOKEN_AMM_NOT_SET')
          })
        })
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(token.address, SLIPPAGE)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
