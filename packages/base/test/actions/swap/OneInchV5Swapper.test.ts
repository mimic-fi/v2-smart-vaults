import { assertEvent, assertIndirectEvent, deploy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { createSmartVault, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { assertRelayedBaseCost } from '../../../src/asserts'
import { buildEmptyActionConfig, createPriceFeedMock, createTokenMock } from '../../../src/setup'
import { itBehavesLikeSwapperAction } from './SwapperAction.behavior'

describe('OneInchV5Swapper', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, feeCollector, ] = await getSigners()
  })

  before('set up mimic', async () => {
    mimic = await setupMimic(true)
  })

  beforeEach('deploy action', async () => {
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('OneInchV5Swapper', [
      {
        tokenOut: ZERO_ADDRESS,
        maxSlippage: 0,
        customTokensOut: [],
        customMaxSlippages: [],
        actionConfig: buildEmptyActionConfig(owner, smartVault),
      },
    ])
  })

  describe('swapper', () => {
    beforeEach('set params', async function () {
      this.owner = owner
      this.action = action
    })

    itBehavesLikeSwapperAction()
  })

  describe('call', () => {
    const SOURCE = 4

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

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (relayed: boolean) => {
        context('when the token in is not the zero address', () => {
          let tokenIn: Contract

          beforeEach('set token in', async () => {
            tokenIn = await createTokenMock()
          })

          context('when the amount in is not zero', () => {
            const tokenRate = 2 // 1 token in = 2 token out
            const thresholdAmount = fp(0.1) // in token out
            const thresholdAmountInTokenIn = thresholdAmount.div(tokenRate) // threshold expressed in token in
            const amountIn = thresholdAmountInTokenIn

            context('when the token in is allowed', () => {
              context('when there is a token out set', () => {
                let tokenOut: Contract

                beforeEach('set default token out', async () => {
                  tokenOut = await createTokenMock()
                  const setDefaultTokenOutRole = action.interface.getSighash('setDefaultTokenOut')
                  await action.connect(owner).authorize(owner.address, setDefaultTokenOutRole)
                  await action.connect(owner).setDefaultTokenOut(tokenOut.address)
                })

                beforeEach('set price feed', async () => {
                  const feed = await createPriceFeedMock(fp(tokenRate))
                  const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                  await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                  await smartVault.connect(owner).setPriceFeed(tokenIn.address, tokenOut.address, feed.address)
                })

                beforeEach('set threshold', async () => {
                  const setDefaultTokenThresholdRole = action.interface.getSighash('setDefaultTokenThreshold')
                  await action.connect(owner).authorize(owner.address, setDefaultTokenThresholdRole)
                  await action.connect(owner).setDefaultTokenThreshold({
                    token: tokenOut.address,
                    min: thresholdAmount,
                    max: 0,
                  })
                })

                context('when the smart vault balance passes the threshold', () => {
                  beforeEach('fund smart vault', async () => {
                    await tokenIn.mint(smartVault.address, amountIn)
                  })

                  context('when the slippage is below the limit', () => {
                    const data = '0xaabb'
                    const slippage = fp(0.01)
                    const expectedAmountOut = amountIn.mul(tokenRate)
                    const minAmountOut = expectedAmountOut.mul(fp(1).sub(slippage)).div(fp(1))

                    beforeEach('set max slippage', async () => {
                      const setDefaultMaxSlippageRole = action.interface.getSighash('setDefaultMaxSlippage')
                      await action.connect(owner).authorize(owner.address, setDefaultMaxSlippageRole)
                      await action.connect(owner).setDefaultMaxSlippage(slippage)
                    })

                    beforeEach('fund swap connector', async () => {
                      await mimic.swapConnector.mockRate(fp(tokenRate))
                      await tokenOut.mint(await mimic.swapConnector.dex(), expectedAmountOut)
                    })

                    it('calls the swap primitive', async () => {
                      const tx = await action.call(tokenIn.address, amountIn, slippage, data)

                      await assertIndirectEvent(tx, smartVault.interface, 'Swap', {
                        source: SOURCE,
                        tokenIn,
                        tokenOut,
                        amountIn,
                        minAmountOut,
                        data,
                      })
                    })

                    it('transfers the amount in from the smart vault to the swap connector', async () => {
                      const previousDexBalance = await tokenIn.balanceOf(await mimic.swapConnector.dex())
                      const previousSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)

                      await action.call(tokenIn.address, amountIn, slippage, data)

                      const currentDexBalance = await tokenIn.balanceOf(await mimic.swapConnector.dex())
                      expect(currentDexBalance).to.be.eq(previousDexBalance.add(amountIn))

                      const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                      expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.sub(amountIn))
                    })

                    it('transfers the token out from the swap connector to the smart vault', async () => {
                      const previousDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
                      const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)

                      await action.call(tokenIn.address, amountIn, slippage, data)

                      const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                      const expectedSmartVaultBalance = previousSmartVaultBalance.add(expectedAmountOut)
                      expect(currentSmartVaultBalance).to.be.eq(expectedSmartVaultBalance)

                      const currentDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
                      expect(currentDexBalance).to.be.eq(previousDexBalance.sub(expectedAmountOut))
                    })

                    it('emits an Executed event', async () => {
                      const tx = await action.call(tokenIn.address, amountIn, slippage, data)

                      await assertEvent(tx, 'Executed')
                    })

                    if (relayed) {
                      it('refunds gas', async () => {
                        const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                        const tx = await action.call(tokenIn.address, amountIn, slippage, data)

                        const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                        expect(currentBalance).to.be.gt(previousBalance)

                        const redeemedCost = currentBalance.sub(previousBalance)
                        await assertRelayedBaseCost(tx, redeemedCost, 0.1)
                      })
                    } else {
                      it('does not refund gas', async () => {
                        const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                        await action.call(tokenIn.address, amountIn, slippage, data)

                        const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                        expect(currentBalance).to.be.equal(previousBalance)
                      })
                    }
                  })

                  context('when the slippage is above the limit', () => {
                    const slippage = fp(0.01)

                    it('reverts', async () => {
                      await expect(action.call(tokenIn.address, amountIn, slippage, '0x')).to.be.revertedWith(
                        'ACTION_SLIPPAGE_TOO_HIGH'
                      )
                    })
                  })
                })

                context('when the smart vault balance does not pass the threshold', () => {
                  const amountIn = thresholdAmountInTokenIn.div(2)

                  beforeEach('fund smart vault', async () => {
                    await tokenIn.mint(smartVault.address, amountIn)
                  })

                  it('reverts', async () => {
                    await expect(action.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith(
                      'ACTION_TOKEN_THRESHOLD_NOT_MET'
                    )
                  })
                })
              })

              context('when the token out is not set', () => {
                it('reverts', async () => {
                  await expect(action.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith(
                    'ACTION_TOKEN_OUT_NOT_SET'
                  )
                })
              })
            })

            context('when the token in is denied', () => {
              beforeEach('deny token in', async () => {
                const setTokensAcceptanceListRole = action.interface.getSighash('setTokensAcceptanceList')
                await action.connect(owner).authorize(owner.address, setTokensAcceptanceListRole)
                await action.connect(owner).setTokensAcceptanceList([tokenIn.address], [])
              })

              it('reverts', async () => {
                await expect(action.call(tokenIn.address, 0, 0, '0x')).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
              })
            })
          })

          context('when the amount in is zero', () => {
            const amountIn = 0

            it('reverts', async () => {
              await expect(action.call(tokenIn.address, amountIn, 0, '0x')).to.be.revertedWith('ACTION_AMOUNT_ZERO')
            })
          })
        })

        context('when the token in is the zero address', () => {
          const tokenIn = ZERO_ADDRESS

          it('reverts', async () => {
            await expect(action.call(tokenIn, 0, 0, '0x')).to.be.revertedWith('ACTION_TOKEN_ZERO')
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayersRole = action.interface.getSighash('setRelayers')
          await action.connect(owner).authorize(owner.address, setRelayersRole)
          await action.connect(owner).setRelayers([owner.address], [])
        })

        beforeEach('set relay gas token', async () => {
          const setRelayGasTokenRole = action.interface.getSighash('setRelayGasToken')
          await action.connect(owner).authorize(owner.address, setRelayGasTokenRole)
          await action.connect(owner).setRelayGasToken(mimic.wrappedNativeToken.address)
        })

        beforeEach('fund smart vault with wrapped native token to pay gas', async () => {
          await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(0.001) })
          await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, fp(0.001))
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS, 0, 0, '0x')).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
