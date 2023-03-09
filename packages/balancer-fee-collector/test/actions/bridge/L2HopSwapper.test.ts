import { assertEvent, assertIndirectEvent, deploy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  createAction,
  createPriceFeedMock,
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
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
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
    const withdrawRole = smartVault.interface.getSighash('withdraw')
    await smartVault.connect(owner).authorize(action.address, withdrawRole)
  })

  beforeEach('set fee collector', async () => {
    const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
    await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
    await smartVault.connect(owner).setFeeCollector(feeCollector.address)
  })

  describe('setTokenAmm', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenAmmRole = action.interface.getSighash('setTokenAmm')
        await action.connect(owner).authorize(owner.address, setTokenAmmRole)
        action = action.connect(owner)
      })

      context('when the token address is not zero', () => {
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
    const rate = 2

    beforeEach('set price feed', async () => {
      const feed = await createPriceFeedMock(fp(rate))
      const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
      await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
      await smartVault.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, token.address, feed.address)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (relayed: boolean) => {
        context('when the given token has an AMM set', () => {
          beforeEach('set token AMM', async () => {
            const setTokenAmmRole = action.interface.getSighash('setTokenAmm')
            await action.connect(owner).authorize(owner.address, setTokenAmmRole)
            await action.connect(owner).setTokenAmm(token.address, hopL2Amm.address)
          })

          context('when the amount is greater than zero', () => {
            const amount = fp(10)

            context('when the amount is available', () => {
              beforeEach('fund smart vault', async () => {
                await hToken.mint(smartVault.address, amount)
              })

              beforeEach('fund swap connector', async () => {
                await mimic.swapConnector.mockRate(fp(1))
                await token.mint(await mimic.swapConnector.dex(), amount)
              })

              context('when the slippage is below the limit', () => {
                const slippage = fp(0.01)
                const minAmountOut = amount.sub(amount.mul(slippage).div(fp(1)))

                beforeEach('set max slippage', async () => {
                  const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
                  await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
                  await action.connect(owner).setMaxSlippage(slippage)
                })

                it('calls the swap primitive', async () => {
                  const data = defaultAbiCoder.encode(['address'], [hopL2Amm.address])

                  const tx = await action.call(token.address, amount, slippage)

                  await assertIndirectEvent(tx, smartVault.interface, 'Swap', {
                    source: SOURCE,
                    tokenIn: hToken.address,
                    tokenOut: token.address,
                    amountIn: amount,
                    minAmountOut,
                    data,
                  })
                })

                it('emits an Executed event', async () => {
                  const tx = await action.call(token.address, amount, slippage)

                  await assertEvent(tx, 'Executed')
                })

                if (relayed) {
                  it('refunds gas', async () => {
                    const previousBalance = await token.balanceOf(feeCollector.address)

                    const tx = await action.call(token.address, amount, slippage)

                    const currentBalance = await token.balanceOf(feeCollector.address)
                    expect(currentBalance).to.be.gt(previousBalance)

                    const redeemedCost = currentBalance.sub(previousBalance).div(rate)
                    await assertRelayedBaseCost(tx, redeemedCost, 0.15)
                  })
                } else {
                  it('does not refund gas', async () => {
                    const previousBalance = await token.balanceOf(feeCollector.address)

                    await action.call(token.address, amount, slippage)

                    const currentBalance = await token.balanceOf(feeCollector.address)
                    expect(currentBalance).to.be.equal(previousBalance)
                  })
                }
              })

              context('when the slippage is above the limit', () => {
                const slippage = fp(1)

                it('reverts', async () => {
                  await expect(action.call(token.address, amount, slippage)).to.be.revertedWith(
                    'SWAPPER_SLIPPAGE_ABOVE_MAX'
                  )
                })
              })
            })

            context('when the amount is not available', () => {
              it('reverts', async () => {
                await expect(action.call(token.address, amount, 0)).to.be.revertedWith('SWAPPER_AMOUNT_EXCEEDS_BALANCE')
              })
            })
          })

          context('when the amount is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(action.call(token.address, amount, 0)).to.be.revertedWith('SWAPPER_AMOUNT_ZERO')
            })
          })
        })

        context('when the given token does not have an AMM set', () => {
          it('reverts', async () => {
            await expect(action.call(token.address, 0, 0)).to.be.revertedWith('SWAPPER_TOKEN_AMM_NOT_SET')
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(owner).authorize(owner.address, setRelayerRole)
          await action.connect(owner).setRelayer(owner.address, true)
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(token.address, 0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
