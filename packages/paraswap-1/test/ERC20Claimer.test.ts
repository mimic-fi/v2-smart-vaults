import {
  assertEvent,
  assertIndirectEvent,
  assertNoIndirectEvent,
  bn,
  currentTimestamp,
  deploy,
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

describe('ERC20Claimer', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic, wrappedNativeToken: Contract
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress, swapSigner: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector, swapSigner] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('ERC20Claimer', mimic, owner, smartVault)
    wrappedNativeToken = mimic.wrappedNativeToken
  })

  describe('setFeeClaimer', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
        await action.connect(owner).authorize(owner.address, setFeeClaimerRole)
        action = action.connect(owner)
      })

      it('sets the swap signer', async () => {
        await action.setFeeClaimer(other.address)

        expect(await action.feeClaimer()).to.be.equal(other.address)
      })

      it('emits an event', async () => {
        const tx = await action.setFeeClaimer(other.address)

        await assertEvent(tx, 'FeeClaimerSet', { feeClaimer: other })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setFeeClaimer(other.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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

  describe('setIgnoreTokenSwaps', () => {
    let token1: Contract, token2: Contract

    beforeEach('deploy tokens', async () => {
      token1 = await createTokenMock()
      token2 = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setIgnoreTokenSwapsRole = action.interface.getSighash('setIgnoreTokenSwaps')
        await action.connect(owner).authorize(owner.address, setIgnoreTokenSwapsRole)
        action = action.connect(owner)
      })

      it('sets the swap ignores', async () => {
        await action.setIgnoreTokenSwaps([token1.address, token2.address], [true, false])

        expect(await action.isTokenSwapIgnored(token1.address)).to.be.true
        expect(await action.isTokenSwapIgnored(token2.address)).to.be.false
      })

      it('emits an event', async () => {
        const tx = await action.setIgnoreTokenSwaps([token1.address, token2.address], [true, false])

        await assertEvent(tx, 'IgnoreTokenSwapSet', { token: token1, ignored: true })
        await assertEvent(tx, 'IgnoreTokenSwapSet', { token: token2, ignored: false })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setIgnoreTokenSwaps([token1.address, token2.address], [true, false])).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('call', () => {
    let deadline: BigNumber, signature: string
    let feeClaimer: Contract, token: Contract, thresholdToken: Contract

    const swapRate = 2
    const slippage = 0.02
    const data = '0xaaaabbbb'
    const amountToClaim = fp(1)
    const currentBalance = fp(0.5)
    const amountIn = amountToClaim.add(currentBalance)
    const expectedAmountOut = amountIn.mul(swapRate)
    const minAmountOut = expectedAmountOut.sub(pct(expectedAmountOut, slippage))
    const thresholdRate = 2

    beforeEach('authorize action', async () => {
      const callRole = smartVault.interface.getSighash('call')
      await smartVault.connect(owner).authorize(action.address, callRole)
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

    beforeEach('deploy fee claimer', async () => {
      feeClaimer = await deploy('FeeClaimerMock')
      const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
      await action.connect(owner).authorize(owner.address, setFeeClaimerRole)
      await action.connect(owner).setFeeClaimer(feeClaimer.address)
    })

    beforeEach('fund swap connector', async () => {
      const swapConnectorRate = fp(swapRate * (1 - slippage))
      await mimic.swapConnector.mockRate(swapConnectorRate)
      await wrappedNativeToken.connect(owner).deposit({ value: minAmountOut })
      await wrappedNativeToken.connect(owner).transfer(await mimic.swapConnector.dex(), minAmountOut)
    })

    beforeEach('deploy threshold token', async () => {
      thresholdToken = await createTokenMock()
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)

      const feed = await createPriceFeedMock(fp(thresholdRate))
      const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
      await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
      await smartVault.connect(owner).setPriceFeed(wrappedNativeToken.address, thresholdToken.address, feed.address)
    })

    beforeEach('fund fee claimer', async () => {
      token = await createTokenMock()
      await token.mint(feeClaimer.address, amountToClaim)
    })

    beforeEach('mint tokens to smart vault', async () => {
      await token.mint(smartVault.address, currentBalance)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the token to collect is an ERC20', () => {
          context('when the amount to claim passes the threshold', () => {
            const thresholdAmount = minAmountOut.mul(thresholdRate)

            beforeEach('set threshold', async () => {
              await action.connect(owner).setThreshold(thresholdToken.address, thresholdAmount)
            })

            context('when the slippage is acceptable', () => {
              const maxSlippage = fp(slippage).add(1)

              beforeEach('set max slippage', async () => {
                const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
                await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
                await action.connect(owner).setMaxSlippage(maxSlippage)
              })

              const sign = async (signer: SignerWithAddress, deadline: BigNumber): Promise<string> => {
                return signer.signMessage(
                  ethers.utils.arrayify(
                    ethers.utils.solidityKeccak256(
                      ['address', 'address', 'bool', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
                      [
                        token.address,
                        wrappedNativeToken.address,
                        false,
                        amountIn,
                        minAmountOut,
                        expectedAmountOut,
                        deadline,
                        data,
                      ]
                    )
                  )
                )
              }

              context('when the token is marked to be swapped', () => {
                beforeEach('do not swap token', async () => {
                  const setIgnoreTokenSwapsRole = action.interface.getSighash('setIgnoreTokenSwaps')
                  await action.connect(owner).authorize(owner.address, setIgnoreTokenSwapsRole)
                  await action.connect(owner).setIgnoreTokenSwaps([token.address], [false])
                })

                context('when the message is sign by the swap signer', () => {
                  beforeEach('set swap signer', async () => {
                    const setSwapSignerRole = action.interface.getSighash('setSwapSigner')
                    await action.connect(owner).authorize(owner.address, setSwapSignerRole)
                    await action.connect(owner).setSwapSigner(swapSigner.address)
                  })

                  context('when the deadline is not expired', () => {
                    beforeEach('set future deadline', async () => {
                      deadline = (await currentTimestamp()).add(MINUTE)
                      signature = await sign(swapSigner, deadline)
                    })

                    context('when the fee claim succeeds', () => {
                      beforeEach('mock succeeds', async () => {
                        await feeClaimer.mockFail(false)
                      })

                      it('calls the call primitive', async () => {
                        const tx = await action.call(
                          token.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        const callData = feeClaimer.interface.encodeFunctionData('withdrawAllERC20', [
                          token.address,
                          smartVault.address,
                        ])

                        await assertIndirectEvent(tx, smartVault.interface, 'Call', {
                          target: feeClaimer,
                          callData,
                          value: 0,
                          data: '0x',
                        })
                      })

                      it('calls swap primitive', async () => {
                        const tx = await action.call(
                          token.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        await assertIndirectEvent(tx, smartVault.interface, 'Swap', {
                          tokenIn: token,
                          tokenOut: wrappedNativeToken,
                          amountIn,
                          minAmountOut,
                          data,
                        })
                      })

                      it('transfers the token in from the fee claimer to the swap connector', async () => {
                        const previousSmartVaultBalance = await token.balanceOf(smartVault.address)
                        const previousFeeClaimerBalance = await token.balanceOf(feeClaimer.address)
                        const previousDexBalance = await token.balanceOf(await mimic.swapConnector.dex())

                        await action.call(
                          token.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        const currentSmartVaultBalance = await token.balanceOf(smartVault.address)
                        expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.sub(currentBalance))

                        const currentFeeClaimerBalance = await token.balanceOf(feeClaimer.address)
                        expect(currentFeeClaimerBalance).to.be.eq(previousFeeClaimerBalance.sub(amountToClaim))

                        const currentDexBalance = await token.balanceOf(await mimic.swapConnector.dex())
                        expect(currentDexBalance).to.be.eq(previousDexBalance.add(amountIn))
                      })

                      it('transfers the token out from the swap connector to the smart vault', async () => {
                        const previousSmartVaultBalance = await wrappedNativeToken.balanceOf(smartVault.address)
                        const previousFeeClaimerBalance = await wrappedNativeToken.balanceOf(feeClaimer.address)
                        const previousFeeCollectorBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
                        const previousDexBalance = await wrappedNativeToken.balanceOf(await mimic.swapConnector.dex())

                        await action.call(
                          token.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        const currentFeeCollectorBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
                        const gasPaid = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
                        const currentSmartVaultBalance = await wrappedNativeToken.balanceOf(smartVault.address)
                        expect(currentSmartVaultBalance).to.be.eq(
                          previousSmartVaultBalance.add(minAmountOut).sub(gasPaid)
                        )

                        const currentFeeClaimerBalance = await wrappedNativeToken.balanceOf(feeClaimer.address)
                        expect(currentFeeClaimerBalance).to.be.eq(previousFeeClaimerBalance)

                        const currentDexBalance = await wrappedNativeToken.balanceOf(await mimic.swapConnector.dex())
                        expect(currentDexBalance).to.be.eq(previousDexBalance.sub(minAmountOut))
                      })

                      it('emits an Executed event', async () => {
                        const tx = await action.call(
                          token.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        await assertEvent(tx, 'Executed')
                      })

                      it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
                        const previousBalance = await wrappedNativeToken.balanceOf(feeCollector.address)

                        const tx = await action.call(
                          token.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        const currentBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
                        if (refunds) await assertRelayedBaseCost(tx, currentBalance.sub(previousBalance), 0.1)
                        else expect(currentBalance).to.be.equal(previousBalance)
                      })
                    })

                    context('when the fee claim fails', () => {
                      beforeEach('mock fail', async () => {
                        await feeClaimer.mockFail(true)
                      })

                      it('reverts', async () => {
                        await expect(
                          action.call(
                            token.address,
                            amountIn,
                            minAmountOut,
                            expectedAmountOut,
                            deadline,
                            data,
                            signature
                          )
                        ).to.be.revertedWith('FEE_CLAIMER_WITHDRAW_FAILED')
                      })
                    })
                  })

                  context('when the deadline is expired', () => {
                    beforeEach('set past deadline', async () => {
                      deadline = (await currentTimestamp()).sub(MINUTE)
                      signature = await sign(swapSigner, deadline)
                    })

                    it('reverts', async () => {
                      await expect(
                        action.call(token.address, amountIn, minAmountOut, expectedAmountOut, deadline, data, signature)
                      ).to.be.revertedWith('DEADLINE_EXPIRED')
                    })
                  })
                })

                context('when the message is not sign by the swap signer', () => {
                  const deadline = bn(0)

                  beforeEach('set signature', async () => {
                    signature = await sign(swapSigner, deadline)
                  })

                  it('reverts', async () => {
                    await expect(
                      action.call(token.address, amountIn, minAmountOut, expectedAmountOut, deadline, data, signature)
                    ).to.be.revertedWith('INVALID_SWAP_SIGNATURE')
                  })
                })
              })

              context('when the token is marked to not be swapped', () => {
                beforeEach('ignore token swap', async () => {
                  const setIgnoreTokenSwapsRole = action.interface.getSighash('setIgnoreTokenSwaps')
                  await action.connect(owner).authorize(owner.address, setIgnoreTokenSwapsRole)
                  await action.connect(owner).setIgnoreTokenSwaps([token.address], [true])
                })

                if (refunds) {
                  beforeEach('fund smart vault to redeem relayed tx', async () => {
                    await wrappedNativeToken.connect(owner).deposit({ value: fp(1) })
                    await wrappedNativeToken.connect(owner).transfer(smartVault.address, fp(1))
                  })
                }

                context('when the fee claim succeeds', () => {
                  beforeEach('mock succeeds', async () => {
                    await feeClaimer.mockFail(false)
                  })

                  it('calls the call primitive', async () => {
                    const tx = await action.call(token.address, amountIn, minAmountOut, 0, 0, '0x', '0x')

                    const callData = feeClaimer.interface.encodeFunctionData('withdrawAllERC20', [
                      token.address,
                      smartVault.address,
                    ])

                    await assertIndirectEvent(tx, smartVault.interface, 'Call', {
                      target: feeClaimer,
                      callData,
                      value: 0,
                      data: '0x',
                    })
                  })

                  it('does not call swap primitive', async () => {
                    const tx = await action.call(token.address, amountIn, minAmountOut, 0, 0, '0x', '0x')
                    await assertNoIndirectEvent(tx, smartVault.interface, 'Swap')
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(token.address, amountIn, minAmountOut, 0, 0, '0x', '0x')

                    await assertEvent(tx, 'Executed')
                  })

                  it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
                    const previousBalance = await wrappedNativeToken.balanceOf(feeCollector.address)

                    const tx = await action.call(token.address, amountIn, minAmountOut, 0, 0, '0x', '0x')

                    const currentBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
                    if (!refunds) expect(currentBalance).to.be.equal(previousBalance)
                    else {
                      const redeemedCost = currentBalance.sub(previousBalance)
                      const { gasUsed, effectiveGasPrice } = await tx.wait()
                      const redeemedGas = redeemedCost.div(effectiveGasPrice)
                      const missing = gasUsed.sub(redeemedGas)
                      expect(missing).to.be.lt(24e3)
                    }
                  })
                })

                context('when the fee claim fails', () => {
                  beforeEach('mock fail', async () => {
                    await feeClaimer.mockFail(true)
                  })

                  it('reverts', async () => {
                    await expect(
                      action.call(token.address, amountIn, minAmountOut, 0, 0, '0x', '0x')
                    ).to.be.revertedWith('FEE_CLAIMER_WITHDRAW_FAILED')
                  })
                })
              })
            })

            context('when the slippage is not acceptable', () => {
              const maxSlippage = fp(slippage).sub(1)

              beforeEach('set slippage', async () => {
                const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
                await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
                await action.connect(owner).setMaxSlippage(maxSlippage)
              })

              it('reverts', async () => {
                await expect(
                  action.call(token.address, amountIn, minAmountOut, expectedAmountOut, deadline, data, signature)
                ).to.be.revertedWith('CLAIMER_SLIPPAGE_TOO_BIG')
              })
            })
          })

          context('when the amount to claim passes the threshold', () => {
            const thresholdAmount = minAmountOut.mul(thresholdRate).add(1)

            beforeEach('set threshold', async () => {
              await action.connect(owner).setThreshold(thresholdToken.address, thresholdAmount)
            })

            it('reverts', async () => {
              await expect(
                action.call(token.address, amountIn, minAmountOut, expectedAmountOut, deadline, data, signature)
              ).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the token to collect is the wrapped native token', () => {
          it('reverts', async () => {
            await expect(action.call(wrappedNativeToken.address, 0, 0, 0, 0, '0x', '0x')).to.be.revertedWith(
              'ERC20_CLAIMER_INVALID_TOKEN'
            )
          })
        })

        context('when the token to collect is the native token', () => {
          it('reverts', async () => {
            await expect(action.call(NATIVE_TOKEN_ADDRESS, 0, 0, 0, 0, '0x', '0x')).to.be.revertedWith(
              'ERC20_CLAIMER_INVALID_TOKEN'
            )
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
          await action.connect(owner).setLimits(fp(100), 0, wrappedNativeToken.address)
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS, 0, 0, 0, 0, '0x', '0x')).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
