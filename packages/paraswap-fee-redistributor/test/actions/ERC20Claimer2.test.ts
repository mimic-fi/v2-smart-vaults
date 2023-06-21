import {
  assertEvent,
  assertIndirectEvent,
  assertNoIndirectEvent,
  BigNumberish,
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

describe('ERC20Claimer2', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic, tokenOut: Contract
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress, swapSigner: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector, swapSigner] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    tokenOut = await createTokenMock()
    action = await deploy('ERC20Claimer2', [
      {
        admin: owner.address,
        registry: mimic.registry.address,
        smartVault: smartVault.address,
        feeClaimer: other.address,
        tokenOut: tokenOut.address,
        swapSigner: swapSigner.address,
        maxSlippage: fp(0.01),
        ignoreTokens: [tokenOut.address],
        thresholdToken: mimic.wrappedNativeToken.address,
        thresholdAmount: fp(1000),
        relayer: owner.address,
        gasPriceLimit: 100e9,
      },
    ])
  })

  describe('initialization', () => {
    it('initializes the action as expected', async () => {
      const authorizeRole = action.interface.getSighash('authorize')
      expect(await action.isAuthorized(owner.address, authorizeRole)).to.be.true

      const unauthorizeRole = action.interface.getSighash('unauthorize')
      expect(await action.isAuthorized(owner.address, unauthorizeRole)).to.be.true

      expect(await action.smartVault()).to.be.equal(smartVault.address)
      expect(await action.feeClaimer()).to.be.equal(other.address)
      expect(await action.tokenOut()).to.be.equal(tokenOut.address)
      expect(await action.swapSigner()).to.be.equal(swapSigner.address)
      expect(await action.maxSlippage()).to.be.equal(fp(0.01))

      expect(await action.isRelayer(owner.address)).to.be.true
      expect(await action.gasPriceLimit()).to.be.eq(100e9)
      expect(await action.txCostLimit()).to.be.eq(0)

      expect(await action.thresholdToken()).to.be.eq(mimic.wrappedNativeToken.address)
      expect(await action.thresholdAmount()).to.be.eq(fp(1000))

      expect(await action.isTokenSwapIgnored(tokenOut.address)).to.be.true
      expect(await action.isTokenSwapIgnored(mimic.wrappedNativeToken.address)).to.be.false
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
        await action.setTokenOut(other.address)

        expect(await action.tokenOut()).to.be.equal(other.address)
      })

      it('emits an event', async () => {
        const tx = await action.setTokenOut(other.address)

        await assertEvent(tx, 'TokenOutSet', { tokenOut: other })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenOut(other.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setFeeClaimer', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
        await action.connect(owner).authorize(owner.address, setFeeClaimerRole)
        action = action.connect(owner)
      })

      it('sets the fee claimer', async () => {
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
        expect(await action.getIgnoredTokenSwaps()).to.have.lengthOf(2)

        await action.setIgnoreTokenSwaps([token2.address], [true])

        const tokens = await action.getIgnoredTokenSwaps()
        expect(tokens).to.have.lengthOf(3)
        expect(tokens[0]).to.be.equal(tokenOut.address)
        expect(tokens[1]).to.be.equal(token1.address)
        expect(tokens[2]).to.be.equal(token2.address)
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
    let feeClaimer: Contract

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

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (relayed: boolean) => {
        const data = '0xaabb'

        context('when the token to collect is an ERC20', () => {
          let token: Contract

          beforeEach('set token', async () => {
            token = await createTokenMock()
          })

          const sign = async (
            signer: SignerWithAddress,
            amountIn: BigNumberish,
            minAmountOut: BigNumberish,
            expectedAmountOut: BigNumberish,
            deadline: BigNumberish,
            data: string
          ): Promise<string> => {
            return signer.signMessage(
              ethers.utils.arrayify(
                ethers.utils.solidityKeccak256(
                  ['address', 'address', 'bool', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
                  [token.address, tokenOut.address, false, amountIn, minAmountOut, expectedAmountOut, deadline, data]
                )
              )
            )
          }

          context('when the swap signer is valid', () => {
            context('when the deadline is in the feature', () => {
              let deadline: BigNumber

              beforeEach('set deadline', async () => {
                deadline = (await currentTimestamp()).add(MINUTE)
              })

              context('when the token swap is ignored', () => {
                const minAmountOut = 0 // slippage is completely ignored here

                beforeEach('ignore token swap', async () => {
                  const setIgnoreTokenSwapsRole = action.interface.getSighash('setIgnoreTokenSwaps')
                  await action.connect(owner).authorize(owner.address, setIgnoreTokenSwapsRole)
                  await action.connect(owner).setIgnoreTokenSwaps([token.address], [true])
                })

                context('when there is a threshold set', () => {
                  const tokenRate = 2 // 1 token = 2 token out
                  const thresholdAmount = fp(0.1) // in token out
                  const thresholdAmountInToken = thresholdAmount.div(tokenRate) // threshold expressed in token

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(tokenOut.address, thresholdAmount)

                    const feed = await createPriceFeedMock(fp(tokenRate))
                    const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                    await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                    await smartVault.connect(owner).setPriceFeed(token.address, tokenOut.address, feed.address)
                  })

                  context('when the claimable balance passes the threshold', () => {
                    const feeClaimerBalance = thresholdAmountInToken

                    beforeEach('fund fee claimer', async () => {
                      await token.mint(feeClaimer.address, feeClaimerBalance)
                    })

                    const itClaimsSuccessfully = (smartVaultBalance: BigNumber) => {
                      let signature: string

                      const amountIn = feeClaimerBalance.add(smartVaultBalance)
                      const expectedAmountOut = amountIn.mul(tokenRate)

                      beforeEach('fund smart vault', async () => {
                        await token.mint(smartVault.address, smartVaultBalance)
                      })

                      beforeEach('sign data', async () => {
                        signature = await sign(swapSigner, amountIn, minAmountOut, expectedAmountOut, deadline, data)
                      })

                      it('can execute', async () => {
                        const canExecute = await action.canExecute(token.address)
                        expect(canExecute).to.be.true
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

                      it('does not call swap primitive', async () => {
                        const tx = await action.call(
                          token.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        await assertNoIndirectEvent(tx, smartVault.interface, 'Swap')
                      })

                      it('transfers the token in from the fee claimer to the smart vault', async () => {
                        const previousSmartVaultBalance = await token.balanceOf(smartVault.address)
                        const previousFeeClaimerBalance = await token.balanceOf(feeClaimer.address)
                        const previousFeeCollectorBalance = await token.balanceOf(feeCollector.address)

                        await action.call(
                          token.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        const currentFeeCollectorBalance = await token.balanceOf(feeCollector.address)
                        const refund = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

                        const currentSmartVaultBalance = await token.balanceOf(smartVault.address)
                        const expectedSmartVaultBalance = previousSmartVaultBalance.add(feeClaimerBalance).sub(refund)
                        expect(currentSmartVaultBalance).to.be.eq(expectedSmartVaultBalance)

                        const currentFeeClaimerBalance = await token.balanceOf(feeClaimer.address)
                        expect(currentFeeClaimerBalance).to.be.eq(previousFeeClaimerBalance.sub(feeClaimerBalance))
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

                      if (relayed) {
                        it('refunds gas', async () => {
                          const previousBalance = await tokenOut.balanceOf(feeCollector.address)

                          const tx = await action.call(
                            token.address,
                            amountIn,
                            minAmountOut,
                            expectedAmountOut,
                            deadline,
                            data,
                            signature
                          )

                          const currentBalance = await tokenOut.balanceOf(feeCollector.address)
                          expect(currentBalance).to.be.gt(previousBalance)

                          const redeemedCost = currentBalance.sub(previousBalance)
                          await assertRelayedBaseCost(tx, redeemedCost, 0.05)
                        })
                      } else {
                        it('does not refund gas', async () => {
                          const previousBalance = await tokenOut.balanceOf(feeCollector.address)

                          await action.call(
                            token.address,
                            amountIn,
                            minAmountOut,
                            expectedAmountOut,
                            deadline,
                            data,
                            signature
                          )

                          const currentBalance = await tokenOut.balanceOf(feeCollector.address)
                          expect(currentBalance).to.be.equal(previousBalance)
                        })
                      }
                    }

                    context('when the smart vault balance is zero', () => {
                      const smartVaultBalance = fp(0)

                      itClaimsSuccessfully(smartVaultBalance)
                    })

                    context('when the smart vault balance is not zero', () => {
                      const smartVaultBalance = fp(0.01)

                      itClaimsSuccessfully(smartVaultBalance)
                    })
                  })

                  context('when the claimable balance does not pass the threshold', () => {
                    const feeClaimerBalance = thresholdAmountInToken.div(2)

                    beforeEach('fund fee claimer', async () => {
                      await token.mint(feeClaimer.address, feeClaimerBalance)
                    })

                    context('when the smart vault balance passes the threshold', () => {
                      const smartVaultBalance = thresholdAmountInToken
                      const amountIn = feeClaimerBalance.add(smartVaultBalance)
                      const expectedAmountOut = amountIn.mul(tokenRate)

                      it('reverts', async () => {
                        const signature = await sign(
                          swapSigner,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data
                        )

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
                        ).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                      })
                    })

                    context('when the smart vault balance does not pass the threshold', () => {
                      const smartVaultBalance = thresholdAmountInToken.div(2)
                      const amountIn = feeClaimerBalance.add(smartVaultBalance)
                      const expectedAmountOut = amountIn.mul(tokenRate)

                      beforeEach('fund smart vault', async () => {
                        await token.mint(smartVault.address, smartVaultBalance)
                      })

                      it('reverts', async () => {
                        const signature = await sign(
                          swapSigner,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data
                        )

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
                        ).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                      })
                    })
                  })
                })

                context('when there is no threshold set', () => {
                  it('reverts', async () => {
                    const signature = await sign(swapSigner, 0, 0, 0, deadline, data)
                    await expect(action.call(token.address, 0, 0, 0, deadline, data, signature)).to.be.reverted
                  })
                })
              })

              context('when the token swap is not ignored', () => {
                context('when there is a threshold set', () => {
                  const tokenRate = 2 // 1 token = 2 wrapped native tokens
                  const thresholdAmount = fp(0.1) // in wrapped native tokens
                  const thresholdAmountInToken = thresholdAmount.div(tokenRate) // threshold expressed in token

                  beforeEach('set threshold', async () => {
                    const feed = await createPriceFeedMock(fp(tokenRate))
                    const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                    await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                    await smartVault.connect(owner).setPriceFeed(token.address, tokenOut.address, feed.address)

                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(tokenOut.address, thresholdAmount)
                  })

                  const itClaimsAndSwapsSuccessfully = (feeClaimerBalance: BigNumber, smartVaultBalance: BigNumber) => {
                    let signature: string

                    const slippage = 0.01
                    const amountIn = feeClaimerBalance.add(smartVaultBalance)
                    const minAmountOut = amountIn.mul(tokenRate)
                    const expectedAmountOut = minAmountOut.add(pct(minAmountOut, slippage))

                    beforeEach('fund smart vault', async () => {
                      await token.mint(smartVault.address, smartVaultBalance)
                    })

                    beforeEach('sign data', async () => {
                      signature = await sign(swapSigner, amountIn, minAmountOut, expectedAmountOut, deadline, data)
                    })

                    context('when the slippage is below the limit', () => {
                      beforeEach('set max slippage', async () => {
                        const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
                        await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
                        await action.connect(owner).setMaxSlippage(fp(slippage))
                      })

                      beforeEach('fund swap connector', async () => {
                        await mimic.swapConnector.mockRate(fp(tokenRate))
                        await tokenOut.mint(await mimic.swapConnector.dex(), minAmountOut)
                      })

                      it('can execute', async () => {
                        const canExecute = await action.canExecute(token.address)
                        expect(canExecute).to.be.true
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
                          tokenOut,
                          amountIn,
                          minAmountOut,
                          data,
                        })
                      })

                      it('transfers the amount in to the swap connector', async () => {
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
                        expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.sub(smartVaultBalance))

                        const currentFeeClaimerBalance = await token.balanceOf(feeClaimer.address)
                        expect(currentFeeClaimerBalance).to.be.eq(previousFeeClaimerBalance.sub(feeClaimerBalance))

                        const currentDexBalance = await token.balanceOf(await mimic.swapConnector.dex())
                        expect(currentDexBalance).to.be.eq(previousDexBalance.add(amountIn))
                      })

                      it('transfers the token out from the swap connector to the smart vault', async () => {
                        const previousSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                        const previousFeeClaimerBalance = await tokenOut.balanceOf(feeClaimer.address)
                        const previousFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)
                        const previousDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())

                        await action.call(
                          token.address,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data,
                          signature
                        )

                        const currentFeeCollectorBalance = await tokenOut.balanceOf(feeCollector.address)
                        const refund = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

                        const currentSmartVaultBalance = await tokenOut.balanceOf(smartVault.address)
                        const expectedSmartVaultBalance = previousSmartVaultBalance.add(minAmountOut).sub(refund)
                        expect(currentSmartVaultBalance).to.be.eq(expectedSmartVaultBalance)

                        const currentFeeClaimerBalance = await tokenOut.balanceOf(feeClaimer.address)
                        expect(currentFeeClaimerBalance).to.be.eq(previousFeeClaimerBalance)

                        const currentDexBalance = await tokenOut.balanceOf(await mimic.swapConnector.dex())
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

                      if (relayed) {
                        it('refunds gas', async () => {
                          const previousBalance = await tokenOut.balanceOf(feeCollector.address)

                          const tx = await action.call(
                            token.address,
                            amountIn,
                            minAmountOut,
                            expectedAmountOut,
                            deadline,
                            data,
                            signature
                          )

                          const currentBalance = await tokenOut.balanceOf(feeCollector.address)
                          expect(currentBalance).to.be.gt(previousBalance)

                          const redeemedCost = currentBalance.sub(previousBalance)
                          await assertRelayedBaseCost(tx, redeemedCost, 0.18)
                        })
                      } else {
                        it('does not refund gas', async () => {
                          const previousBalance = await tokenOut.balanceOf(feeCollector.address)

                          await action.call(
                            token.address,
                            amountIn,
                            minAmountOut,
                            expectedAmountOut,
                            deadline,
                            data,
                            signature
                          )

                          const currentBalance = await tokenOut.balanceOf(feeCollector.address)
                          expect(currentBalance).to.be.equal(previousBalance)
                        })
                      }
                    })

                    context('when the slippage is above the limit', () => {
                      beforeEach('set max slippage', async () => {
                        const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
                        await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
                        await action.connect(owner).setMaxSlippage(fp(slippage - 0.0001))
                      })

                      it('reverts', async () => {
                        const signature = await sign(
                          swapSigner,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data
                        )

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
                        ).to.be.revertedWith('CLAIMER_SLIPPAGE_TOO_BIG')
                      })
                    })
                  }

                  context('when the claimable balance passes the threshold', () => {
                    const feeClaimerBalance = thresholdAmountInToken

                    beforeEach('fund fee claimer', async () => {
                      await token.mint(feeClaimer.address, feeClaimerBalance)
                    })

                    context('when the smart vault balance is zero', () => {
                      const smartVaultBalance = fp(0)

                      itClaimsAndSwapsSuccessfully(feeClaimerBalance, smartVaultBalance)
                    })

                    context('when the smart vault balance is not zero', () => {
                      const smartVaultBalance = fp(0.01)

                      itClaimsAndSwapsSuccessfully(feeClaimerBalance, smartVaultBalance)
                    })
                  })

                  context('when the claimable balance does not pass the threshold', () => {
                    const feeClaimerBalance = thresholdAmountInToken.div(2)

                    beforeEach('fund fee claimer', async () => {
                      await token.mint(feeClaimer.address, feeClaimerBalance)
                    })

                    context('when the smart vault plus claimable balance passes the threshold', () => {
                      const smartVaultBalance = thresholdAmountInToken.sub(feeClaimerBalance)

                      beforeEach('fund smart vault', async () => {
                        await token.mint(smartVault.address, smartVaultBalance)
                      })

                      itClaimsAndSwapsSuccessfully(feeClaimerBalance, smartVaultBalance)
                    })

                    context('when the smart vault plus claimable balance does not pass the threshold', () => {
                      const smartVaultBalance = thresholdAmountInToken.sub(feeClaimerBalance).div(2)
                      const amountIn = feeClaimerBalance.add(smartVaultBalance)
                      const expectedAmountOut = amountIn.mul(tokenRate)
                      const minAmountOut = 0 // slippage is not even checked when the threshold does not pass

                      beforeEach('fund smart vault', async () => {
                        await token.mint(smartVault.address, smartVaultBalance)
                      })

                      it('reverts', async () => {
                        const signature = await sign(
                          swapSigner,
                          amountIn,
                          minAmountOut,
                          expectedAmountOut,
                          deadline,
                          data
                        )

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
                        ).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                      })
                    })
                  })
                })

                context('when there is no threshold set', () => {
                  it('reverts', async () => {
                    const signature = await sign(swapSigner, 0, 0, 0, deadline, data)
                    await expect(action.call(token.address, 0, 0, 0, deadline, data, signature)).to.be.reverted
                  })
                })
              })
            })

            context('when the deadline is in the past', () => {
              let deadline: BigNumber

              beforeEach('set deadline', async () => {
                deadline = await currentTimestamp()
              })

              it('reverts', async () => {
                const signature = await sign(swapSigner, 0, 0, 0, deadline, data)
                await expect(action.call(token.address, 0, 0, 0, deadline, data, signature)).to.be.revertedWith(
                  'SWAP_DEADLINE_EXPIRED'
                )
              })
            })
          })

          context('when the swap signer is not valid', () => {
            beforeEach('set another swap signer', async () => {
              const setSwapSignerRole = action.interface.getSighash('setSwapSigner')
              await action.connect(owner).authorize(owner.address, setSwapSignerRole)
              await action.connect(owner).setSwapSigner(other.address)
            })

            it('reverts', async () => {
              const signature = await sign(swapSigner, 0, 0, 0, 0, data)
              await expect(action.call(token.address, 0, 0, 0, 0, data, signature)).to.be.revertedWith(
                'INVALID_SWAP_SIGNATURE'
              )
            })
          })
        })

        context('when the token to collect is the native token', () => {
          const token = NATIVE_TOKEN_ADDRESS

          it('reverts', async () => {
            await expect(action.call(token, 0, 0, 0, 0, data, '0x')).to.be.revertedWith('ERC20_CLAIMER_INVALID_TOKEN')
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(owner).authorize(owner.address, setRelayerRole)
          await action.connect(owner).setRelayer(owner.address, true)
        })

        beforeEach('set token out price feed', async () => {
          const feed = await createPriceFeedMock(fp(1))
          const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
          await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
          await smartVault.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, tokenOut.address, feed.address)
        })

        beforeEach('fund smart vault with token out to pay gas', async () => {
          await tokenOut.mint(smartVault.address, fp(1000))
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
