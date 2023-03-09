import {
  assertEvent,
  assertIndirectEvent,
  BigNumberish,
  currentTimestamp,
  fp,
  getSigners,
  MINUTE,
  NATIVE_TOKEN_ADDRESS,
  pct,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  createAction,
  createPriceFeedMock,
  createSmartVault,
  createTokenMock,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { ethers } from 'hardhat'

import { itBehavesLikeBaseSwapper } from './BaseSwapper.behavior'

describe('OneInchSwapper', () => {
  const ONE_INCH_SOURCE = 4

  describe('base', () => {
    itBehavesLikeBaseSwapper('OneInchSwapper')
  })

  describe('call', () => {
    let action: Contract, smartVault: Contract, mimic: Mimic
    let owner: SignerWithAddress, feeCollector: SignerWithAddress, swapSigner: SignerWithAddress

    type ParaSwapData = {
      minAmountOut: BigNumberish
      expectedAmountOut: BigNumberish
      deadline: BigNumberish
      data: string
      sig: string
    }

    const NO_PARASWAP_DATA: ParaSwapData = { minAmountOut: 0, expectedAmountOut: 0, deadline: 0, data: '0x', sig: '0x' }

    before('set up signers', async () => {
      // eslint-disable-next-line prettier/prettier
      [, owner, feeCollector, swapSigner] = await getSigners()
    })

    beforeEach('deploy action', async () => {
      mimic = await setupMimic(true)
      smartVault = await createSmartVault(mimic, owner)
      action = await createAction('OneInchSwapper', mimic, owner, smartVault)
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

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (relayed: boolean) => {
        context('when the token in is not the zero address', () => {
          context('when the token in is an ERC20', () => {
            let tokenIn: Contract

            beforeEach('set token in', async () => {
              tokenIn = await createTokenMock()
            })

            context('when the token in is not ignored', () => {
              beforeEach('allow token in', async () => {
                const setDeniedTokensRole = action.interface.getSighash('setDeniedTokens')
                await action.connect(owner).authorize(owner.address, setDeniedTokensRole)
                await action.connect(owner).setDeniedTokens([tokenIn.address], [false])
              })

              context('when there is a token out set', () => {
                let tokenOut: Contract
                const nativeTokenRate = 3 // 1 token out = 3 native token

                beforeEach('set token out', async () => {
                  tokenOut = await createTokenMock()
                  const setTokenOutRole = action.interface.getSighash('setTokenOut')
                  await action.connect(owner).authorize(owner.address, setTokenOutRole)
                  await action.connect(owner).setTokenOut(tokenOut.address)
                })

                beforeEach('set native token price', async () => {
                  const feed = await createPriceFeedMock(fp(nativeTokenRate))
                  const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                  await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                  await smartVault
                    .connect(owner)
                    .setPriceFeed(tokenOut.address, mimic.wrappedNativeToken.address, feed.address)
                })

                context('when there is a threshold set', () => {
                  const tokenRate = 2 // 1 token in = 2 token out
                  const thresholdAmount = fp(0.1) // in token out
                  const thresholdAmountInTokenIn = thresholdAmount.div(tokenRate) // threshold expressed in token in

                  beforeEach('set in/out feed', async () => {
                    const feed = await createPriceFeedMock(fp(tokenRate))
                    const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                    await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                    await smartVault.connect(owner).setPriceFeed(tokenIn.address, tokenOut.address, feed.address)
                  })

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(tokenOut.address, thresholdAmount)
                  })

                  context('when the smart vault balance passes the threshold', () => {
                    const amountIn = thresholdAmountInTokenIn
                    const minAmountOut = amountIn.mul(tokenRate)

                    beforeEach('fund smart vault', async () => {
                      await tokenIn.mint(smartVault.address, amountIn)
                    })

                    context('when paraswap min amount is lower', () => {
                      const paraSwapMinAmountOut = minAmountOut.sub(1)

                      context('when the slippage is below the limit', () => {
                        const oneInchData = '0xaabb'
                        const slippage = 0.01

                        beforeEach('set max slippage', async () => {
                          const setDefaultMaxSlippageRole = action.interface.getSighash('setDefaultMaxSlippage')
                          await action.connect(owner).authorize(owner.address, setDefaultMaxSlippageRole)
                          await action.connect(owner).setDefaultMaxSlippage(fp(slippage))
                        })

                        beforeEach('fund swap connector', async () => {
                          await mimic.swapConnector.mockRate(fp(tokenRate))
                          await tokenOut.mint(await mimic.swapConnector.dex(), minAmountOut)
                        })

                        const buildParaSwapData = async (
                          signer: SignerWithAddress,
                          amountIn: BigNumberish,
                          deadline: BigNumberish
                        ): Promise<ParaSwapData> => {
                          const paraSwapRouteData = '0xaabbccdd'
                          const expectedAmountOut = paraSwapMinAmountOut.add(pct(paraSwapMinAmountOut, slippage))
                          const sig = await signer.signMessage(
                            ethers.utils.arrayify(
                              ethers.utils.solidityKeccak256(
                                ['address', 'address', 'bool', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
                                [
                                  tokenIn.address,
                                  tokenOut.address,
                                  false,
                                  amountIn,
                                  paraSwapMinAmountOut,
                                  expectedAmountOut,
                                  deadline,
                                  paraSwapRouteData,
                                ]
                              )
                            )
                          )

                          return {
                            minAmountOut: paraSwapMinAmountOut,
                            expectedAmountOut,
                            deadline,
                            data: paraSwapRouteData,
                            sig,
                          }
                        }

                        context('when the swap signer is set', () => {
                          beforeEach('set paraswap signer', async () => {
                            const setSwapSignerRole = action.interface.getSighash('setSwapSigner')
                            await action.connect(owner).authorize(owner.address, setSwapSignerRole)
                            await action.connect(owner).setSwapSigner(swapSigner.address)
                          })

                          context('when the deadline is in the feature', () => {
                            let deadline: BigNumber
                            let paraSwapData: ParaSwapData

                            beforeEach('set deadline', async () => {
                              deadline = (await currentTimestamp()).add(MINUTE)
                            })

                            beforeEach('build paraswap data', async () => {
                              paraSwapData = await buildParaSwapData(swapSigner, amountIn, deadline)
                            })

                            it('calls the swap primitive', async () => {
                              const tx = await action.call(
                                tokenIn.address,
                                amountIn,
                                minAmountOut,
                                oneInchData,
                                paraSwapData
                              )

                              await assertIndirectEvent(tx, smartVault.interface, 'Swap', {
                                source: ONE_INCH_SOURCE,
                                tokenIn,
                                tokenOut,
                                amountIn,
                                minAmountOut,
                                data: oneInchData,
                              })
                            })

                            it('transfers the amount in from the smart vault to the swap connector', async () => {
                              const previousDexBalance = await tokenIn.balanceOf(await mimic.swapConnector.dex())
                              const previousSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)

                              await action.call(tokenIn.address, amountIn, minAmountOut, oneInchData, paraSwapData)

                              const currentDexBalance = await tokenIn.balanceOf(await mimic.swapConnector.dex())
                              expect(currentDexBalance).to.be.eq(previousDexBalance.add(amountIn))

                              const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                              expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.sub(amountIn))
                            })

                            it('transfers the token out from the swap connector to the smart vault', async () => {
                              const previousDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
                              const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                              const previousFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)

                              await action.call(tokenIn.address, amountIn, minAmountOut, oneInchData, paraSwapData)

                              const currentFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)
                              const refund = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

                              const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                              const expectedSmartVaultBalance = previousSmartVaultBalance.add(minAmountOut).sub(refund)
                              expect(currentSmartVaultBalance).to.be.eq(expectedSmartVaultBalance)

                              const currentDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
                              expect(currentDexBalance).to.be.eq(previousDexBalance.sub(minAmountOut))
                            })

                            it('emits an Executed event', async () => {
                              const tx = await action.call(
                                tokenIn.address,
                                amountIn,
                                minAmountOut,
                                oneInchData,
                                paraSwapData
                              )

                              await assertEvent(tx, 'Executed')
                            })

                            if (relayed) {
                              it('refunds gas', async () => {
                                const previousBalance = await tokenOut.balanceOf(feeCollector.address)

                                const tx = await action.call(
                                  tokenIn.address,
                                  amountIn,
                                  minAmountOut,
                                  oneInchData,
                                  paraSwapData
                                )

                                const currentBalance = await tokenOut.balanceOf(feeCollector.address)
                                expect(currentBalance).to.be.gt(previousBalance)

                                const redeemedCost = currentBalance.sub(previousBalance).mul(nativeTokenRate)
                                await assertRelayedBaseCost(tx, redeemedCost, 0.18)
                              })
                            } else {
                              it('does not refund gas', async () => {
                                const previousBalance = await tokenOut.balanceOf(feeCollector.address)

                                await action.call(tokenIn.address, amountIn, minAmountOut, oneInchData, paraSwapData)

                                const currentBalance = await tokenOut.balanceOf(feeCollector.address)
                                expect(currentBalance).to.be.equal(previousBalance)
                              })
                            }
                          })

                          context('when the deadline is in the past', () => {
                            let deadline: BigNumber

                            beforeEach('set deadline', async () => {
                              deadline = await currentTimestamp()
                            })

                            it('reverts', async () => {
                              const paraSwapData = await buildParaSwapData(swapSigner, amountIn, deadline)

                              await expect(
                                action.call(tokenIn.address, amountIn, minAmountOut, oneInchData, paraSwapData)
                              ).to.be.revertedWith('SWAPPER_DEADLINE_EXPIRED')
                            })
                          })
                        })

                        context('when the swap signer is not set', () => {
                          it('reverts', async () => {
                            const paraSwapData = await buildParaSwapData(swapSigner, amountIn, 0)

                            await expect(
                              action.call(tokenIn.address, amountIn, minAmountOut, oneInchData, paraSwapData)
                            ).to.be.revertedWith('SWAPPER_INVALID_SIGNATURE')
                          })
                        })
                      })

                      context('when the slippage is above the limit', () => {
                        const slippage = 0.01
                        const paraSwapExpectedAmountOut = minAmountOut.add(pct(minAmountOut, slippage))

                        it('reverts', async () => {
                          const paraSwapData = {
                            minAmountOut: paraSwapMinAmountOut,
                            expectedAmountOut: paraSwapExpectedAmountOut,
                            deadline: 0,
                            data: '0x',
                            sig: '0x',
                          }

                          await expect(
                            action.call(tokenIn.address, amountIn, minAmountOut, '0x', paraSwapData)
                          ).to.be.revertedWith('SWAPPER_SLIPPAGE_TOO_BIG')
                        })
                      })
                    })

                    context('when paraswap min amount is greater', () => {
                      const paraSwapMinAmountOut = minAmountOut.add(1)

                      it('reverts', async () => {
                        const paraSwapData = {
                          minAmountOut: paraSwapMinAmountOut,
                          expectedAmountOut: 0,
                          deadline: 0,
                          data: '0x',
                          sig: '0x',
                        }

                        await expect(
                          action.call(tokenIn.address, amountIn, minAmountOut, '0x', paraSwapData)
                        ).to.be.revertedWith('SWAPPER_1INCH_MIN_AMOUNT_LT_PSP')
                      })
                    })
                  })

                  context('when the smart vault balance does not pass the threshold', () => {
                    const amountIn = thresholdAmountInTokenIn.div(2)

                    beforeEach('fund smart vault', async () => {
                      await tokenIn.mint(smartVault.address, amountIn)
                    })

                    it('reverts', async () => {
                      await expect(
                        action.call(tokenIn.address, amountIn, 0, '0x', NO_PARASWAP_DATA)
                      ).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                    })
                  })
                })

                context('when there is no threshold set', () => {
                  it('reverts', async () => {
                    await expect(action.call(tokenIn.address, 0, 0, '0x', NO_PARASWAP_DATA)).to.be.reverted
                  })
                })
              })

              context('when the token out is not set', () => {
                it('reverts', async () => {
                  await expect(action.call(tokenIn.address, 0, 0, '0x', NO_PARASWAP_DATA)).to.be.reverted
                })
              })
            })

            context('when the token in is denied', () => {
              beforeEach('deny token in', async () => {
                const setDeniedTokensRole = action.interface.getSighash('setDeniedTokens')
                await action.connect(owner).authorize(owner.address, setDeniedTokensRole)
                await action.connect(owner).setDeniedTokens([tokenIn.address], [true])
              })

              it('reverts', async () => {
                await expect(action.call(tokenIn.address, 0, 0, '0x', NO_PARASWAP_DATA)).to.be.revertedWith(
                  'SWAPPER_DENIED_TOKEN'
                )
              })
            })
          })

          context('when the token to swap is the native token', () => {
            const tokenIn = NATIVE_TOKEN_ADDRESS

            it('reverts', async () => {
              await expect(action.call(tokenIn, 0, 0, '0x', NO_PARASWAP_DATA)).to.be.revertedWith(
                'SWAPPER_NATIVE_TOKEN'
              )
            })
          })
        })

        context('when the token in is the zero address', () => {
          const tokenIn = ZERO_ADDRESS

          it('reverts', async () => {
            await expect(action.call(tokenIn, 0, 0, '0x', NO_PARASWAP_DATA)).to.be.revertedWith(
              'SWAPPER_TOKEN_ADDRESS_ZERO'
            )
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

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS, 0, 0, '0x', NO_PARASWAP_DATA)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })
})
