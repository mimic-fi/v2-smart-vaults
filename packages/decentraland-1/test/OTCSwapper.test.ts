import { assertEvent, assertIndirectEvent, fp, getSigners } from '@mimic-fi/v2-helpers'
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

      const itConfigsTokenInCorrectly = (allowed: boolean) => {
        it('sets the token in', async () => {
          await action.setTokenIn(tokenIn.address, allowed)

          expect(await action.isTokenInAllowed(tokenIn.address)).to.be.equal(allowed)
        })

        it('emits an event', async () => {
          const tx = await action.setTokenIn(tokenIn.address, allowed)

          await assertEvent(tx, 'TokenInSet', { tokenIn, allowed })
        })
      }

      context('when allowing the token', () => {
        const allowed = true

        context('when the token was allowed', () => {
          beforeEach('sallow the token', async () => {
            await action.setTokenIn(tokenIn.address, true)
          })

          itConfigsTokenInCorrectly(allowed)
        })

        context('when the token was not allowed', () => {
          beforeEach('disallow the token', async () => {
            await action.setTokenIn(tokenIn.address, false)
          })

          itConfigsTokenInCorrectly(allowed)
        })
      })

      context('when disallowing the token', () => {
        const allowed = false

        context('when the token was allowed', () => {
          beforeEach('sallow the token', async () => {
            await action.setTokenIn(tokenIn.address, true)
          })

          itConfigsTokenInCorrectly(allowed)
        })

        context('when the token was not allowed', () => {
          beforeEach('disallow the token', async () => {
            await action.setTokenIn(tokenIn.address, false)
          })

          itConfigsTokenInCorrectly(allowed)
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenIn(tokenIn.address, true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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

      const itConfigsTokenOutCorrectly = (allowed: boolean) => {
        it('sets the token out', async () => {
          await action.setTokenOut(tokenOut.address, allowed)

          expect(await action.isTokenOutAllowed(tokenOut.address)).to.be.equal(allowed)
        })

        it('emits an event', async () => {
          const tx = await action.setTokenOut(tokenOut.address, allowed)

          await assertEvent(tx, 'TokenOutSet', { tokenOut, allowed })
        })
      }

      context('when allowing the token', () => {
        const allowed = true

        context('when the token was allowed', () => {
          beforeEach('sallow the token', async () => {
            await action.setTokenOut(tokenOut.address, true)
          })

          itConfigsTokenOutCorrectly(allowed)
        })

        context('when the token was not allowed', () => {
          beforeEach('disallow the token', async () => {
            await action.setTokenOut(tokenOut.address, false)
          })

          itConfigsTokenOutCorrectly(allowed)
        })
      })

      context('when disallowing the token', () => {
        const allowed = false

        context('when the token was allowed', () => {
          beforeEach('sallow the token', async () => {
            await action.setTokenOut(tokenOut.address, true)
          })

          itConfigsTokenOutCorrectly(allowed)
        })

        context('when the token was not allowed', () => {
          beforeEach('disallow the token', async () => {
            await action.setTokenOut(tokenOut.address, false)
          })

          itConfigsTokenOutCorrectly(allowed)
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenOut(tokenOut.address, true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
    const threshold = fp(10) // token in
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

    beforeEach('set token in', async () => {
      const setTokenInRole = action.interface.getSighash('setTokenIn')
      await action.connect(owner).authorize(owner.address, setTokenInRole)
      await action.connect(owner).setTokenIn(tokenIn.address, true)
    })

    beforeEach('set token out', async () => {
      const setTokenOutRole = action.interface.getSighash('setTokenOut')
      await action.connect(owner).authorize(owner.address, setTokenOutRole)
      await action.connect(owner).setTokenOut(tokenOut.address, true)
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
      await smartVault.connect(owner).setPriceFeed(tokenIn.address, tokenOut.address, feed.address)
    })

    beforeEach('set threshold', async () => {
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)
      await action.connect(owner).setThreshold(tokenIn.address, threshold)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the requested slippage is acceptable', () => {
          const slippage = maxSlippage

          context('when the amount in passes the threshold', () => {
            const amountIn = threshold
            const amountOut = amountIn.mul(priceRate)
            const maxAmountIn = amountIn.add(amountIn.mul(slippage).div(fp(1)))

            beforeEach('fund smart vault', async () => {
              await tokenIn.mint(smartVault.address, maxAmountIn)
            })

            beforeEach('fund sender and approve smart vault', async () => {
              await tokenOut.mint(owner.address, fp(1000))
              await tokenOut.connect(owner).approve(smartVault.address, fp(1000))
            })

            it('calls collect primitive', async () => {
              const tx = await action.call(tokenIn.address, tokenOut.address, amountOut, slippage)

              await assertIndirectEvent(tx, smartVault.interface, 'Collect', {
                token: tokenOut,
                collected: amountOut,
                from: owner.address,
                data: '0x',
              })
            })

            it('transfers the token in to the sender', async () => {
              const previousSenderBalance = await tokenIn.balanceOf(owner.address)
              const previousSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)

              await action.call(tokenIn.address, tokenOut.address, amountOut, slippage)

              const currentSenderBalance = await tokenIn.balanceOf(owner.address)
              expect(currentSenderBalance).to.be.eq(previousSenderBalance.add(maxAmountIn))

              const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
              expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.sub(maxAmountIn))
            })

            it('transfers the token out to the smart vault', async () => {
              const previousOwnerBalance = await tokenOut.balanceOf(owner.address)
              const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
              const previousFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)

              await action.call(tokenIn.address, tokenOut.address, amountOut, slippage)

              const currentFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)
              const gasPaid = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
              const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
              expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.add(amountOut).sub(gasPaid))

              const currentOwnerBalance = await tokenOut.balanceOf(owner.address)
              expect(currentOwnerBalance).to.be.eq(previousOwnerBalance.sub(amountOut))
            })

            it('emits an Executed event', async () => {
              const tx = await action.call(tokenIn.address, tokenOut.address, amountOut, slippage)

              await assertEvent(tx, 'Executed')
            })

            it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
              const previousBalance = await tokenOut.balanceOf(feeCollector.address)

              const tx = await action.call(tokenIn.address, tokenOut.address, amountOut, slippage)

              const currentBalance = await tokenOut.balanceOf(feeCollector.address)
              if (refunds) await assertRelayedBaseCost(tx, currentBalance.sub(previousBalance), 0.1)
              else expect(currentBalance).to.be.equal(previousBalance)
            })
          })

          context('when the amount in does not passe the threshold', () => {
            const amountIn = threshold.div(2)
            const amountOut = amountIn.mul(priceRate)

            it('reverts', async () => {
              await expect(action.call(tokenIn.address, tokenOut.address, amountOut, slippage)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the slippage is not acceptable', () => {
          const amountOut = fp(1)
          const slippage = maxSlippage.add(1)

          it('reverts', async () => {
            await expect(action.call(tokenIn.address, tokenOut.address, amountOut, slippage)).to.be.revertedWith('SWAPPER_SLIPPAGE_ABOVE_MAX')
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
        await expect(action.call(tokenIn.address, tokenOut.address, 0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
