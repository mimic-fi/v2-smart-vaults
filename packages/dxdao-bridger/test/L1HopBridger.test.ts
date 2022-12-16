import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  fp,
  getSigners,
  ONES_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { createAction, createSmartVault, createTokenMock, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'

describe('L1HopBridger', () => {
  let action: Contract, smartVault: Contract, token: Contract, hopL1Bridge: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('L1HopBridger', mimic, owner, smartVault)
  })

  beforeEach('deploy token and bridge mock', async () => {
    token = await createTokenMock()
    hopL1Bridge = await deploy('HopL1BridgeMock', [token.address])
  })

  beforeEach('authorize action', async () => {
    const collectRole = smartVault.interface.getSighash('collect')
    await smartVault.connect(owner).authorize(action.address, collectRole)
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

  describe('setTokenBridge', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenBridgeRole = action.interface.getSighash('setTokenBridge')
        await action.connect(owner).authorize(owner.address, setTokenBridgeRole)
        action = action.connect(owner)
      })

      context('when the token address is not zero', () => {
        context('when the bridge canonical token matches', () => {
          context('when setting the token bridge', () => {
            const itSetsTheTokenBridge = () => {
              it('sets the token bridge', async () => {
                await action.setTokenBridge(token.address, hopL1Bridge.address)

                expect(await action.getTokenBridge(token.address)).to.be.equal(hopL1Bridge.address)
              })

              it('emits an event', async () => {
                const tx = await action.setTokenBridge(token.address, hopL1Bridge.address)

                await assertEvent(tx, 'TokenBridgeSet', { token, bridge: hopL1Bridge.address })
              })
            }

            context('when the token bridge was set', () => {
              beforeEach('set token bridge', async () => {
                await action.setTokenBridge(token.address, hopL1Bridge.address)
              })

              itSetsTheTokenBridge()
            })

            context('when the token bridge was not set', () => {
              beforeEach('unset token bridge', async () => {
                await action.setTokenBridge(token.address, ZERO_ADDRESS)
              })

              itSetsTheTokenBridge()
            })
          })

          context('when unsetting the token bridge', () => {
            const itUnsetsTheTokenBridge = () => {
              it('unsets the token bridge', async () => {
                await action.setTokenBridge(token.address, ZERO_ADDRESS)

                expect(await action.getTokenBridge(token.address)).to.be.equal(ZERO_ADDRESS)
              })

              it('emits an event', async () => {
                const tx = await action.setTokenBridge(token.address, ZERO_ADDRESS)

                await assertEvent(tx, 'TokenBridgeSet', { token, bridge: ZERO_ADDRESS })
              })
            }

            context('when the token bridge was set', () => {
              beforeEach('set token bridge', async () => {
                await action.setTokenBridge(token.address, hopL1Bridge.address)
              })

              itUnsetsTheTokenBridge()
            })

            context('when the token was not set', () => {
              beforeEach('unset token bridge', async () => {
                await action.setTokenBridge(token.address, ZERO_ADDRESS)
              })

              itUnsetsTheTokenBridge()
            })
          })
        })

        context('when the bridge canonical token matches', () => {
          beforeEach('deploy another bridge', async () => {
            hopL1Bridge = await deploy('HopL1BridgeMock', [owner.address])
          })

          it('reverts', async () => {
            await expect(action.setTokenBridge(token.address, hopL1Bridge.address)).to.be.revertedWith(
              'BRIDGER_BRIDGE_TOKEN_DONT_MATCH'
            )
          })
        })
      })

      context('when the token address is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setTokenBridge(token, hopL1Bridge.address)).to.be.revertedWith('BRIDGER_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenBridge(token.address, hopL1Bridge.address)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
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

  describe('setMaxRelayerFeePct', () => {
    const relayer = ONES_ADDRESS

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setMaxRelayerFeePctRole = action.interface.getSighash('setMaxRelayerFeePct')
        await action.connect(owner).authorize(owner.address, setMaxRelayerFeePctRole)
        action = action.connect(owner)
      })

      context('when the pct is not above one', () => {
        const pct = fp(0.1)

        it('sets the relayer fee pct', async () => {
          await action.setMaxRelayerFeePct(relayer, pct)

          expect(await action.getMaxRelayerFeePct(relayer)).to.be.equal(pct)
        })

        it('emits an event', async () => {
          const tx = await action.setMaxRelayerFeePct(relayer, pct)

          await assertEvent(tx, 'MaxRelayerFeePctSet', { relayer, maxFeePct: pct })
        })
      })

      context('when the pct is above one', () => {
        const pct = fp(1).add(1)

        it('reverts', async () => {
          await expect(action.setMaxRelayerFeePct(relayer, pct)).to.be.revertedWith('BRIDGER_RELAYER_FEE_PCT_GT_ONE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setMaxRelayerFeePct(relayer, 1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
    const CHAIN_ID = 1
    const DEADLINE = 60 * 2
    const SLIPPAGE = fp(0.01)
    const RELAYER = ZERO_ADDRESS
    const RELAYER_FEE_PCT = fp(0.002)

    const THRESHOLD = fp(50)

    beforeEach('fund smart vault to pay gas', async () => {
      await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(1) })
      await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, fp(1))
    })

    beforeEach('set threshold', async () => {
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(owner).authorize(owner.address, setThresholdRole)
      await action.connect(owner).setThreshold(token.address, THRESHOLD)
    })

    beforeEach('set deadline', async () => {
      const setMaxDeadlineRole = action.interface.getSighash('setMaxDeadline')
      await action.connect(owner).authorize(owner.address, setMaxDeadlineRole)
      await action.connect(owner).setMaxDeadline(DEADLINE)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (refunds: boolean) => {
        context('when the given token has a bridge set', () => {
          beforeEach('set token bridge', async () => {
            const setTokenBridgeRole = action.interface.getSighash('setTokenBridge')
            await action.connect(owner).authorize(owner.address, setTokenBridgeRole)
            await action.connect(owner).setTokenBridge(token.address, hopL1Bridge.address)
          })

          context('when the destination chain ID was set', () => {
            beforeEach('set destination chain ID', async () => {
              const setDestinationChainIdRole = action.interface.getSighash('setDestinationChainId')
              await action.connect(owner).authorize(owner.address, setDestinationChainIdRole)
              await action.connect(owner).setDestinationChainId(CHAIN_ID)
            })

            context('when the slippage is below the limit', () => {
              beforeEach('set max slippage', async () => {
                const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
                await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
                await action.connect(owner).setMaxSlippage(SLIPPAGE)
              })

              context('when the relayer fee is below the limit', () => {
                beforeEach('set max relayer fee', async () => {
                  const setMaxRelayerFeePctRole = action.interface.getSighash('setMaxRelayerFeePct')
                  await action.connect(owner).authorize(owner.address, setMaxRelayerFeePctRole)
                  await action.connect(owner).setMaxRelayerFeePct(RELAYER, RELAYER_FEE_PCT)
                })

                context('when the current balance passes the threshold', () => {
                  const balance = THRESHOLD
                  const relayerFee = balance.mul(RELAYER_FEE_PCT).div(fp(1))

                  beforeEach('fund action', async () => {
                    await token.mint(action.address, balance)
                  })

                  it('can executes', async () => {
                    const canExecute = await action.canExecute(token.address, balance, SLIPPAGE, RELAYER, relayerFee)
                    expect(canExecute).to.be.true
                  })

                  it('calls the bridge primitive', async () => {
                    const tx = await action.call(token.address, balance, SLIPPAGE, RELAYER, relayerFee)

                    const data = defaultAbiCoder.encode(
                      ['address', 'uint256', 'address', 'uint256'],
                      [hopL1Bridge.address, DEADLINE, RELAYER, relayerFee]
                    )

                    await assertIndirectEvent(tx, smartVault.interface, 'Bridge', {
                      source: SOURCE,
                      chainId: CHAIN_ID,
                      amountIn: balance,
                      minAmountOut: balance.sub(balance.mul(SLIPPAGE).div(fp(1))),
                      data,
                    })
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(token.address, balance, SLIPPAGE, RELAYER, relayerFee)

                    await assertEvent(tx, 'Executed')
                  })

                  it(`${refunds ? 'refunds' : 'does not refund'} gas`, async () => {
                    const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                    await action.call(token.address, balance, SLIPPAGE, RELAYER, relayerFee)

                    const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                    expect(currentBalance).to.be[refunds ? 'gt' : 'equal'](previousBalance)
                  })
                })

                context('when the current balance does not pass the threshold', () => {
                  const balance = THRESHOLD.div(2)

                  beforeEach('fund smart vault token', async () => {
                    await token.mint(smartVault.address, balance)
                  })

                  it('reverts', async () => {
                    await expect(
                      action.call(token.address, balance, SLIPPAGE, RELAYER, RELAYER_FEE_PCT)
                    ).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                  })
                })
              })

              context('when the relayer fee is above the limit', () => {
                const balance = fp(1)
                const relayerFee = fp(1)

                it('reverts', async () => {
                  await expect(action.call(token.address, balance, SLIPPAGE, RELAYER, relayerFee)).to.be.revertedWith(
                    'BRIDGER_RELAYER_FEE_ABOVE_MAX'
                  )
                })
              })
            })

            context('when the slippage is above the limit', () => {
              it('reverts', async () => {
                await expect(action.call(token.address, 0, SLIPPAGE, RELAYER, 0)).to.be.revertedWith(
                  'BRIDGER_SLIPPAGE_ABOVE_MAX'
                )
              })
            })
          })

          context('when the destination chain ID was not set', () => {
            it('reverts', async () => {
              await expect(action.call(token.address, 0, SLIPPAGE, RELAYER, 0)).to.be.revertedWith(
                'BRIDGER_CHAIN_NOT_SET'
              )
            })
          })
        })

        context('when the given token does not have a bridge set', () => {
          it('reverts', async () => {
            await expect(action.call(token.address, 0, SLIPPAGE, RELAYER, 0)).to.be.revertedWith(
              'BRIDGER_TOKEN_BRIDGE_NOT_SET'
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
        await expect(action.call(token.address, 0, SLIPPAGE, RELAYER, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
