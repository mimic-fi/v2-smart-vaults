import {
  assertEvent,
  assertIndirectEvent,
  currentTimestamp,
  deploy,
  fp,
  getSigners,
  ONES_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import {
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

describe('L1HopBridger', () => {
  let action: Contract, smartVault: Contract, token: Contract, hopL1Bridge: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('L1HopBridger', mimic, owner, smartVault)
  })

  beforeEach('deploy token and bridge mock', async () => {
    token = await createTokenMock()
    hopL1Bridge = await deploy(MOCKS.HOP_L1_BRIDGE, [token.address])
  })

  beforeEach('authorize action', async () => {
    const bridgeRole = smartVault.interface.getSighash('bridge')
    await smartVault.connect(owner).authorize(action.address, bridgeRole)
  })

  describe('setTokenBridge', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenBridgeRole = action.interface.getSighash('setTokenBridge')
        await action.connect(owner).authorize(owner.address, setTokenBridgeRole)
        action = action.connect(owner)
      })

      context('when the token address is not zero', () => {
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

  describe('setAllowedChain', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setAllowedChainRole = action.interface.getSighash('setAllowedChain')
        await action.connect(owner).authorize(owner.address, setAllowedChainRole)
        action = action.connect(owner)
      })

      context('when the chain ID is not zero', () => {
        context('when the chain ID is not the current one', () => {
          const chainId = 1

          const itConfigsTheChainCorrectly = (allowed: boolean) => {
            it(`${allowed ? 'allows' : 'disallows'} the chain ID`, async () => {
              await action.setAllowedChain(chainId, allowed)

              expect(await action.isChainAllowed(chainId)).to.be.equal(allowed)
            })

            it('emits an event', async () => {
              const tx = await action.setAllowedChain(chainId, allowed)

              await assertEvent(tx, 'AllowedChainSet', { chainId, allowed })
            })
          }

          context('when allowing the chain', () => {
            const allowed = true

            context('when the chain was allowed', () => {
              beforeEach('allow the chain', async () => {
                await action.setAllowedChain(chainId, true)
              })

              itConfigsTheChainCorrectly(allowed)
            })

            context('when the chain was not allowed', () => {
              beforeEach('disallow the chain', async () => {
                await action.setAllowedChain(chainId, false)
              })

              itConfigsTheChainCorrectly(allowed)
            })
          })

          context('when disallowing the chain', () => {
            const allowed = false

            context('when the chain was allowed', () => {
              beforeEach('allow the chain', async () => {
                await action.setAllowedChain(chainId, true)
              })

              itConfigsTheChainCorrectly(allowed)
            })

            context('when the chain was not allowed', () => {
              beforeEach('disallow the chain', async () => {
                await action.setAllowedChain(chainId, false)
              })

              itConfigsTheChainCorrectly(allowed)
            })
          })
        })

        context('when the chain ID is the current one', () => {
          const chainId = 31337 // Hardhat chain ID

          it('reverts', async () => {
            await expect(action.setAllowedChain(chainId, true)).to.be.revertedWith('BRIDGER_SAME_CHAIN_ID')
          })
        })
      })

      context('when the chain ID is zero', () => {
        const chainId = 0

        it('reverts', async () => {
          await expect(action.setAllowedChain(chainId, true)).to.be.revertedWith('BRIDGER_CHAIN_ID_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setAllowedChain(1, true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
    const DEADLINE = 60 * 2
    const SLIPPAGE = fp(0.01)
    const RELAYER = ZERO_ADDRESS
    const RELAYER_FEE_PCT = fp(0.002)

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

      context('when the given token has a bridge set', () => {
        beforeEach('set token bridge', async () => {
          const setTokenBridgeRole = action.interface.getSighash('setTokenBridge')
          await action.connect(owner).authorize(owner.address, setTokenBridgeRole)
          await action.connect(owner).setTokenBridge(token.address, hopL1Bridge.address)
        })

        context('when the amount is greater than zero', () => {
          const amount = fp(50)

          beforeEach('fund smart vault', async () => {
            await token.mint(smartVault.address, amount)
          })

          context('when the destination chain ID was set', () => {
            const chainId = 5

            beforeEach('allow chain ID', async () => {
              const setAllowedChainRole = action.interface.getSighash('setAllowedChain')
              await action.connect(owner).authorize(owner.address, setAllowedChainRole)
              await action.connect(owner).setAllowedChain(chainId, true)
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
                  const threshold = amount
                  const relayerFee = amount.mul(RELAYER_FEE_PCT).div(fp(1))

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(token.address, threshold)
                  })

                  it('can executes', async () => {
                    const canExecute = await action.canExecute(
                      chainId,
                      token.address,
                      amount,
                      SLIPPAGE,
                      RELAYER,
                      relayerFee
                    )
                    expect(canExecute).to.be.true
                  })

                  it('calls the bridge primitive', async () => {
                    const tx = await action.call(chainId, token.address, amount, SLIPPAGE, RELAYER, relayerFee)

                    const deadline = (await currentTimestamp()).add(DEADLINE)
                    const data = defaultAbiCoder.encode(
                      ['address', 'uint256', 'address', 'uint256'],
                      [hopL1Bridge.address, deadline, RELAYER, relayerFee]
                    )

                    await assertIndirectEvent(tx, smartVault.interface, 'Bridge', {
                      source: SOURCE,
                      chainId,
                      amountIn: amount,
                      minAmountOut: amount.sub(amount.mul(SLIPPAGE).div(fp(1))),
                      data,
                    })
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(chainId, token.address, amount, SLIPPAGE, RELAYER, relayerFee)

                    await assertEvent(tx, 'Executed')
                  })
                })

                context('when the current balance does not pass the threshold', () => {
                  const threshold = amount.mul(2)

                  beforeEach('set threshold', async () => {
                    const setThresholdRole = action.interface.getSighash('setThreshold')
                    await action.connect(owner).authorize(owner.address, setThresholdRole)
                    await action.connect(owner).setThreshold(token.address, threshold)
                  })

                  it('reverts', async () => {
                    await expect(
                      action.call(chainId, token.address, amount, SLIPPAGE, RELAYER, RELAYER_FEE_PCT)
                    ).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                  })
                })
              })

              context('when the relayer fee is above the limit', () => {
                const balance = fp(1)
                const relayerFee = fp(1)

                it('reverts', async () => {
                  await expect(
                    action.call(chainId, token.address, balance, SLIPPAGE, RELAYER, relayerFee)
                  ).to.be.revertedWith('BRIDGER_RELAYER_FEE_ABOVE_MAX')
                })
              })
            })

            context('when the slippage is above the limit', () => {
              it('reverts', async () => {
                await expect(action.call(chainId, token.address, amount, SLIPPAGE, RELAYER, 0)).to.be.revertedWith(
                  'BRIDGER_SLIPPAGE_ABOVE_MAX'
                )
              })
            })
          })

          context('when the destination chain ID was not allowed', () => {
            const chainId = 5

            it('reverts', async () => {
              await expect(action.call(chainId, token.address, amount, SLIPPAGE, RELAYER, 0)).to.be.revertedWith(
                'BRIDGER_CHAIN_NOT_ALLOWED'
              )
            })
          })
        })

        context('when the requested amount is zero', () => {
          const amount = 0

          it('reverts', async () => {
            await expect(action.call(0, token.address, amount, SLIPPAGE, RELAYER, 0)).to.be.revertedWith(
              'BRIDGER_AMOUNT_ZERO'
            )
          })
        })
      })

      context('when the given token does not have a bridge set', () => {
        it('reverts', async () => {
          await expect(action.call(0, token.address, 0, SLIPPAGE, RELAYER, 0)).to.be.revertedWith(
            'BRIDGER_TOKEN_BRIDGE_NOT_SET'
          )
        })
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(0, token.address, 0, SLIPPAGE, RELAYER, 0)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })
})
