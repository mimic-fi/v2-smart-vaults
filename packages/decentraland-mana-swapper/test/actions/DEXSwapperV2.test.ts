import {
  advanceTime,
  assertEvent,
  assertIndirectEvent,
  BigNumberish,
  currentTimestamp,
  deploy,
  fp,
  getSigners,
  MONTH,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import {
  createPriceFeedMock,
  createSmartVault,
  createTokenMock,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('DEXSwapperV2', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let tokenIn: Contract, tokenOut: Contract
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy tokens', async () => {
    tokenIn = await createTokenMock()
    tokenOut = await createTokenMock()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('DEXSwapperV2', [
      {
        smartVault: smartVault.address,
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        maxSlippage: 0,
        swapLimitToken: ZERO_ADDRESS,
        swapLimitAmount: 0,
        swapLimitPeriod: 0,
        thresholdToken: ZERO_ADDRESS,
        thresholdAmount: 0,
        relayer: ZERO_ADDRESS,
        gasPriceLimit: 0,
        totalCostLimit: 0,
        payingGasToken: ZERO_ADDRESS,
        admin: owner.address,
        registry: mimic.registry.address,
      },
    ])
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

  describe('setSwapLimit', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setSwapLimitRole = action.interface.getSighash('setSwapLimit')
        await action.connect(owner).authorize(owner.address, setSwapLimitRole)
        action = action.connect(owner)
      })

      context('when there was no swap limit set yet', () => {
        const itSetsTheSwapLimitCorrectly = (token: string, amount: BigNumberish, period: BigNumberish) => {
          it('sets the swap limit', async () => {
            await action.setSwapLimit(token, amount, period)

            const swapLimit = await action.swapLimit()
            expect(swapLimit.token).to.be.equal(token)
            expect(swapLimit.amount).to.be.equal(amount)
            expect(swapLimit.period).to.be.equal(period)
            expect(swapLimit.accrued).to.be.equal(0)
            expect(swapLimit.nextResetTime).to.be.equal(amount != 0 ? (await currentTimestamp()).add(period) : 0)
          })

          it('emits an event', async () => {
            const tx = await action.setSwapLimit(token, amount, period)
            await assertEvent(tx, 'SwapLimitSet', { token, amount, period })
          })
        }

        context('when the amount is not zero', async () => {
          const amount = fp(100)

          context('when the token is not zero', async () => {
            const token = NATIVE_TOKEN_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              itSetsTheSwapLimitCorrectly(token, amount, period)
            })

            context('when the period is zero', async () => {
              const period = 0

              it('reverts', async () => {
                await expect(action.setSwapLimit(token, amount, period)).to.be.revertedWith(
                  'SWAPPER_INVALID_SWAP_LIMIT_INPUT'
                )
              })
            })
          })

          context('when the token is zero', async () => {
            const token = ZERO_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              it('reverts', async () => {
                await expect(action.setSwapLimit(token, amount, period)).to.be.revertedWith(
                  'SWAPPER_INVALID_SWAP_LIMIT_INPUT'
                )
              })
            })

            context('when the period is zero', async () => {
              const period = 0

              it('reverts', async () => {
                await expect(action.setSwapLimit(token, amount, period)).to.be.revertedWith(
                  'SWAPPER_INVALID_SWAP_LIMIT_INPUT'
                )
              })
            })
          })
        })

        context('when the amount is zero', async () => {
          const amount = 0

          context('when the token is not zero', async () => {
            const token = NATIVE_TOKEN_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              it('reverts', async () => {
                await expect(action.setSwapLimit(token, amount, period)).to.be.revertedWith(
                  'SWAPPER_INVALID_SWAP_LIMIT_INPUT'
                )
              })
            })

            context('when the period is zero', async () => {
              const period = 0

              it('reverts', async () => {
                await expect(action.setSwapLimit(token, amount, period)).to.be.revertedWith(
                  'SWAPPER_INVALID_SWAP_LIMIT_INPUT'
                )
              })
            })
          })

          context('when the token is zero', async () => {
            const token = ZERO_ADDRESS

            context('when the period is not zero', async () => {
              const period = MONTH

              it('reverts', async () => {
                await expect(action.setSwapLimit(token, amount, period)).to.be.revertedWith(
                  'SWAPPER_INVALID_SWAP_LIMIT_INPUT'
                )
              })
            })

            context('when the period is zero', async () => {
              const period = 0

              itSetsTheSwapLimitCorrectly(token, amount, period)
            })
          })
        })
      })

      context('when there was a swap limit already set', () => {
        const amount = fp(200)
        const period = MONTH * 2

        beforeEach('set swap limit', async () => {
          await action.setSwapLimit(tokenIn.address, amount, period)
        })

        context('when there were no swaps yet', () => {
          const rate = 2
          const newAmount = amount.mul(rate)
          const newPeriod = period * rate
          let newToken: Contract

          beforeEach('deploy new token', async () => {
            newToken = await createTokenMock()
            const feed = await createPriceFeedMock(fp(rate))
            const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
            await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
            await smartVault.connect(owner).setPriceFeed(tokenIn.address, newToken.address, feed.address)
          })

          it('sets the swap limit without updating the next reset time', async () => {
            const { nextResetTime: previousResetTime } = await action.swapLimit()

            await action.setSwapLimit(newToken.address, newAmount, newPeriod)

            const swapLimit = await action.swapLimit()
            expect(swapLimit.token).to.be.equal(newToken.address)
            expect(swapLimit.amount).to.be.equal(newAmount)
            expect(swapLimit.period).to.be.equal(newPeriod)
            expect(swapLimit.accrued).to.be.equal(0)
            expect(swapLimit.nextResetTime).to.be.equal(previousResetTime)
          })

          it('emits an event', async () => {
            const tx = await action.setSwapLimit(newToken.address, newAmount, newPeriod)
            await assertEvent(tx, 'SwapLimitSet', { token: newToken, amount: newAmount, period: newPeriod })
          })
        })

        context('when there where some swaps already', () => {
          let newToken: Contract

          beforeEach('deploy token', async () => {
            newToken = await createTokenMock()
          })

          beforeEach('accrue swaps', async () => {
            // Authorize action
            const swapRole = smartVault.interface.getSighash('swap')
            await smartVault.connect(owner).authorize(action.address, swapRole)
            const withdrawRole = smartVault.interface.getSighash('withdraw')
            await smartVault.connect(owner).authorize(action.address, withdrawRole)

            // Authorize sender
            const callRole = action.interface.getSighash('call')
            await action.connect(owner).authorize(owner.address, callRole)

            // Set price feed in/out
            const feed = await createPriceFeedMock(fp(1))
            const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
            await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
            await smartVault.connect(owner).setPriceFeed(tokenIn.address, tokenOut.address, feed.address)

            // Set threshold
            const setThresholdRole = action.interface.getSighash('setThreshold')
            await action.connect(owner).authorize(owner.address, setThresholdRole)
            await action.connect(owner).setThreshold(tokenIn.address, fp(1))

            // Fund swap connector
            await mimic.swapConnector.mockRate(fp(1))
            await tokenOut.mint(await mimic.swapConnector.dex(), fp(1000))

            // Fund smart vault
            await tokenIn.mint(smartVault.address, fp(1))

            // Execute swap
            await action.connect(owner).call(0, fp(1), 0, '0x')
          })

          context('when the swap limit amount is being changed', () => {
            const rate = 2
            const newAmount = amount.mul(rate).mul(3)
            const newPeriod = period * rate

            beforeEach('mock new token rate', async () => {
              const feed = await createPriceFeedMock(fp(rate))
              const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
              await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
              await smartVault.connect(owner).setPriceFeed(tokenIn.address, newToken.address, feed.address)
            })

            it('sets the swap limit without updating the next reset time', async () => {
              const previousSwapLimit = await action.swapLimit()

              await action.setSwapLimit(newToken.address, newAmount, newPeriod)

              const swapLimit = await action.swapLimit()
              expect(swapLimit.token).to.be.equal(newToken.address)
              expect(swapLimit.amount).to.be.equal(newAmount)
              expect(swapLimit.period).to.be.equal(newPeriod)
              expect(swapLimit.accrued).to.be.equal(previousSwapLimit.accrued.mul(rate))
              expect(swapLimit.nextResetTime).to.be.equal(previousSwapLimit.nextResetTime)
            })

            it('emits an event', async () => {
              const tx = await action.setSwapLimit(newToken.address, newAmount, newPeriod)
              await assertEvent(tx, 'SwapLimitSet', {
                token: newToken,
                amount: newAmount,
                period: newPeriod,
              })
            })
          })

          context('when the swap limit amount is being removed', () => {
            const newToken = ZERO_ADDRESS
            const newAmount = 0
            const newPeriod = 0

            it('sets the swap limit and resets the totalizators', async () => {
              await action.setSwapLimit(newToken, newAmount, newPeriod)

              const swapLimit = await action.swapLimit()
              expect(swapLimit.token).to.be.equal(newToken)
              expect(swapLimit.amount).to.be.equal(newAmount)
              expect(swapLimit.period).to.be.equal(newPeriod)
              expect(swapLimit.accrued).to.be.equal(0)
              expect(swapLimit.nextResetTime).to.be.equal(0)
            })

            it('emits an event', async () => {
              const tx = await action.setSwapLimit(newToken, newAmount, newPeriod)
              await assertEvent(tx, 'SwapLimitSet', {
                amount: newAmount,
                token: newToken,
                period: newPeriod,
              })
            })
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        smartVault = smartVault.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setSwapLimit(ZERO_ADDRESS, 0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    const SOURCE = 0
    const DATA = '0xaaaabbbb'

    const threshold = fp(10) // token in
    const priceRate = 2 // 1 token in = 2 token out

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

    beforeEach('set price feed', async () => {
      const feed = await createPriceFeedMock(fp(priceRate))
      const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
      await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
      await smartVault.connect(owner).setPriceFeed(tokenIn.address, tokenOut.address, feed.address)
    })

    beforeEach('set threshold', async () => {
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)
      await action.connect(owner).setThreshold(tokenIn.address, threshold)
    })

    beforeEach('fund swap connector', async () => {
      await mimic.swapConnector.mockRate(fp(priceRate))
      await tokenOut.mint(await mimic.swapConnector.dex(), fp(1000))
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

            context('when the requested slippage is acceptable', () => {
              const slippage = fp(0.02)

              beforeEach('set max slippage', async () => {
                const setMaxSlippage = action.interface.getSighash('setMaxSlippage')
                await action.connect(owner).authorize(owner.address, setMaxSlippage)
                await action.connect(owner).setMaxSlippage(slippage)
              })

              context('when the amount in passes the threshold', () => {
                const amountIn = threshold
                const expectedAmountOut = amountIn.mul(priceRate)
                const minAmountOut = expectedAmountOut.sub(expectedAmountOut.mul(slippage).div(fp(1)))

                beforeEach('fund smart vault', async () => {
                  await tokenIn.mint(smartVault.address, amountIn)
                })

                const itSwapsProperly = () => {
                  it('can execute', async () => {
                    expect(await action.canExecute(amountIn, slippage)).to.be.true
                  })

                  it('calls swap primitive', async () => {
                    const tx = await action.call(SOURCE, amountIn, slippage, DATA)

                    await assertIndirectEvent(tx, smartVault.interface, 'Swap', {
                      source: SOURCE,
                      tokenIn,
                      tokenOut,
                      amountIn,
                      minAmountOut,
                      data: DATA,
                    })
                  })

                  it('transfers the token in to the swap connector', async () => {
                    const previousSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                    const previousDexBalance = await tokenIn.balanceOf(await mimic.swapConnector.dex())

                    await action.call(SOURCE, amountIn, slippage, DATA)

                    const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(0)

                    const currentDexBalance = await tokenIn.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.add(previousSmartVaultBalance))
                  })

                  it('transfers the token out to the smart vault', async () => {
                    const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    const previousFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)
                    const previousDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())

                    await action.call(SOURCE, amountIn, slippage, DATA)

                    const currentFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)
                    const gasPaid = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
                    const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(
                      previousSmartVaultBalance.add(expectedAmountOut).sub(gasPaid)
                    )

                    const currentDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.sub(expectedAmountOut))
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(SOURCE, amountIn, slippage, DATA)

                    await assertEvent(tx, 'Executed')
                  })

                  it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
                    const previousBalance = await tokenOut.balanceOf(feeCollector.address)

                    await action.call(SOURCE, amountIn, slippage, DATA)

                    const currentBalance = await tokenOut.balanceOf(feeCollector.address)
                    expect(currentBalance).to.be[refunds ? 'gt' : 'equal'](previousBalance)
                  })
                }

                const itCannotSwap = () => {
                  it('cannot execute', async () => {
                    expect(await action.canExecute(amountIn, slippage)).to.be.false
                  })

                  it('reverts', async () => {
                    await expect(action.call(SOURCE, amountIn, slippage, DATA)).to.be.revertedWith(
                      'SWAPPER_SWAP_LIMIT_EXCEEDED'
                    )
                  })
                }

                context('when the swap limit is based on the token in', () => {
                  const limit = amountIn.mul(3)
                  const period = MONTH

                  beforeEach('set swap limit', async () => {
                    const setSwapLimitRole = action.interface.getSighash('setSwapLimit')
                    await action.connect(owner).authorize(owner.address, setSwapLimitRole)
                    await action.connect(owner).setSwapLimit(tokenIn.address, limit, period)
                  })

                  context('when the swap limit is not passed', () => {
                    const previousSwapAmount = amountIn

                    beforeEach('swap some amount', async () => {
                      await tokenIn.mint(smartVault.address, previousSwapAmount)
                      await action.call(SOURCE, previousSwapAmount, slippage, DATA)
                    })

                    itSwapsProperly()
                  })

                  context('when the swap limit is passed', () => {
                    const previousSwapAmount = amountIn.mul(2).add(1)

                    beforeEach('swap some amount', async () => {
                      await tokenIn.mint(smartVault.address, previousSwapAmount)
                      await action.call(SOURCE, previousSwapAmount, slippage, DATA)
                    })

                    context('before the limit has been reset', () => {
                      itCannotSwap()
                    })

                    context('after the limit has been reset', () => {
                      beforeEach('advance time', async () => {
                        await advanceTime(period)
                      })

                      itSwapsProperly()
                    })
                  })
                })

                context('when the swap limit is based on the token out', () => {
                  const limit = amountIn.mul(priceRate).mul(2)
                  const period = MONTH

                  beforeEach('set swap limit', async () => {
                    const setSwapLimitRole = action.interface.getSighash('setSwapLimit')
                    await action.connect(owner).authorize(owner.address, setSwapLimitRole)
                    await action.connect(owner).setSwapLimit(tokenOut.address, limit, period)
                  })

                  context('when the swap limit is not passed', () => {
                    const previousSwapAmount = amountIn

                    beforeEach('swap some amount', async () => {
                      await tokenIn.mint(smartVault.address, previousSwapAmount)
                      await action.call(SOURCE, previousSwapAmount, slippage, DATA)
                    })

                    itSwapsProperly()
                  })

                  context('when the swap limit is passed', () => {
                    const previousSwapAmount = amountIn.add(1)

                    beforeEach('swap some amount', async () => {
                      await tokenIn.mint(smartVault.address, previousSwapAmount)
                      await action.call(SOURCE, previousSwapAmount, slippage, DATA)
                    })

                    context('before the limit has been reset', () => {
                      itCannotSwap()
                    })

                    context('after the limit has been reset', () => {
                      beforeEach('advance time', async () => {
                        await advanceTime(period)
                      })

                      itSwapsProperly()
                    })
                  })
                })

                context('when the swap limit is based on another token', () => {
                  let tokenLimit: Contract

                  const limitRate = 4 // 1 token in = 4 token limit
                  const limit = amountIn.mul(limitRate).mul(2)
                  const period = MONTH

                  beforeEach('set oracle', async () => {
                    tokenLimit = await createTokenMock()
                    const feed = await createPriceFeedMock(fp(limitRate))
                    const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                    await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                    await smartVault.connect(owner).setPriceFeed(tokenIn.address, tokenLimit.address, feed.address)
                  })

                  beforeEach('set swap limit', async () => {
                    const setSwapLimitRole = action.interface.getSighash('setSwapLimit')
                    await action.connect(owner).authorize(owner.address, setSwapLimitRole)
                    await action.connect(owner).setSwapLimit(tokenLimit.address, limit, period)
                  })

                  context('when the swap limit is not passed', () => {
                    const previousSwapAmount = amountIn

                    beforeEach('swap some amount', async () => {
                      await tokenIn.mint(smartVault.address, previousSwapAmount)
                      await action.call(SOURCE, previousSwapAmount, slippage, DATA)
                    })

                    itSwapsProperly()
                  })

                  context('when the swap limit is passed', () => {
                    const previousSwapAmount = amountIn.add(1)

                    beforeEach('swap some amount', async () => {
                      await tokenIn.mint(smartVault.address, previousSwapAmount)
                      await action.call(SOURCE, previousSwapAmount, slippage, DATA)
                    })

                    context('before the limit has been reset', () => {
                      itCannotSwap()
                    })

                    context('after the limit has been reset', () => {
                      beforeEach('advance time', async () => {
                        await advanceTime(period)
                      })

                      itSwapsProperly()
                    })
                  })
                })
              })

              context('when the token in balance does not pass the threshold', () => {
                const amountIn = threshold.sub(1)

                beforeEach('fund smart vault', async () => {
                  await tokenIn.mint(smartVault.address, amountIn)
                })

                it('reverts', async () => {
                  await expect(action.call(SOURCE, amountIn, 0, DATA)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                })
              })
            })

            context('when the slippage is not acceptable', () => {
              const slippage = fp(1)

              it('reverts', async () => {
                await expect(action.call(SOURCE, 0, slippage, DATA)).to.be.revertedWith('SWAPPER_SLIPPAGE_ABOVE_MAX')
              })
            })
          })

          context('when the token out was not set', () => {
            beforeEach('unset token out', async () => {
              const setTokenOutRole = action.interface.getSighash('setTokenOut')
              await action.connect(owner).authorize(owner.address, setTokenOutRole)
              await action.connect(owner).setTokenOut(ZERO_ADDRESS)
            })

            it('reverts', async () => {
              await expect(action.call(SOURCE, 0, 0, DATA)).to.be.revertedWith('SWAPPER_TOKEN_OUT_NOT_SET')
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
            await expect(action.call(SOURCE, 0, 0, DATA)).to.be.revertedWith('SWAPPER_TOKEN_IN_NOT_SET')
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
          await action.connect(owner).setLimits(fp(100), 0, tokenOut.address)
        })

        beforeEach('set native token price feed for gas 1:1', async () => {
          const feed = await createPriceFeedMock(fp(1))
          await smartVault.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, tokenOut.address, feed.address)
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(SOURCE, 0, 0, DATA)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
