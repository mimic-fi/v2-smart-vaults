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

describe('Swapper', () => {
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
    action = await createAction('Swapper', mimic, owner, smartVault)
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

      it('sets the token in', async () => {
        await action.setTokenIn(tokenIn.address)

        expect(await action.tokenIn()).to.be.equal(tokenIn.address)
      })

      it('emits an event', async () => {
        const tx = await action.setTokenIn(tokenIn.address)

        await assertEvent(tx, 'TokenInSet', { tokenIn })
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

      it('sets the token out', async () => {
        await action.setTokenOut(tokenOut.address)

        expect(await action.tokenOut()).to.be.equal(tokenOut.address)
      })

      it('emits an event', async () => {
        const tx = await action.setTokenOut(tokenOut.address)

        await assertEvent(tx, 'TokenOutSet', { tokenOut })
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
    const SOURCE = 0
    const DATA = '0xaaaabbbb'

    const threshold = fp(10) // token in
    const priceRate = 2 // 1 token in = 2 token out
    const maxSlippage = fp(0.02)

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

    beforeEach('set token in', async () => {
      const setTokenInRole = action.interface.getSighash('setTokenIn')
      await action.connect(owner).authorize(owner.address, setTokenInRole)
      await action.connect(owner).setTokenIn(tokenIn.address)
    })

    beforeEach('set token out', async () => {
      const setTokenOutRole = action.interface.getSighash('setTokenOut')
      await action.connect(owner).authorize(owner.address, setTokenOutRole)
      await action.connect(owner).setTokenOut(tokenOut.address)
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
        context('when the requested slippage is acceptable', () => {
          const slippage = maxSlippage

          context('when the amount in passes the threshold', () => {
            const amountIn = threshold
            const expectedAmountOut = amountIn.mul(priceRate)
            const minAmountOut = expectedAmountOut.sub(expectedAmountOut.mul(slippage).div(fp(1)))

            beforeEach('fund smart vault', async () => {
              await tokenIn.mint(smartVault.address, amountIn)
            })

            it('calls swap primitive', async () => {
              const tx = await action.call(SOURCE, slippage, DATA)

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

              await action.call(SOURCE, slippage, DATA)

              const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
              expect(currentSmartVaultBalance).to.be.eq(0)

              const currentDexBalance = await tokenIn.balanceOf(await mimic.swapConnector.dex())
              expect(currentDexBalance).to.be.eq(previousDexBalance.add(previousSmartVaultBalance))
            })

            it('transfers the token out to the smart vault', async () => {
              const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
              const previousFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)
              const previousDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())

              await action.call(SOURCE, slippage, DATA)

              const currentFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)
              const gasPaid = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
              const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
              expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.add(expectedAmountOut).sub(gasPaid))

              const currentDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
              expect(currentDexBalance).to.be.eq(previousDexBalance.sub(expectedAmountOut))
            })

            it('emits an Executed event', async () => {
              const tx = await action.call(SOURCE, slippage, DATA)

              await assertEvent(tx, 'Executed')
            })

            it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
              const previousBalance = await tokenOut.balanceOf(feeCollector.address)

              const tx = await action.call(SOURCE, slippage, DATA)

              const currentBalance = await tokenOut.balanceOf(feeCollector.address)
              if (refunds) await assertRelayedBaseCost(tx, currentBalance.sub(previousBalance), 0.1)
              else expect(currentBalance).to.be.equal(previousBalance)
            })
          })

          context('when the token in balance does not pass the threshold', () => {
            beforeEach('fund smart vault', async () => {
              await tokenIn.mint(smartVault.address, threshold.sub(1))
            })

            it('reverts', async () => {
              await expect(action.call(SOURCE, 0, DATA)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the slippage is not acceptable', () => {
          const slippage = maxSlippage.add(1)

          it('reverts', async () => {
            await expect(action.call(SOURCE, slippage, DATA)).to.be.revertedWith('SWAPPER_SLIPPAGE_ABOVE_MAX')
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
        await expect(action.call(SOURCE, 0, DATA)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
