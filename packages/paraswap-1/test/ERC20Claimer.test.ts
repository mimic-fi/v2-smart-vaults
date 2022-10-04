import {
  assertEvent,
  assertIndirectEvent,
  bn,
  currentTimestamp,
  deploy,
  fp,
  getSigners,
  MINUTE,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { createAction, createTokenMock, createWallet, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { ethers } from 'hardhat'

describe('ERC20Claimer', () => {
  let action: Contract, wallet: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress, swapSigner: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector, swapSigner] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    wallet = await createWallet(mimic, owner)
    action = await createAction('ERC20Claimer', mimic, owner, wallet)
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

  describe('call', () => {
    let deadline: BigNumber, signature: string
    let feeClaimer: Contract, token: Contract, thresholdToken: Contract

    const swapRate = 2
    const data = '0xaaaabbbb'
    const amountIn = fp(1)
    const minAmountOut = amountIn.mul(swapRate)
    const thresholdRate = 2

    beforeEach('authorize action', async () => {
      const callRole = wallet.interface.getSighash('call')
      await wallet.connect(owner).authorize(action.address, callRole)
      const swapRole = wallet.interface.getSighash('swap')
      await wallet.connect(owner).authorize(action.address, swapRole)
      const withdrawRole = wallet.interface.getSighash('withdraw')
      await wallet.connect(owner).authorize(action.address, withdrawRole)
    })

    beforeEach('set fee collector', async () => {
      const setFeeCollectorRole = wallet.interface.getSighash('setFeeCollector')
      await wallet.connect(owner).authorize(owner.address, setFeeCollectorRole)
      await wallet.connect(owner).setFeeCollector(feeCollector.address)
    })

    beforeEach('deploy fee claimer', async () => {
      feeClaimer = await deploy('FeeClaimerMock')
      const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
      await action.connect(owner).authorize(owner.address, setFeeClaimerRole)
      await action.connect(owner).setFeeClaimer(feeClaimer.address)
    })

    beforeEach('fund swap connector', async () => {
      await mimic.swapConnector.mockRate(fp(swapRate))
      await mimic.wrappedNativeToken.connect(owner).deposit({ value: minAmountOut })
      await mimic.wrappedNativeToken.connect(owner).transfer(await mimic.swapConnector.dex(), minAmountOut)
    })

    beforeEach('deploy threshold token', async () => {
      thresholdToken = await createTokenMock()
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)
      await mimic.priceOracle.mockRate(mimic.wrappedNativeToken.address, thresholdToken.address, fp(thresholdRate))
    })

    beforeEach('fund fee claimer', async () => {
      token = await createTokenMock()
      await token.mint(feeClaimer.address, amountIn)
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

            const sign = async (signer: SignerWithAddress, deadline: BigNumber): Promise<string> => {
              return signer.signMessage(
                ethers.utils.arrayify(
                  ethers.utils.solidityKeccak256(
                    ['address', 'address', 'uint256', 'uint256', 'uint256'],
                    [token.address, mimic.wrappedNativeToken.address, amountIn, minAmountOut, deadline]
                  )
                )
              )
            }

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
                    const tx = await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    const callData = feeClaimer.interface.encodeFunctionData('withdrawSomeERC20', [
                      token.address,
                      amountIn,
                      wallet.address,
                    ])

                    await assertIndirectEvent(tx, wallet.interface, 'Call', {
                      target: feeClaimer,
                      callData,
                      value: 0,
                      data: '0x',
                    })
                  })

                  it('calls swap primitive', async () => {
                    const tx = await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    await assertIndirectEvent(tx, wallet.interface, 'Swap', {
                      tokenIn: token,
                      tokenOut: mimic.wrappedNativeToken,
                      amountIn,
                      minAmountOut,
                      data,
                    })
                  })

                  it('transfers the token in from the fee claimer to the swap connector', async () => {
                    const previousWalletBalance = await token.balanceOf(wallet.address)
                    const previousFeeClaimerBalance = await token.balanceOf(feeClaimer.address)
                    const previousDexBalance = await token.balanceOf(await mimic.swapConnector.dex())

                    await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    const currentWalletBalance = await token.balanceOf(wallet.address)
                    expect(currentWalletBalance).to.be.eq(previousWalletBalance)

                    const currentFeeClaimerBalance = await token.balanceOf(feeClaimer.address)
                    expect(currentFeeClaimerBalance).to.be.eq(previousFeeClaimerBalance.sub(amountIn))

                    const currentDexBalance = await token.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.add(amountIn))
                  })

                  it('transfers the token out from the swap connector to the wallet', async () => {
                    const previousWalletBalance = await mimic.wrappedNativeToken.balanceOf(wallet.address)
                    const previousFeeClaimerBalance = await mimic.wrappedNativeToken.balanceOf(feeClaimer.address)
                    const previousFeeCollectorBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                    const previousDexBalance = await mimic.wrappedNativeToken.balanceOf(await mimic.swapConnector.dex())

                    await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    const currentFeeCollectorBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                    const gasPaid = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
                    const currentWalletBalance = await mimic.wrappedNativeToken.balanceOf(wallet.address)
                    expect(currentWalletBalance).to.be.eq(previousWalletBalance.add(minAmountOut).sub(gasPaid))

                    const currentFeeClaimerBalance = await mimic.wrappedNativeToken.balanceOf(feeClaimer.address)
                    expect(currentFeeClaimerBalance).to.be.eq(previousFeeClaimerBalance)

                    const currentDexBalance = await mimic.wrappedNativeToken.balanceOf(await mimic.swapConnector.dex())
                    expect(currentDexBalance).to.be.eq(previousDexBalance.sub(minAmountOut))
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    await assertEvent(tx, 'Executed')
                  })

                  it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
                    const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                    await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                    expect(currentBalance).to.be[refunds ? 'gt' : 'eq'](previousBalance)
                  })
                })

                context('when the fee claim fails', () => {
                  beforeEach('mock fail', async () => {
                    await feeClaimer.mockFail(true)
                  })

                  it('reverts', async () => {
                    await expect(
                      action.call(token.address, amountIn, minAmountOut, deadline, data, signature)
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
                    action.call(token.address, amountIn, minAmountOut, deadline, data, signature)
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
                  action.call(token.address, amountIn, minAmountOut, deadline, data, signature)
                ).to.be.revertedWith('INVALID_SWAP_SIGNATURE')
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
                action.call(token.address, amountIn, minAmountOut, deadline, data, signature)
              ).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the token to collect is the wrapped native token', () => {
          it('reverts', async () => {
            await expect(action.call(mimic.wrappedNativeToken.address, 0, 0, 0, '0x', '0x')).to.be.revertedWith(
              'ERC20_CLAIMER_INVALID_TOKEN'
            )
          })
        })

        context('when the token to collect is the native token', () => {
          it('reverts', async () => {
            await expect(action.call(NATIVE_TOKEN_ADDRESS, 0, 0, 0, '0x', '0x')).to.be.revertedWith(
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
          await action.connect(owner).setLimits(fp(100), 0, mimic.wrappedNativeToken.address)
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS, 0, 0, 0, '0x', '0x')).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
