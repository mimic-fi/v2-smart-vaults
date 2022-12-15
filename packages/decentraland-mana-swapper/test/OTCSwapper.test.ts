import { assertEvent, assertIndirectEvent, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import {
  createAction,
  createPriceFeedMock,
  createSmartVault,
  createTokenMock,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('OTCSwapper', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let tokenIn: Contract, tokenOut: Contract
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('OTCSwapper', mimic, owner, smartVault)
  })

  beforeEach('deploy tokens', async () => {
    tokenIn = await createTokenMock()
    tokenOut = await createTokenMock()
  })

  describe('setTokenIn', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenInRole = action.interface.getSighash('setTokenIn')
        await action.connect(owner).authorize(owner.address, setTokenInRole)
        action = action.connect(owner)
      })

      context('when setting the token in', () => {
        const itCanSetTheTokenProperly = () => {
          it('sets the token in', async () => {
            await action.setTokenIn(tokenIn.address)

            expect(await action.tokenIn()).to.be.equal(tokenIn.address)
          })

          it('emits an event', async () => {
            const tx = await action.setTokenIn(tokenIn.address)

            await assertEvent(tx, 'TokenInSet', { tokenIn })
          })
        }

        context('when the token in was set', () => {
          beforeEach('set the token', async () => {
            await action.setTokenIn(tokenIn.address)
          })

          itCanSetTheTokenProperly()
        })

        context('when the token in was not set', () => {
          beforeEach('unset the token in', async () => {
            await action.setTokenIn(ZERO_ADDRESS)
          })

          itCanSetTheTokenProperly()
        })
      })

      context('when unsetting the token in', () => {
        const itCanUnsetTheTokenProperly = () => {
          it('unsets the token in', async () => {
            await action.setTokenIn(ZERO_ADDRESS)

            expect(await action.tokenIn()).to.be.equal(ZERO_ADDRESS)
          })

          it('emits an event', async () => {
            const tx = await action.setTokenIn(ZERO_ADDRESS)

            await assertEvent(tx, 'TokenInSet', { tokenIn: ZERO_ADDRESS })
          })
        }

        context('when the token in was set', () => {
          beforeEach('set the token in', async () => {
            await action.setTokenIn(tokenIn.address)
          })

          itCanUnsetTheTokenProperly()
        })

        context('when the token in was not allowed', () => {
          beforeEach('unset the token in', async () => {
            await action.setTokenIn(ZERO_ADDRESS)
          })

          itCanUnsetTheTokenProperly()
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenIn(tokenIn.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTokenOut', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenOutRole = action.interface.getSighash('setTokenOut')
        await action.connect(owner).authorize(owner.address, setTokenOutRole)
        action = action.connect(owner)
      })

      context('when setting the token out', () => {
        const itCanSetTheTokenProperly = () => {
          it('sets the token out', async () => {
            await action.setTokenOut(tokenOut.address)

            expect(await action.tokenOut()).to.be.equal(tokenOut.address)
          })

          it('emits an event', async () => {
            const tx = await action.setTokenOut(tokenOut.address)

            await assertEvent(tx, 'TokenOutSet', { tokenOut })
          })
        }

        context('when the token out was set', () => {
          beforeEach('set the token', async () => {
            await action.setTokenOut(tokenOut.address)
          })

          itCanSetTheTokenProperly()
        })

        context('when the token out was not set', () => {
          beforeEach('unset the token out', async () => {
            await action.setTokenOut(ZERO_ADDRESS)
          })

          itCanSetTheTokenProperly()
        })
      })

      context('when unsetting the token out', () => {
        const itCanUnsetTheTokenProperly = () => {
          it('unsets the token out', async () => {
            await action.setTokenOut(ZERO_ADDRESS)

            expect(await action.tokenOut()).to.be.equal(ZERO_ADDRESS)
          })

          it('emits an event', async () => {
            const tx = await action.setTokenOut(ZERO_ADDRESS)

            await assertEvent(tx, 'TokenOutSet', { tokenOut: ZERO_ADDRESS })
          })
        }

        context('when the token out was set', () => {
          beforeEach('set the token out', async () => {
            await action.setTokenOut(tokenOut.address)
          })

          itCanUnsetTheTokenProperly()
        })

        context('when the token out was not allowed', () => {
          beforeEach('unset the token out', async () => {
            await action.setTokenOut(ZERO_ADDRESS)
          })

          itCanUnsetTheTokenProperly()
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenOut(tokenOut.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
          await expect(action.setMaxSlippage(slippage)).to.be.revertedWith('SLIPPAGE_ABOVE_ONE')
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
    const threshold = fp(10) // token out
    const priceRate = 2 // 1 token in = 2 token out
    const maxSlippage = fp(0.02)

    beforeEach('authorize action', async () => {
      const collectRole = smartVault.interface.getSighash('collect')
      await smartVault.connect(owner).authorize(action.address, collectRole)
      const withdrawRole = smartVault.interface.getSighash('withdraw')
      await smartVault.connect(owner).authorize(action.address, withdrawRole)
    })

    beforeEach('set fee collector', async () => {
      const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
      await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
      await smartVault.connect(owner).setFeeCollector(feeCollector.address)
    })

    beforeEach('set max slippage', async () => {
      const setMaxSlippage = action.interface.getSighash('setMaxSlippage')
      await action.connect(owner).authorize(owner.address, setMaxSlippage)
      await action.connect(owner).setMaxSlippage(maxSlippage)
    })

    beforeEach('set price feed', async () => {
      const feed = await createPriceFeedMock(fp(priceRate))
      const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
      await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
      await smartVault.connect(owner).setPriceFeed(tokenOut.address, tokenIn.address, feed.address)
    })

    beforeEach('set threshold', async () => {
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)
      await action.connect(owner).setThreshold(tokenOut.address, threshold)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the token in was set', () => {
          beforeEach('set token in', async () => {
            const setTokenInRole = action.interface.getSighash('setTokenIn')
            await action.connect(owner).authorize(owner.address, setTokenInRole)
            await action.connect(owner).setTokenIn(tokenIn.address)
          })

          context('when the token out was set', () => {
            beforeEach('set token out', async () => {
              const setTokenOutRole = action.interface.getSighash('setTokenOut')
              await action.connect(owner).authorize(owner.address, setTokenOutRole)
              await action.connect(owner).setTokenOut(tokenOut.address)
            })

            context('when the requested min amount can be fulfilled', () => {
              const minAmountOut = 0

              context('when the amount out passes the threshold', () => {
                const amountOut = threshold
                const amountIn = amountOut.mul(fp(1)).div(fp(1).sub(maxSlippage)).mul(priceRate).add(2) // rounding error

                beforeEach('fund smart vault', async () => {
                  await tokenOut.mint(smartVault.address, amountOut)
                })

                beforeEach('fund sender and approve smart vault', async () => {
                  await tokenIn.mint(owner.address, fp(1000))
                  await tokenIn.connect(owner).approve(smartVault.address, fp(1000))
                })

                it('can execute', async () => {
                  expect(await action.canExecute(amountIn, minAmountOut)).to.be.true
                })

                it('calls collect primitive', async () => {
                  const tx = await action.call(amountIn, minAmountOut)

                  await assertIndirectEvent(tx, smartVault.interface, 'Collect', {
                    token: tokenIn,
                    collected: amountIn,
                    from: owner.address,
                    data: '0x',
                  })
                })

                it('transfers the token in to the smart vault', async () => {
                  const previousSenderBalance = await tokenIn.balanceOf(owner.address)
                  const previousSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                  const previousFeeCollectorBalance = await tokenIn.balanceOf(feeCollector.address)

                  await action.call(amountIn, minAmountOut)

                  const currentSenderBalance = await tokenIn.balanceOf(owner.address)
                  expect(currentSenderBalance).to.be.eq(previousSenderBalance.sub(amountIn))

                  const currentFeeCollectorBalance = await tokenIn.balanceOf(feeCollector.address)
                  const gasPaid = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
                  const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                  expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.add(amountIn).sub(gasPaid))
                })

                it('transfers the token out to the sender', async () => {
                  const previousOwnerBalance = await tokenOut.balanceOf(owner.address)
                  const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)

                  await action.call(amountIn, minAmountOut)

                  const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                  expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.sub(amountOut))

                  const currentOwnerBalance = await tokenOut.balanceOf(owner.address)
                  expect(currentOwnerBalance).to.be.eq(previousOwnerBalance.add(amountOut))
                })

                it('emits an Executed event', async () => {
                  const tx = await action.call(amountIn, minAmountOut)

                  await assertEvent(tx, 'Executed')
                })

                it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
                  const previousBalance = await tokenIn.balanceOf(feeCollector.address)

                  await action.call(amountIn, minAmountOut)

                  const currentBalance = await tokenIn.balanceOf(feeCollector.address)
                  expect(currentBalance).to.be[refunds ? 'gt' : 'equal'](previousBalance)
                })
              })

              context('when the amount in does not passe the threshold', () => {
                const amountOut = threshold.div(2)
                const amountIn = amountOut.div(priceRate)

                it('reverts', async () => {
                  await expect(action.call(amountIn, minAmountOut)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                })
              })
            })

            context('when the requested min amount can not be fulfilled', () => {
              const amountIn = fp(1)
              const minAmountOut = amountIn

              it('reverts', async () => {
                await expect(action.call(amountIn, minAmountOut)).to.be.revertedWith('SWAPPER_MIN_AMOUNT_OUT')
              })
            })

            context('when the token out was not set', () => {
              beforeEach('unset token out', async () => {
                const setTokenOutRole = action.interface.getSighash('setTokenOut')
                await action.connect(owner).authorize(owner.address, setTokenOutRole)
                await action.connect(owner).setTokenOut(ZERO_ADDRESS)
              })

              it('reverts', async () => {
                await expect(action.call(0, 0)).to.be.revertedWith('SWAPPER_TOKEN_OUT_NOT_SET')
              })
            })
          })

          context('when the token in was not set', () => {
            beforeEach('unset token in', async () => {
              const setTokenInRole = action.interface.getSighash('setTokenIn')
              await action.connect(owner).authorize(owner.address, setTokenInRole)
              await action.connect(owner).setTokenIn(ZERO_ADDRESS)
            })

            it('reverts', async () => {
              await expect(action.call(0, 0)).to.be.revertedWith('SWAPPER_TOKEN_IN_NOT_SET')
            })
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(owner).authorize(owner.address, setRelayerRole)
          await action.connect(owner).setRelayer(owner.address, true)

          const setLimitsRole = action.interface.getSighash('setLimits')
          await action.connect(owner).authorize(owner.address, setLimitsRole)
          await action.connect(owner).setLimits(fp(100), 0, tokenIn.address)
        })

        beforeEach('set native token price feed for gas 1:1', async () => {
          const feed = await createPriceFeedMock(fp(1))
          await smartVault.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, tokenIn.address, feed.address)
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
