import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  assertNoIndirectEvent,
  deploy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { createSmartVault, createTokenMock, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('AxelarBridger', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('AxelarBridger', [
      {
        smartVault: smartVault.address,
        thresholdToken: mimic.wrappedNativeToken.address,
        thresholdAmount: 0,
        allowedTokens: [],
        allowedChainIds: [],
      },
      owner.address,
      mimic.registry.address,
    ])
  })

  describe('setAllowedToken', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setAllowedTokenRole = action.interface.getSighash('setAllowedToken')
        await action.connect(owner).authorize(owner.address, setAllowedTokenRole)
        action = action.connect(owner)
      })

      context('when the token is not zero', () => {
        let token: Contract

        beforeEach('set token', async () => {
          token = mimic.wrappedNativeToken
        })

        const itConfigsTheTokenCorrectly = (allowed: boolean) => {
          it(`${allowed ? 'allows' : 'disallows'} the token`, async () => {
            await action.setAllowedToken(token.address, allowed)

            expect(await action.isTokenAllowed(token.address)).to.be.equal(allowed)
          })
        }

        const itEmitsAnEvent = (allowed: boolean) => {
          it('emits an event', async () => {
            const tx = await action.setAllowedToken(token.address, allowed)

            await assertEvent(tx, 'AllowedTokenSet', { token, allowed })
          })
        }

        const itDoesNotEmitAnEvent = (allowed: boolean) => {
          it('does not emit an event', async () => {
            const tx = await action.setAllowedToken(token.address, allowed)

            await assertNoEvent(tx, 'AllowedTokenSet')
          })
        }

        context('when allowing the token', () => {
          const allowed = true

          context('when the token was allowed', () => {
            beforeEach('allow the token', async () => {
              await action.setAllowedToken(token.address, true)
            })

            itConfigsTheTokenCorrectly(allowed)
            itDoesNotEmitAnEvent(allowed)
          })

          context('when the token was not allowed', () => {
            beforeEach('disallow the token', async () => {
              await action.setAllowedToken(token.address, false)
            })

            itConfigsTheTokenCorrectly(allowed)
            itEmitsAnEvent(allowed)
          })
        })

        context('when disallowing the token', () => {
          const allowed = false

          context('when the token was allowed', () => {
            beforeEach('allow the token', async () => {
              await action.setAllowedToken(token.address, true)
            })

            itConfigsTheTokenCorrectly(allowed)
            itEmitsAnEvent(allowed)
          })

          context('when the token was not allowed', () => {
            beforeEach('disallow the token', async () => {
              await action.setAllowedToken(token.address, false)
            })

            itConfigsTheTokenCorrectly(allowed)
            itDoesNotEmitAnEvent(allowed)
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setAllowedToken(token, true)).to.be.revertedWith('BRIDGER_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setAllowedToken(ZERO_ADDRESS, true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
          }

          const itEmitsAnEvent = (allowed: boolean) => {
            it('emits an event', async () => {
              const tx = await action.setAllowedChain(chainId, allowed)

              await assertEvent(tx, 'AllowedChainSet', { chainId, allowed })
            })
          }

          const itDoesNotEmitAnEvent = (allowed: boolean) => {
            it('does not emit an event', async () => {
              const tx = await action.setAllowedChain(chainId, allowed)

              await assertNoEvent(tx, 'AllowedChainSet')
            })
          }

          context('when allowing the chain', () => {
            const allowed = true

            context('when the chain was allowed', () => {
              beforeEach('allow the chain', async () => {
                await action.setAllowedChain(chainId, true)
              })

              itConfigsTheChainCorrectly(allowed)
              itDoesNotEmitAnEvent(allowed)
            })

            context('when the chain was not allowed', () => {
              beforeEach('disallow the chain', async () => {
                await action.setAllowedChain(chainId, false)
              })

              itConfigsTheChainCorrectly(allowed)
              itEmitsAnEvent(allowed)
            })
          })

          context('when disallowing the chain', () => {
            const allowed = false

            context('when the chain was allowed', () => {
              beforeEach('allow the chain', async () => {
                await action.setAllowedChain(chainId, true)
              })

              itConfigsTheChainCorrectly(allowed)
              itEmitsAnEvent(allowed)
            })

            context('when the chain was not allowed', () => {
              beforeEach('disallow the chain', async () => {
                await action.setAllowedChain(chainId, false)
              })

              itConfigsTheChainCorrectly(allowed)
              itDoesNotEmitAnEvent(allowed)
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

  describe('call', () => {
    const SOURCE = 1

    beforeEach('authorize action', async () => {
      const wrapRole = smartVault.interface.getSighash('wrap')
      await smartVault.connect(owner).authorize(action.address, wrapRole)
      const bridgeRole = smartVault.interface.getSighash('bridge')
      await smartVault.connect(owner).authorize(action.address, bridgeRole)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      context('when the given token is the native token', () => {
        const token = NATIVE_TOKEN_ADDRESS

        context('when the destination chain ID was allowed', () => {
          const chainId = 5

          beforeEach('allow chain ID', async () => {
            const setAllowedChainRole = action.interface.getSighash('setAllowedChain')
            await action.connect(owner).authorize(owner.address, setAllowedChainRole)
            await action.connect(owner).setAllowedChain(chainId, true)
          })

          context('when the given token is allowed', () => {
            beforeEach('allow token', async () => {
              const setAllowedTokenRole = action.interface.getSighash('setAllowedToken')
              await action.connect(owner).authorize(owner.address, setAllowedTokenRole)
              await action.connect(owner).setAllowedToken(token, true)
            })

            context('when the amount is greater than zero', () => {
              const amount = fp(50)

              beforeEach('fund smart vault', async () => {
                await owner.sendTransaction({ to: smartVault.address, value: amount })
              })

              context('when the current balance passes the threshold', () => {
                const threshold = amount

                beforeEach('set threshold', async () => {
                  const setThresholdRole = action.interface.getSighash('setThreshold')
                  await action.connect(owner).authorize(owner.address, setThresholdRole)
                  await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, threshold)
                })

                it('calls the wrap primitive', async () => {
                  const tx = await action.call(chainId, token, amount)

                  await assertIndirectEvent(tx, smartVault.interface, 'Wrap', {
                    amount,
                    wrapped: amount,
                    data: '0x',
                  })
                })

                it('calls the bridge primitive', async () => {
                  const tx = await action.call(chainId, token, amount)

                  await assertIndirectEvent(tx, smartVault.interface, 'Bridge', {
                    source: SOURCE,
                    chainId,
                    token: mimic.wrappedNativeToken,
                    amountIn: amount,
                    minAmountOut: amount,
                    data: '0x',
                  })
                })

                it('emits an Executed event', async () => {
                  const tx = await action.call(chainId, token, amount)

                  await assertEvent(tx, 'Executed')
                })
              })

              context('when the current balance does not pass the threshold', () => {
                const threshold = amount.mul(2)

                beforeEach('set threshold', async () => {
                  const setThresholdRole = action.interface.getSighash('setThreshold')
                  await action.connect(owner).authorize(owner.address, setThresholdRole)
                  await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, threshold)
                })

                it('reverts', async () => {
                  await expect(action.call(chainId, token, amount)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                })
              })
            })

            context('when the requested amount is zero', () => {
              const amount = 0

              it('reverts', async () => {
                await expect(action.call(chainId, token, amount)).to.be.revertedWith('BRIDGER_AMOUNT_ZERO')
              })
            })
          })

          context('when the given token is not allowed', () => {
            it('reverts', async () => {
              await expect(action.call(chainId, token, 0)).to.be.revertedWith('BRIDGER_TOKEN_NOT_ALLOWED')
            })
          })
        })

        context('when the destination chain ID was not allowed', () => {
          const chainId = 5

          it('reverts', async () => {
            await expect(action.call(chainId, token, 0)).to.be.revertedWith('BRIDGER_CHAIN_NOT_ALLOWED')
          })
        })
      })

      context('when the given token is an ERC20 token', () => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await createTokenMock()
        })

        context('when the destination chain ID was allowed', () => {
          const chainId = 5

          beforeEach('allow chain ID', async () => {
            const setAllowedChainRole = action.interface.getSighash('setAllowedChain')
            await action.connect(owner).authorize(owner.address, setAllowedChainRole)
            await action.connect(owner).setAllowedChain(chainId, true)
          })

          context('when the given token was allowed', () => {
            beforeEach('allow token', async () => {
              const setAllowedTokenRole = action.interface.getSighash('setAllowedToken')
              await action.connect(owner).authorize(owner.address, setAllowedTokenRole)
              await action.connect(owner).setAllowedToken(token.address, true)
            })

            context('when the amount is greater than zero', () => {
              const amount = fp(50)

              beforeEach('fund smart vault', async () => {
                await token.mint(smartVault.address, amount)
              })

              context('when the current balance passes the threshold', () => {
                const threshold = amount

                beforeEach('set threshold', async () => {
                  const setThresholdRole = action.interface.getSighash('setThreshold')
                  await action.connect(owner).authorize(owner.address, setThresholdRole)
                  await action.connect(owner).setThreshold(token.address, threshold)
                })

                it('does not call the wrap primitive', async () => {
                  const tx = await action.call(chainId, token.address, amount)

                  await assertNoIndirectEvent(tx, smartVault.interface, 'Wrap')
                })

                it('calls the bridge primitive', async () => {
                  const tx = await action.call(chainId, token.address, amount)

                  await assertIndirectEvent(tx, smartVault.interface, 'Bridge', {
                    source: SOURCE,
                    chainId,
                    token,
                    amountIn: amount,
                    minAmountOut: amount,
                    data: '0x',
                  })
                })

                it('emits an Executed event', async () => {
                  const tx = await action.call(chainId, token.address, amount)

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
                  await expect(action.call(chainId, token.address, amount)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
                })
              })
            })

            context('when the requested amount is zero', () => {
              const amount = 0

              it('reverts', async () => {
                await expect(action.call(chainId, token.address, amount)).to.be.revertedWith('BRIDGER_AMOUNT_ZERO')
              })
            })
          })

          context('when the given token is not allowed', () => {
            it('reverts', async () => {
              await expect(action.call(chainId, token.address, 0)).to.be.revertedWith('BRIDGER_TOKEN_NOT_ALLOWED')
            })
          })
        })

        context('when the destination chain ID was not allowed', () => {
          const chainId = 5

          it('reverts', async () => {
            await expect(action.call(chainId, token.address, 0)).to.be.revertedWith('BRIDGER_CHAIN_NOT_ALLOWED')
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.call(0, ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
