import {
  assertEvent,
  assertIndirectEvent,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
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
import { ethers } from 'hardhat'

describe('Holder', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('Holder', mimic, owner, smartVault)
  })

  describe('setTokenOut', () => {
    let tokenOut: Contract

    beforeEach('deploy token out', async () => {
      tokenOut = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenOutRole = action.interface.getSighash('setTokenOut')
        await action.connect(owner).authorize(owner.address, setTokenOutRole)
        action = action.connect(owner)
      })

      context('when the given address is not zero', () => {
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
          itCanSetTheTokenProperly()
        })
      })

      context('when the given address is zero', () => {
        it('reverts', async () => {
          await expect(action.setTokenOut(ZERO_ADDRESS)).to.be.revertedWith('HOLDER_TOKEN_OUT_ZERO')
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
    const SOURCE = 3
    const DATA = '0xaaaabbbb'

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      context('when the token out was set', () => {
        let tokenOut: Contract

        context('when the token out is the wrapped native token', () => {
          beforeEach('set token out', async () => {
            tokenOut = mimic.wrappedNativeToken
            const setTokenOutRole = action.interface.getSighash('setTokenOut')
            await action.connect(owner).authorize(owner.address, setTokenOutRole)
            await action.connect(owner).setTokenOut(tokenOut.address)
          })

          context('when the token in is not zero', () => {
            context('when the token in is the native token', () => {
              const tokenIn = NATIVE_TOKEN_ADDRESS

              beforeEach('authorize action', async () => {
                const wrapRole = smartVault.interface.getSighash('wrap')
                await smartVault.connect(owner).authorize(action.address, wrapRole)
              })

              context('when the requested slippage is acceptable', () => {
                const slippage = fp(0.02)

                beforeEach('set max slippage', async () => {
                  const setMaxSlippage = action.interface.getSighash('setMaxSlippage')
                  await action.connect(owner).authorize(owner.address, setMaxSlippage)
                  await action.connect(owner).setMaxSlippage(slippage)
                })

                context('when the amount in passes the threshold', () => {
                  const amountIn = fp(1)

                  beforeEach('fund smart vault', async () => {
                    await other.sendTransaction({ to: smartVault.address, value: amountIn })
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    // token in is the native token, using the wrapped for the feed
                    await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, amountIn)
                  })

                  it('can execute', async () => {
                    expect(await action.canExecute(tokenIn, amountIn, slippage)).to.be.true
                  })

                  it('calls the wrap primitive', async () => {
                    const tx = await action.call(SOURCE, tokenIn, amountIn, slippage, DATA)

                    await assertIndirectEvent(tx, smartVault.interface, 'Wrap', {
                      amount: amountIn,
                      wrapped: amountIn,
                      data: '0x',
                    })
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(SOURCE, tokenIn, amountIn, slippage, DATA)

                    await assertEvent(tx, 'Executed')
                  })
                })

                context('when the token in balance does not pass the threshold', () => {
                  const amountIn = fp(1)

                  beforeEach('fund smart vault', async () => {
                    await other.sendTransaction({ to: smartVault.address, value: amountIn })
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    // token in is the native token, using the wrapped for the feed
                    await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, amountIn.mul(2))
                  })

                  it('reverts', async () => {
                    await expect(action.call(SOURCE, tokenIn, amountIn, 0, DATA)).to.be.revertedWith(
                      'MIN_THRESHOLD_NOT_MET'
                    )
                  })
                })
              })

              context('when the slippage is not acceptable', () => {
                const slippage = fp(1)

                it('reverts', async () => {
                  await expect(action.call(SOURCE, tokenIn, 0, slippage, DATA)).to.be.revertedWith(
                    'HOLDER_SLIPPAGE_ABOVE_MAX'
                  )
                })
              })
            })

            context('when the token in is another token', () => {
              let tokenIn: Contract
              const priceRate = 2

              beforeEach('deploy token in', async () => {
                tokenIn = await createTokenMock()
              })

              beforeEach('authorize action', async () => {
                const swapRole = smartVault.interface.getSighash('swap')
                await smartVault.connect(owner).authorize(action.address, swapRole)
              })

              beforeEach('set price feed', async () => {
                const feed = await createPriceFeedMock(fp(priceRate))
                const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                // token in is the native token, using the wrapped for the feed
                await smartVault
                  .connect(owner)
                  .setPriceFeed(tokenIn.address, mimic.wrappedNativeToken.address, feed.address)
              })

              beforeEach('fund swap connector', async () => {
                await mimic.swapConnector.mockRate(fp(priceRate))
                await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(10) })
                await mimic.wrappedNativeToken.connect(owner).transfer(await mimic.swapConnector.dex(), fp(10))
              })

              context('when the requested slippage is acceptable', () => {
                const slippage = fp(0.02)

                beforeEach('set max slippage', async () => {
                  const setMaxSlippage = action.interface.getSighash('setMaxSlippage')
                  await action.connect(owner).authorize(owner.address, setMaxSlippage)
                  await action.connect(owner).setMaxSlippage(slippage)
                })

                context('when the amount in passes the threshold', () => {
                  const amountIn = fp(1)
                  const expectedAmountOut = amountIn.mul(priceRate)
                  const minAmountOut = expectedAmountOut.sub(expectedAmountOut.mul(slippage).div(fp(1)))

                  beforeEach('fund smart vault', async () => {
                    await tokenIn.mint(smartVault.address, amountIn)
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(tokenIn.address, amountIn)
                  })

                  it('can execute', async () => {
                    expect(await action.canExecute(tokenIn.address, amountIn, slippage)).to.be.true
                  })

                  it('calls swap primitive', async () => {
                    const tx = await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

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

                    await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

                    const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(0)

                    const currentDexBalance = await tokenIn.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.add(previousSmartVaultBalance))
                  })

                  it('transfers the token out to the smart vault', async () => {
                    const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    const previousDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())

                    await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

                    const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.add(expectedAmountOut))

                    const currentDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.sub(expectedAmountOut))
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

                    await assertEvent(tx, 'Executed')
                  })
                })

                context('when the token in balance does not pass the threshold', () => {
                  const amountIn = fp(1)

                  beforeEach('fund smart vault', async () => {
                    await other.sendTransaction({ to: smartVault.address, value: amountIn })
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(tokenIn.address, amountIn.mul(2))
                  })

                  it('reverts', async () => {
                    await expect(action.call(SOURCE, tokenIn.address, amountIn, 0, DATA)).to.be.revertedWith(
                      'MIN_THRESHOLD_NOT_MET'
                    )
                  })
                })
              })

              context('when the slippage is not acceptable', () => {
                const slippage = fp(1)

                it('reverts', async () => {
                  await expect(action.call(SOURCE, tokenIn.address, 0, slippage, DATA)).to.be.revertedWith(
                    'HOLDER_SLIPPAGE_ABOVE_MAX'
                  )
                })
              })
            })

            context('when the token in is the wrapped native token', () => {
              let tokenIn: Contract

              beforeEach('set token in', async () => {
                tokenIn = mimic.wrappedNativeToken
              })

              it('reverts', async () => {
                await expect(action.call(SOURCE, tokenIn.address, 0, 0, DATA)).to.be.revertedWith(
                  'HOLDER_TOKEN_IN_EQ_OUT'
                )
              })
            })
          })

          context('when the token in is zero', () => {
            const tokenIn = ZERO_ADDRESS

            it('reverts', async () => {
              await expect(action.call(SOURCE, tokenIn, 0, 0, DATA)).to.be.revertedWith('HOLDER_TOKEN_IN_ZERO')
            })
          })
        })

        context('when the token out is another token', () => {
          let tokenOut: Contract

          beforeEach('set token out', async () => {
            tokenOut = await createTokenMock()
            const setTokenOutRole = action.interface.getSighash('setTokenOut')
            await action.connect(owner).authorize(owner.address, setTokenOutRole)
            await action.connect(owner).setTokenOut(tokenOut.address)
          })

          context('when the token in is not zero', () => {
            context('when the token in is the native token', () => {
              const tokenIn = NATIVE_TOKEN_ADDRESS
              const priceRate = 2

              beforeEach('authorize action', async () => {
                const wrapRole = smartVault.interface.getSighash('wrap')
                await smartVault.connect(owner).authorize(action.address, wrapRole)
                const swapRole = smartVault.interface.getSighash('swap')
                await smartVault.connect(owner).authorize(action.address, swapRole)
              })

              beforeEach('set price feed', async () => {
                const feed = await createPriceFeedMock(fp(priceRate))
                const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                // token in is the native token, using the wrapped for the feed
                await smartVault
                  .connect(owner)
                  .setPriceFeed(mimic.wrappedNativeToken.address, tokenOut.address, feed.address)
              })

              beforeEach('fund swap connector', async () => {
                await mimic.swapConnector.mockRate(fp(priceRate))
                await tokenOut.mint(await mimic.swapConnector.dex(), fp(100))
              })

              context('when the requested slippage is acceptable', () => {
                const slippage = fp(0.02)

                beforeEach('set max slippage', async () => {
                  const setMaxSlippage = action.interface.getSighash('setMaxSlippage')
                  await action.connect(owner).authorize(owner.address, setMaxSlippage)
                  await action.connect(owner).setMaxSlippage(slippage)
                })

                context('when the amount in passes the threshold', () => {
                  const amountIn = fp(1)
                  const expectedAmountOut = amountIn.mul(priceRate)
                  const minAmountOut = expectedAmountOut.sub(expectedAmountOut.mul(slippage).div(fp(1)))

                  beforeEach('fund smart vault', async () => {
                    await other.sendTransaction({ to: smartVault.address, value: amountIn })
                    await mimic.wrappedNativeToken.connect(owner).deposit({ value: amountIn })
                    await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, amountIn)
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    // token in is the native token, using the wrapped for the feed
                    await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, amountIn)
                  })

                  it('can execute', async () => {
                    expect(await action.canExecute(tokenIn, amountIn, slippage)).to.be.true
                  })

                  it('calls the swap and wrap primitives', async () => {
                    const tx = await action.call(SOURCE, tokenIn, amountIn, slippage, DATA)

                    await assertIndirectEvent(tx, smartVault.interface, 'Wrap', {
                      amount: amountIn,
                      wrapped: amountIn,
                      data: '0x',
                    })

                    await assertIndirectEvent(tx, smartVault.interface, 'Swap', {
                      source: SOURCE,
                      tokenIn: mimic.wrappedNativeToken.address,
                      tokenOut,
                      amountIn,
                      minAmountOut,
                      data: DATA,
                    })
                  })

                  it('transfers the token in to the swap connector', async () => {
                    const previousSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
                    const previousDexBalance = await mimic.wrappedNativeToken.balanceOf(await mimic.swapConnector.dex())

                    await action.call(SOURCE, tokenIn, amountIn, slippage, DATA)

                    const currentSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(0)

                    const currentDexBalance = await mimic.wrappedNativeToken.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.add(previousSmartVaultBalance))
                  })

                  it('transfers the token out to the smart vault', async () => {
                    const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    const previousDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())

                    await action.call(SOURCE, tokenIn, amountIn, slippage, DATA)

                    const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.add(expectedAmountOut))

                    const currentDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.sub(expectedAmountOut))
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(SOURCE, tokenIn, amountIn, slippage, DATA)

                    await assertEvent(tx, 'Executed')
                  })
                })

                context('when the token in balance does not pass the threshold', () => {
                  const amountIn = fp(1)

                  beforeEach('fund smart vault', async () => {
                    await other.sendTransaction({ to: smartVault.address, value: amountIn })
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    // token in is the native token, using the wrapped for the feed
                    await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, amountIn.mul(2))
                  })

                  it('reverts', async () => {
                    await expect(action.call(SOURCE, tokenIn, amountIn, 0, DATA)).to.be.revertedWith(
                      'MIN_THRESHOLD_NOT_MET'
                    )
                  })
                })
              })

              context('when the slippage is not acceptable', () => {
                const slippage = fp(1)

                it('reverts', async () => {
                  await expect(action.call(SOURCE, tokenIn, 0, slippage, DATA)).to.be.revertedWith(
                    'HOLDER_SLIPPAGE_ABOVE_MAX'
                  )
                })
              })
            })

            context('when the token in is another token', () => {
              let tokenIn: Contract
              const priceRate = 2

              beforeEach('deploy token in', async () => {
                tokenIn = await createTokenMock()
              })

              beforeEach('authorize action', async () => {
                const swapRole = smartVault.interface.getSighash('swap')
                await smartVault.connect(owner).authorize(action.address, swapRole)
              })

              beforeEach('set price feed', async () => {
                const feed = await createPriceFeedMock(fp(priceRate))
                const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                await smartVault.connect(owner).setPriceFeed(tokenIn.address, tokenOut.address, feed.address)
              })

              beforeEach('fund swap connector', async () => {
                await mimic.swapConnector.mockRate(fp(priceRate))
                await tokenOut.mint(await mimic.swapConnector.dex(), fp(10))
              })

              context('when the requested slippage is acceptable', () => {
                const slippage = fp(0.02)

                beforeEach('set max slippage', async () => {
                  const setMaxSlippage = action.interface.getSighash('setMaxSlippage')
                  await action.connect(owner).authorize(owner.address, setMaxSlippage)
                  await action.connect(owner).setMaxSlippage(slippage)
                })

                context('when the amount in passes the threshold', () => {
                  const amountIn = fp(1)
                  const expectedAmountOut = amountIn.mul(priceRate)
                  const minAmountOut = expectedAmountOut.sub(expectedAmountOut.mul(slippage).div(fp(1)))

                  beforeEach('fund smart vault', async () => {
                    await tokenIn.mint(smartVault.address, amountIn)
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(tokenIn.address, amountIn)
                  })

                  it('can execute', async () => {
                    expect(await action.canExecute(tokenIn.address, amountIn, slippage)).to.be.true
                  })

                  it('calls swap primitive', async () => {
                    const tx = await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

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

                    await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

                    const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(0)

                    const currentDexBalance = await tokenIn.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.add(previousSmartVaultBalance))
                  })

                  it('transfers the token out to the smart vault', async () => {
                    const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    const previousDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())

                    await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

                    const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.add(expectedAmountOut))

                    const currentDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.sub(expectedAmountOut))
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

                    await assertEvent(tx, 'Executed')
                  })
                })

                context('when the token in balance does not pass the threshold', () => {
                  const amountIn = fp(1)

                  beforeEach('fund smart vault', async () => {
                    await other.sendTransaction({ to: smartVault.address, value: amountIn })
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(tokenIn.address, amountIn.mul(2))
                  })

                  it('reverts', async () => {
                    await expect(action.call(SOURCE, tokenIn.address, amountIn, 0, DATA)).to.be.revertedWith(
                      'MIN_THRESHOLD_NOT_MET'
                    )
                  })
                })
              })

              context('when the slippage is not acceptable', () => {
                const slippage = fp(1)

                it('reverts', async () => {
                  await expect(action.call(SOURCE, tokenIn.address, 0, slippage, DATA)).to.be.revertedWith(
                    'HOLDER_SLIPPAGE_ABOVE_MAX'
                  )
                })
              })
            })

            context('when the token in is the wrapped native token', () => {
              let tokenIn: Contract
              const priceRate = 2

              beforeEach('set token in', async () => {
                tokenIn = mimic.wrappedNativeToken
              })

              beforeEach('authorize action', async () => {
                const swapRole = smartVault.interface.getSighash('swap')
                await smartVault.connect(owner).authorize(action.address, swapRole)
              })

              beforeEach('set price feed', async () => {
                const feed = await createPriceFeedMock(fp(priceRate))
                const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                await smartVault.connect(owner).setPriceFeed(tokenIn.address, tokenOut.address, feed.address)
              })

              beforeEach('fund swap connector', async () => {
                await mimic.swapConnector.mockRate(fp(priceRate))
                await tokenOut.mint(await mimic.swapConnector.dex(), fp(100))
              })

              context('when the requested slippage is acceptable', () => {
                const slippage = fp(0.02)

                beforeEach('set max slippage', async () => {
                  const setMaxSlippage = action.interface.getSighash('setMaxSlippage')
                  await action.connect(owner).authorize(owner.address, setMaxSlippage)
                  await action.connect(owner).setMaxSlippage(slippage)
                })

                context('when the amount in passes the threshold', () => {
                  const amountIn = fp(1)
                  const expectedAmountOut = amountIn.mul(priceRate)
                  const minAmountOut = expectedAmountOut.sub(expectedAmountOut.mul(slippage).div(fp(1)))

                  beforeEach('fund smart vault', async () => {
                    await other.sendTransaction({ to: smartVault.address, value: amountIn })
                    await tokenIn.connect(owner).deposit({ value: amountIn })
                    await tokenIn.connect(owner).transfer(smartVault.address, amountIn)
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, amountIn)
                  })

                  it('can execute', async () => {
                    expect(await action.canExecute(tokenIn.address, amountIn, slippage)).to.be.true
                  })

                  it('calls the swap primitives', async () => {
                    const tx = await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

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
                    const previousSmartVaultBalance = await mimic.wrappedNativeToken.balanceOf(smartVault.address)
                    const previousDexBalance = await mimic.wrappedNativeToken.balanceOf(await mimic.swapConnector.dex())

                    await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

                    const currentSmartVaultBalance = await mimic.wrappedNativeToken.balanceOf(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(0)

                    const currentDexBalance = await mimic.wrappedNativeToken.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.add(previousSmartVaultBalance))
                  })

                  it('transfers the token out to the smart vault', async () => {
                    const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    const previousDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())

                    await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

                    const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                    expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.add(expectedAmountOut))

                    const currentDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.sub(expectedAmountOut))
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(SOURCE, tokenIn.address, amountIn, slippage, DATA)

                    await assertEvent(tx, 'Executed')
                  })
                })

                context('when the token in balance does not pass the threshold', () => {
                  const amountIn = fp(1)

                  beforeEach('fund smart vault', async () => {
                    await other.sendTransaction({ to: smartVault.address, value: amountIn })
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(tokenIn.address, amountIn.mul(2))
                  })

                  it('reverts', async () => {
                    await expect(action.call(SOURCE, tokenIn.address, amountIn, 0, DATA)).to.be.revertedWith(
                      'MIN_THRESHOLD_NOT_MET'
                    )
                  })
                })
              })

              context('when the slippage is not acceptable', () => {
                const slippage = fp(1)

                it('reverts', async () => {
                  await expect(action.call(SOURCE, tokenIn.address, 0, slippage, DATA)).to.be.revertedWith(
                    'HOLDER_SLIPPAGE_ABOVE_MAX'
                  )
                })
              })
            })
          })

          context('when the token in is zero', () => {
            const tokenIn = ZERO_ADDRESS

            it('reverts', async () => {
              await expect(action.call(SOURCE, tokenIn, 0, 0, DATA)).to.be.revertedWith('HOLDER_TOKEN_IN_ZERO')
            })
          })
        })
      })

      context('when the token out was not set', () => {
        it('reverts', async () => {
          await expect(action.call(SOURCE, ZERO_ADDRESS, 0, 0, DATA)).to.be.revertedWith('HOLDER_TOKEN_OUT_NOT_SET')
        })
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(SOURCE, ZERO_ADDRESS, 0, 0, DATA)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
