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
import { createClone } from '@mimic-fi/v2-registry'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { ethers } from 'hardhat'

describe('ERC20Claimer', () => {
  let action: Contract, wallet: Contract, registry: Contract, wrappedNativeToken: Contract
  let admin: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress, swapSigner: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, admin, other, feeCollector, swapSigner] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    wrappedNativeToken = await deploy('WrappedNativeTokenMock')
    registry = await deploy('@mimic-fi/v2-registry/artifacts/contracts/registry/Registry.sol/Registry', [admin.address])
    wallet = await createClone(
      registry,
      admin,
      '@mimic-fi/v2-wallet/artifacts/contracts/Wallet.sol/Wallet',
      [wrappedNativeToken.address, registry.address],
      [admin.address]
    )

    action = await deploy('ERC20Claimer', [admin.address, wallet.address])
  })

  describe('setFeeClaimer', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
        await action.connect(admin).authorize(admin.address, setFeeClaimerRole)
        action = action.connect(admin)
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
        await action.connect(admin).authorize(admin.address, setSwapSignerRole)
        action = action.connect(admin)
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
    let swapConnector: Contract, priceOracle: Contract, feeClaimer: Contract, token: Contract

    const swapRate = 2
    const data = '0xaaaabbbb'
    const amountIn = fp(1)
    const minAmountOut = amountIn.mul(swapRate)

    beforeEach('deploy fee claimer', async () => {
      priceOracle = await createClone(registry, admin, 'PriceOracleMock', [])
      const setPriceOracleRole = wallet.interface.getSighash('setPriceOracle')
      await wallet.connect(admin).authorize(admin.address, setPriceOracleRole)
      await wallet.connect(admin).setPriceOracle(priceOracle.address)
    })

    beforeEach('set swap connector', async () => {
      swapConnector = await createClone(registry, admin, 'SwapConnectorMock', [registry.address])
      const setSwapConnectorRole = wallet.interface.getSighash('setSwapConnector')
      await wallet.connect(admin).authorize(admin.address, setSwapConnectorRole)
      await wallet.connect(admin).setSwapConnector(swapConnector.address)
      await swapConnector.mockRate(fp(swapRate))
      await wrappedNativeToken.connect(admin).deposit({ value: minAmountOut })
      await wrappedNativeToken.connect(admin).transfer(swapConnector.address, minAmountOut)
    })

    beforeEach('set fee collector', async () => {
      const setFeeCollectorRole = wallet.interface.getSighash('setFeeCollector')
      await wallet.connect(admin).authorize(admin.address, setFeeCollectorRole)
      await wallet.connect(admin).setFeeCollector(feeCollector.address)
    })

    beforeEach('authorize action', async () => {
      const callRole = wallet.interface.getSighash('call')
      await wallet.connect(admin).authorize(action.address, callRole)

      const swapRole = wallet.interface.getSighash('swap')
      await wallet.connect(admin).authorize(action.address, swapRole)

      const withdrawRole = wallet.interface.getSighash('withdraw')
      await wallet.connect(admin).authorize(action.address, withdrawRole)
    })

    beforeEach('deploy fee claimer', async () => {
      feeClaimer = await deploy('FeeClaimerMock')
      const setFeeClaimerRole = action.interface.getSighash('setFeeClaimer')
      await action.connect(admin).authorize(admin.address, setFeeClaimerRole)
      await action.connect(admin).setFeeClaimer(feeClaimer.address)
    })

    beforeEach('deploy token in', async () => {
      token = await deploy('TokenMock', ['TKN'])
      await token.mint(feeClaimer.address, amountIn)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(admin).authorize(admin.address, callRole)
        action = action.connect(admin)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the token to collect is an ERC20', () => {
          context('when the min amount passes the threshold', () => {
            beforeEach('set threshold', async () => {
              const usdc = await deploy('TokenMock', ['TKN'])
              await priceOracle.mockRate(fp(2))
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(admin).authorize(admin.address, setThresholdRole)
              await action.connect(admin).setThreshold(usdc.address, minAmountOut)
            })

            const sign = async (signer: SignerWithAddress, deadline: BigNumber): Promise<string> => {
              return signer.signMessage(
                ethers.utils.arrayify(
                  ethers.utils.solidityKeccak256(
                    ['address', 'address', 'uint256', 'uint256', 'uint256'],
                    [token.address, wrappedNativeToken.address, amountIn, minAmountOut, deadline]
                  )
                )
              )
            }

            context('when the message is sign by the swap signer', () => {
              beforeEach('set swap signer', async () => {
                const setSwapSignerRole = action.interface.getSighash('setSwapSigner')
                await action.connect(admin).authorize(admin.address, setSwapSignerRole)
                await action.connect(admin).setSwapSigner(swapSigner.address)
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

                  it('calls the collect primitive', async () => {
                    const tx = await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    const calldata = feeClaimer.interface.encodeFunctionData('withdrawSomeERC20', [
                      token.address,
                      amountIn,
                      wallet.address,
                    ])

                    await assertIndirectEvent(tx, wallet.interface, 'Call', {
                      target: feeClaimer,
                      data: calldata,
                      value: 0,
                    })
                  })

                  it('calls swap primitive', async () => {
                    const tx = await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    await assertIndirectEvent(tx, wallet.interface, 'Swap', {
                      tokenIn: token,
                      tokenOut: wrappedNativeToken,
                      amountIn,
                      minAmountOut,
                      data,
                    })
                  })

                  it('transfers the token in from the fee claimer to the swap connector', async () => {
                    const previousWalletBalance = await token.balanceOf(wallet.address)
                    const previousFeeClaimerBalance = await token.balanceOf(feeClaimer.address)
                    const previousSwapConnectorBalance = await token.balanceOf(swapConnector.address)

                    await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    const currentWalletBalance = await token.balanceOf(wallet.address)
                    expect(currentWalletBalance).to.be.eq(previousWalletBalance)

                    const currentFeeClaimerBalance = await token.balanceOf(feeClaimer.address)
                    expect(currentFeeClaimerBalance).to.be.eq(previousFeeClaimerBalance.sub(amountIn))

                    const currentSwapConnectorBalance = await token.balanceOf(swapConnector.address)
                    expect(currentSwapConnectorBalance).to.be.eq(previousSwapConnectorBalance.add(amountIn))
                  })

                  it('transfers the token out from the swap connector to the wallet', async () => {
                    const previousWalletBalance = await wrappedNativeToken.balanceOf(wallet.address)
                    const previousFeeClaimerBalance = await wrappedNativeToken.balanceOf(feeClaimer.address)
                    const previousFeeCollectorBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
                    const previousSwapConnectorBalance = await wrappedNativeToken.balanceOf(swapConnector.address)

                    await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    const currentFeeCollectorBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
                    const gasPaid = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
                    const currentWalletBalance = await wrappedNativeToken.balanceOf(wallet.address)
                    expect(currentWalletBalance).to.be.eq(previousWalletBalance.add(minAmountOut).sub(gasPaid))

                    const currentFeeClaimerBalance = await wrappedNativeToken.balanceOf(feeClaimer.address)
                    expect(currentFeeClaimerBalance).to.be.eq(previousFeeClaimerBalance)

                    const currentSwapConnectorBalance = await wrappedNativeToken.balanceOf(swapConnector.address)
                    expect(currentSwapConnectorBalance).to.be.eq(previousSwapConnectorBalance.sub(minAmountOut))
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    await assertEvent(tx, 'Executed')
                  })

                  it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
                    const previousBalance = await wrappedNativeToken.balanceOf(feeCollector.address)

                    await action.call(token.address, amountIn, minAmountOut, deadline, data, signature)

                    const currentBalance = await wrappedNativeToken.balanceOf(feeCollector.address)
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

          context('when the min amount does not pass the threshold', () => {
            beforeEach('set threshold', async () => {
              const usdc = await deploy('TokenMock', ['TKN'])
              await priceOracle.mockRate(fp(2))
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(admin).authorize(admin.address, setThresholdRole)
              await action.connect(admin).setThreshold(usdc.address, minAmountOut.mul(2).add(1))
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
            await expect(action.call(wrappedNativeToken.address, 0, 0, 0, '0x', '0x')).to.be.revertedWith(
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
          await action.connect(admin).authorize(admin.address, setRelayerRole)
          await action.connect(admin).setRelayer(admin.address, true)

          const setLimitsRole = action.interface.getSighash('setLimits')
          await action.connect(admin).authorize(admin.address, setLimitsRole)
          await action.connect(admin).setLimits(fp(100), 0, wrappedNativeToken.address)
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
