import {
  assertEvent,
  assertIndirectEvent,
  assertNoIndirectEvent,
  deploy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  createAction,
  createSmartVault,
  createTokenMock,
  Mimic,
  MOCKS,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'

describe('L2HopBridger', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('L2HopBridger', mimic, owner, smartVault)
  })

  describe('setTokenAmm', () => {
    let token: Contract, hopL2Amm: Contract

    beforeEach('deploy token and amm mock', async () => {
      token = await createTokenMock()
      hopL2Amm = await deploy(MOCKS.HOP_L2_AMM, [token.address, token.address])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenAmmRole = action.interface.getSighash('setTokenAmm')
        await action.connect(owner).authorize(owner.address, setTokenAmmRole)
        action = action.connect(owner)
      })

      context('when the token address is not zero', () => {
        context('when setting the token amm', () => {
          const itSetsTheTokenAmm = () => {
            it('sets the token amm', async () => {
              await action.setTokenAmm(token.address, hopL2Amm.address)

              expect(await action.getTokenAmm(token.address)).to.be.equal(hopL2Amm.address)
            })

            it('emits an event', async () => {
              const tx = await action.setTokenAmm(token.address, hopL2Amm.address)

              await assertEvent(tx, 'TokenAmmSet', { token, amm: hopL2Amm.address })
            })
          }

          context('when the token amm was set', () => {
            beforeEach('set token amm', async () => {
              await action.setTokenAmm(token.address, hopL2Amm.address)
            })

            itSetsTheTokenAmm()
          })

          context('when the token amm was not set', () => {
            beforeEach('unset token amm', async () => {
              await action.setTokenAmm(token.address, ZERO_ADDRESS)
            })

            itSetsTheTokenAmm()
          })
        })

        context('when unsetting the token amm', () => {
          const itUnsetsTheTokenAmm = () => {
            it('unsets the token amm', async () => {
              await action.setTokenAmm(token.address, ZERO_ADDRESS)

              expect(await action.getTokenAmm(token.address)).to.be.equal(ZERO_ADDRESS)
            })

            it('emits an event', async () => {
              const tx = await action.setTokenAmm(token.address, ZERO_ADDRESS)

              await assertEvent(tx, 'TokenAmmSet', { token, amm: ZERO_ADDRESS })
            })
          }

          context('when the token amm was set', () => {
            beforeEach('set token amm', async () => {
              await action.setTokenAmm(token.address, hopL2Amm.address)
            })

            itUnsetsTheTokenAmm()
          })

          context('when the token was not set', () => {
            beforeEach('unset token amm', async () => {
              await action.setTokenAmm(token.address, ZERO_ADDRESS)
            })

            itUnsetsTheTokenAmm()
          })
        })
      })

      context('when the token address is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setTokenAmm(token, hopL2Amm.address)).to.be.revertedWith('BRIDGER_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenAmm(token.address, hopL2Amm.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setDestinationChainId', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setDestinationChainRole = action.interface.getSighash('setDestinationChainId')
        await action.connect(owner).authorize(owner.address, setDestinationChainRole)
        action = action.connect(owner)
      })

      context('when setting the chain ID', () => {
        const itSetsTheChainCorrectly = () => {
          context('when the chain ID is not the current one', () => {
            const chainId = 1

            it('sets the chain ID', async () => {
              await action.setDestinationChainId(chainId)

              expect(await action.destinationChainId()).to.be.equal(chainId)
            })

            it('emits an event', async () => {
              const tx = await action.setDestinationChainId(chainId)

              await assertEvent(tx, 'DestinationChainIdSet', { chainId })
            })
          })

          context('when the chain ID is the current one', () => {
            const chainId = 31337 // Hardhat chain ID

            it('reverts', async () => {
              await expect(action.setDestinationChainId(chainId)).to.be.revertedWith('BRIDGER_SAME_CHAIN_ID')
            })
          })
        }

        context('when the chain ID was set', () => {
          beforeEach('set chain ID', async () => {
            await action.setDestinationChainId(1)
          })

          itSetsTheChainCorrectly()
        })

        context('when the chain ID was not set', () => {
          beforeEach('unset chain ID', async () => {
            await action.setDestinationChainId(0)
          })

          itSetsTheChainCorrectly()
        })
      })

      context('when unsetting the chain ID', () => {
        const itUnsetsTheChainCorrectly = () => {
          it('unsets the chain ID', async () => {
            await action.setDestinationChainId(0)

            expect(await action.destinationChainId()).to.be.equal(0)
          })

          it('emits an event', async () => {
            const tx = await action.setDestinationChainId(0)

            await assertEvent(tx, 'DestinationChainIdSet', { chainId: 0 })
          })
        }

        context('when the chain ID was set', () => {
          beforeEach('set chain ID', async () => {
            await action.setDestinationChainId(1)
          })

          itUnsetsTheChainCorrectly()
        })

        context('when the chain ID was not set', () => {
          beforeEach('unset chain ID', async () => {
            await action.setDestinationChainId(0)
          })

          itUnsetsTheChainCorrectly()
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setDestinationChainId(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
          await expect(action.setMaxSlippage(slippage)).to.be.revertedWith('BRIDGER_SLIPPAGE_ABOVE_ONE')
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

  describe('setMaxBonderFeePct', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setMaxBonderFeePctRole = action.interface.getSighash('setMaxBonderFeePct')
        await action.connect(owner).authorize(owner.address, setMaxBonderFeePctRole)
        action = action.connect(owner)
      })

      context('when the pct is not above one', () => {
        const pct = fp(0.1)

        it('sets the bonder fee pct', async () => {
          await action.setMaxBonderFeePct(pct)

          expect(await action.maxBonderFeePct()).to.be.equal(pct)
        })

        it('emits an event', async () => {
          const tx = await action.setMaxBonderFeePct(pct)

          await assertEvent(tx, 'MaxBonderFeePctSet', { maxBonderFeePct: pct })
        })
      })

      context('when the pct is above one', () => {
        const pct = fp(1).add(1)

        it('reverts', async () => {
          await expect(action.setMaxBonderFeePct(pct)).to.be.revertedWith('BRIDGER_BONDER_FEE_PCT_ABOVE_ONE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setMaxBonderFeePct(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setMaxDeadline', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setMaxDeadlineRole = action.interface.getSighash('setMaxDeadline')
        await action.connect(owner).authorize(owner.address, setMaxDeadlineRole)
        action = action.connect(owner)
      })

      context('when the deadline is not zero', () => {
        const deadline = 60 * 60

        it('sets the slippage', async () => {
          await action.setMaxDeadline(deadline)

          expect(await action.maxDeadline()).to.be.equal(deadline)
        })

        it('emits an event', async () => {
          const tx = await action.setMaxDeadline(deadline)

          await assertEvent(tx, 'MaxDeadlineSet', { maxDeadline: deadline })
        })
      })

      context('when the deadline is zero', () => {
        const deadline = 0

        it('reverts', async () => {
          await expect(action.setMaxDeadline(deadline)).to.be.revertedWith('BRIDGER_MAX_DEADLINE_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setMaxDeadline(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    const SOURCE = 0

    beforeEach('authorize action', async () => {
      const wrapRole = smartVault.interface.getSighash('wrap')
      await smartVault.connect(owner).authorize(action.address, wrapRole)
      const bridgeRole = smartVault.interface.getSighash('bridge')
      await smartVault.connect(owner).authorize(action.address, bridgeRole)
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

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the given token is the native token', () => {
          const token = NATIVE_TOKEN_ADDRESS
          let hopL2Amm: Contract

          beforeEach('deploy token and amm mock', async () => {
            hopL2Amm = await deploy(MOCKS.HOP_L2_AMM, [token, token])
          })

          context('when the given token has an AMM set', () => {
            beforeEach('set token AMM', async () => {
              const setTokenAmmRole = action.interface.getSighash('setTokenAmm')
              await action.connect(owner).authorize(owner.address, setTokenAmmRole)
              await action.connect(owner).setTokenAmm(token, hopL2Amm.address)
            })

            context('when the amount is greater than zero', () => {
              const amount = fp(0.05)

              beforeEach('fund action', async () => {
                await owner.sendTransaction({ to: action.address, value: amount })
              })

              context('when the destination chain ID was set', () => {
                const chainId = 1

                beforeEach('set destination chain ID', async () => {
                  const setDestinationChainIdRole = action.interface.getSighash('setDestinationChainId')
                  await action.connect(owner).authorize(owner.address, setDestinationChainIdRole)
                  await action.connect(owner).setDestinationChainId(chainId)
                })

                context('when the slippage is below the limit', () => {
                  const slippage = fp(0.01)

                  beforeEach('set max slippage', async () => {
                    const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
                    await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
                    await action.connect(owner).setMaxSlippage(slippage)
                  })

                  context('when the bonder fee is below the limit', () => {
                    const bonderFeePct = fp(0.002)

                    beforeEach('set max bonder fee', async () => {
                      const setMaxBonderFeePctRole = action.interface.getSighash('setMaxBonderFeePct')
                      await action.connect(owner).authorize(owner.address, setMaxBonderFeePctRole)
                      await action.connect(owner).setMaxBonderFeePct(bonderFeePct)
                    })

                    context('when the current balance passes the threshold', () => {
                      const threshold = amount
                      const bonderFee = amount.mul(bonderFeePct).div(fp(1))

                      beforeEach('set threshold', async () => {
                        const setThresholdRole = action.interface.getSighash('setThreshold')
                        await action.connect(owner).authorize(owner.address, setThresholdRole)
                        await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, threshold)
                      })

                      it('can executes', async () => {
                        const canExecute = await action.canExecute(token, amount, slippage, bonderFee)
                        expect(canExecute).to.be.true
                      })

                      it('calls the wrap primitive', async () => {
                        const tx = await action.call(token, amount, slippage, bonderFee)

                        await assertIndirectEvent(tx, smartVault.interface, 'Wrap', {
                          amount,
                          wrapped: amount,
                          data: '0x',
                        })
                      })

                      it('calls the bridge primitive', async () => {
                        const tx = await action.call(token, amount, slippage, bonderFee)

                        const data = defaultAbiCoder.encode(['address', 'uint256'], [hopL2Amm.address, bonderFee])

                        await assertIndirectEvent(tx, smartVault.interface, 'Bridge', {
                          source: SOURCE,
                          chainId: chainId,
                          token: mimic.wrappedNativeToken.address,
                          amountIn: amount,
                          minAmountOut: amount.sub(amount.mul(slippage).div(fp(1))),
                          data,
                        })
                      })

                      it('emits an Executed event', async () => {
                        const tx = await action.call(token, amount, slippage, bonderFee)

                        await assertEvent(tx, 'Executed')
                      })

                      if (refunds) {
                        it('refunds gas', async () => {
                          const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                          const tx = await action.call(token, amount, slippage, bonderFee)

                          const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                          expect(currentBalance).to.be.gt(previousBalance)

                          const redeemedCost = currentBalance.sub(previousBalance)
                          await assertRelayedBaseCost(tx, redeemedCost, 0.15)
                        })
                      } else {
                        it('does not refund gas', async () => {
                          const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                          await action.call(token, amount, slippage, bonderFee)

                          const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                          expect(currentBalance).to.be.equal(previousBalance)
                        })
                      }
                    })

                    context('when the current balance does not pass the threshold', () => {
                      const threshold = amount.mul(2)
                      const bonderFee = 0

                      beforeEach('set threshold', async () => {
                        const setThresholdRole = action.interface.getSighash('setThreshold')
                        await action.connect(owner).authorize(owner.address, setThresholdRole)
                        await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, threshold)
                      })

                      it('reverts', async () => {
                        await expect(action.call(token, amount, slippage, bonderFee)).to.be.revertedWith(
                          'MIN_THRESHOLD_NOT_MET'
                        )
                      })
                    })
                  })

                  context('when the bonder fee is above the limit', () => {
                    const bonderFee = fp(1)

                    it('reverts', async () => {
                      await expect(action.call(token, amount, slippage, bonderFee)).to.be.revertedWith(
                        'BRIDGER_BONDER_FEE_ABOVE_MAX'
                      )
                    })
                  })
                })

                context('when the slippage is above the limit', () => {
                  const slippage = fp(0.01)

                  it('reverts', async () => {
                    await expect(action.call(token, amount, slippage, 0)).to.be.revertedWith(
                      'BRIDGER_SLIPPAGE_ABOVE_MAX'
                    )
                  })
                })
              })

              context('when the destination chain ID was set', () => {
                it('reverts', async () => {
                  await expect(action.call(token, amount, 0, 0)).to.be.revertedWith('BRIDGER_CHAIN_NOT_SET')
                })
              })
            })

            context('when the requested amount is zero', () => {
              const amount = 0

              it('reverts', async () => {
                await expect(action.call(token, amount, 0, 0)).to.be.revertedWith('BRIDGER_AMOUNT_ZERO')
              })
            })
          })

          context('when the given token does not have an AMM set', () => {
            it('reverts', async () => {
              await expect(action.call(token, 0, 0, 0)).to.be.revertedWith('BRIDGER_TOKEN_AMM_NOT_SET')
            })
          })
        })

        context('when the given token is an ERC20 token', () => {
          let token: Contract, hopL2Amm: Contract

          beforeEach('deploy token and amm mock', async () => {
            token = await createTokenMock()
            hopL2Amm = await deploy(MOCKS.HOP_L2_AMM, [token.address, token.address])
          })

          context('when the given token has an AMM set', () => {
            beforeEach('set token AMM', async () => {
              const setTokenAmmRole = action.interface.getSighash('setTokenAmm')
              await action.connect(owner).authorize(owner.address, setTokenAmmRole)
              await action.connect(owner).setTokenAmm(token.address, hopL2Amm.address)
            })

            context('when the amount is greater than zero', () => {
              const amount = fp(50)

              beforeEach('fund action', async () => {
                await token.mint(action.address, amount)
              })

              context('when the destination chain ID was set', () => {
                const chainId = 1

                beforeEach('set destination chain ID', async () => {
                  const setDestinationChainIdRole = action.interface.getSighash('setDestinationChainId')
                  await action.connect(owner).authorize(owner.address, setDestinationChainIdRole)
                  await action.connect(owner).setDestinationChainId(chainId)
                })

                context('when the slippage is below the limit', () => {
                  const slippage = fp(0.01)

                  beforeEach('set max slippage', async () => {
                    const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
                    await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
                    await action.connect(owner).setMaxSlippage(slippage)
                  })

                  context('when the bonder fee is below the limit', () => {
                    const bonderFeePct = fp(0.002)

                    beforeEach('set max bonder fee', async () => {
                      const setMaxBonderFeePctRole = action.interface.getSighash('setMaxBonderFeePct')
                      await action.connect(owner).authorize(owner.address, setMaxBonderFeePctRole)
                      await action.connect(owner).setMaxBonderFeePct(bonderFeePct)
                    })

                    context('when the current balance passes the threshold', () => {
                      const threshold = amount
                      const bonderFee = amount.mul(bonderFeePct).div(fp(1))

                      beforeEach('set threshold', async () => {
                        const setThresholdRole = action.interface.getSighash('setThreshold')
                        await action.connect(owner).authorize(owner.address, setThresholdRole)
                        await action.connect(owner).setThreshold(token.address, threshold)
                      })

                      it('can executes', async () => {
                        const canExecute = await action.canExecute(token.address, amount, slippage, bonderFee)
                        expect(canExecute).to.be.true
                      })

                      it('does not call the wrap primitive', async () => {
                        const tx = await action.call(token.address, amount, slippage, bonderFee)

                        await assertNoIndirectEvent(tx, smartVault.interface, 'Wrap')
                      })

                      it('calls the bridge primitive', async () => {
                        const tx = await action.call(token.address, amount, slippage, bonderFee)

                        const data = defaultAbiCoder.encode(['address', 'uint256'], [hopL2Amm.address, bonderFee])

                        await assertIndirectEvent(tx, smartVault.interface, 'Bridge', {
                          source: SOURCE,
                          chainId,
                          token,
                          amountIn: amount,
                          minAmountOut: amount.sub(amount.mul(slippage).div(fp(1))),
                          data,
                        })
                      })

                      it('emits an Executed event', async () => {
                        const tx = await action.call(token.address, amount, slippage, bonderFee)

                        await assertEvent(tx, 'Executed')
                      })

                      if (refunds) {
                        it('refunds gas', async () => {
                          const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                          const tx = await action.call(token.address, amount, slippage, bonderFee)

                          const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                          expect(currentBalance).to.be.gt(previousBalance)

                          const redeemedCost = currentBalance.sub(previousBalance)
                          await assertRelayedBaseCost(tx, redeemedCost, 0.15)
                        })
                      } else {
                        it('does not refund gas', async () => {
                          const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                          await action.call(token.address, amount, slippage, bonderFee)

                          const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                          expect(currentBalance).to.be.equal(previousBalance)
                        })
                      }
                    })

                    context('when the current balance does not pass the threshold', () => {
                      const threshold = amount.mul(2)
                      const bonderFee = 0

                      beforeEach('set threshold', async () => {
                        const setThresholdRole = action.interface.getSighash('setThreshold')
                        await action.connect(owner).authorize(owner.address, setThresholdRole)
                        await action.connect(owner).setThreshold(token.address, threshold)
                      })

                      it('reverts', async () => {
                        await expect(action.call(token.address, amount, slippage, bonderFee)).to.be.revertedWith(
                          'MIN_THRESHOLD_NOT_MET'
                        )
                      })
                    })
                  })

                  context('when the bonder fee is above the limit', () => {
                    const bonderFee = fp(1)

                    it('reverts', async () => {
                      await expect(action.call(token.address, amount, slippage, bonderFee)).to.be.revertedWith(
                        'BRIDGER_BONDER_FEE_ABOVE_MAX'
                      )
                    })
                  })
                })

                context('when the slippage is above the limit', () => {
                  const slippage = fp(0.01)

                  it('reverts', async () => {
                    await expect(action.call(token.address, amount, slippage, 0)).to.be.revertedWith(
                      'BRIDGER_SLIPPAGE_ABOVE_MAX'
                    )
                  })
                })
              })

              context('when the destination chain ID was set', () => {
                it('reverts', async () => {
                  await expect(action.call(token.address, amount, 0, 0)).to.be.revertedWith('BRIDGER_CHAIN_NOT_SET')
                })
              })
            })

            context('when the requested amount is zero', () => {
              const amount = 0

              it('reverts', async () => {
                await expect(action.call(token.address, amount, 0, 0)).to.be.revertedWith('BRIDGER_AMOUNT_ZERO')
              })
            })
          })

          context('when the given token does not have an AMM set', () => {
            it('reverts', async () => {
              await expect(action.call(token.address, 0, 0, 0)).to.be.revertedWith('BRIDGER_TOKEN_AMM_NOT_SET')
            })
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

        beforeEach('fund smart vault to pay gas', async () => {
          await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(1) })
          await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, fp(1))
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS, 0, 0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
