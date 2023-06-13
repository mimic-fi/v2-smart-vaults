import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  assertNoIndirectEvent,
  deploy,
  fp,
  getSigners,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { createSmartVault, createTokenMock, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'

describe('ConnextBridger', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('ConnextBridger', [
      {
        admin: owner.address,
        registry: mimic.registry.address,
        smartVault: smartVault.address,
        allowedTokens: [mimic.wrappedNativeToken.address],
        maxRelayerFeePct: fp(0.1),
        destinationChainId: 1,
        thresholdToken: mimic.wrappedNativeToken.address,
        thresholdAmount: fp(100),
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

      expect(await action.registry()).to.be.equal(mimic.registry.address)
      expect(await action.smartVault()).to.be.equal(smartVault.address)
      expect(await action.destinationChainId()).to.be.equal(1)
      expect(await action.maxRelayerFeePct()).to.be.equal(fp(0.1))
      expect(await action.isTokenAllowed(mimic.wrappedNativeToken.address)).to.be.true

      expect(await action.isRelayer(owner.address)).to.be.true
      expect(await action.gasPriceLimit()).to.be.eq(100e9)
      expect(await action.txCostLimit()).to.be.eq(0)

      expect(await action.thresholdToken()).to.be.eq(mimic.wrappedNativeToken.address)
      expect(await action.thresholdAmount()).to.be.eq(fp(100))
    })
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

  describe('setMaxRelayerFeePct', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setMaxRelayerFeePctRole = action.interface.getSighash('setMaxRelayerFeePct')
        await action.connect(owner).authorize(owner.address, setMaxRelayerFeePctRole)
        action = action.connect(owner)
      })

      context('when the pct is not above one', () => {
        const pct = fp(0.1)

        it('sets the relayer fee pct', async () => {
          await action.setMaxRelayerFeePct(pct)

          expect(await action.maxRelayerFeePct()).to.be.equal(pct)
        })

        it('emits an event', async () => {
          const tx = await action.setMaxRelayerFeePct(pct)

          await assertEvent(tx, 'MaxRelayerFeePctSet', { maxFeePct: pct })
        })
      })

      context('when the pct is above one', () => {
        const pct = fp(1).add(1)

        it('reverts', async () => {
          await expect(action.setMaxRelayerFeePct(pct)).to.be.revertedWith('BRIDGER_RELAYER_FEE_PCT_GT_ONE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setMaxRelayerFeePct(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    let token: Contract

    const SOURCE = 2
    const MAX_RELAYER_FEE_PCT = fp(0.1)
    const DESTINATION_CHAIN_ID = 5

    beforeEach('deploy token', async () => {
      token = await createTokenMock()
    })

    beforeEach('authorize action', async () => {
      const wrapRole = smartVault.interface.getSighash('wrap')
      await smartVault.connect(owner).authorize(action.address, wrapRole)
      const bridgeRole = smartVault.interface.getSighash('bridge')
      await smartVault.connect(owner).authorize(action.address, bridgeRole)
    })

    beforeEach('set max relayer fee', async () => {
      const setMaxRelayerFeePctRole = action.interface.getSighash('setMaxRelayerFeePct')
      await action.connect(owner).authorize(owner.address, setMaxRelayerFeePctRole)
      await action.connect(owner).setMaxRelayerFeePct(MAX_RELAYER_FEE_PCT)
    })

    beforeEach('set destination chain ID', async () => {
      const setDestinationChainIdRole = action.interface.getSighash('setDestinationChainId')
      await action.connect(owner).authorize(owner.address, setDestinationChainIdRole)
      await action.connect(owner).setDestinationChainId(DESTINATION_CHAIN_ID)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      context('when the amount is greater than zero', () => {
        const amount = fp(50)

        context('when the given token is allowed', () => {
          beforeEach('allow token', async () => {
            const setAllowedTokenRole = action.interface.getSighash('setAllowedToken')
            await action.connect(owner).authorize(owner.address, setAllowedTokenRole)
            await action.connect(owner).setAllowedToken(token.address, true)
          })

          beforeEach('fund smart vault', async () => {
            await token.mint(smartVault.address, amount)
          })

          context('when the relayer fee is below the limit', () => {
            const relayerFee = amount.mul(MAX_RELAYER_FEE_PCT).div(fp(1))

            context('when the current balance passes the threshold', () => {
              const threshold = amount

              beforeEach('set threshold', async () => {
                const setThresholdRole = action.interface.getSighash('setThreshold')
                await action.connect(owner).authorize(owner.address, setThresholdRole)
                await action.connect(owner).setThreshold(token.address, threshold)
              })

              it('does not call the wrap primitive', async () => {
                const tx = await action.call(token.address, amount, relayerFee)

                await assertNoIndirectEvent(tx, smartVault.interface, 'Wrap')
              })

              it('calls the bridge primitive', async () => {
                const tx = await action.call(token.address, amount, relayerFee)

                await assertIndirectEvent(tx, smartVault.interface, 'Bridge', {
                  source: SOURCE,
                  chainId: DESTINATION_CHAIN_ID,
                  token,
                  amountIn: amount.sub(relayerFee),
                  minAmountOut: amount.sub(relayerFee),
                  data: defaultAbiCoder.encode(['uint256'], [relayerFee]),
                })
              })

              it('emits an Executed event', async () => {
                const tx = await action.call(token.address, amount, relayerFee)

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
                await expect(action.call(token.address, amount, relayerFee)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
              })
            })
          })

          context('when the relayer fee is above the limit', () => {
            const relayerFee = amount.mul(MAX_RELAYER_FEE_PCT).div(fp(1)).add(1)

            it('reverts', async () => {
              await expect(action.call(token.address, amount, relayerFee)).to.be.revertedWith(
                'BRIDGER_RELAYER_FEE_ABOVE_MAX'
              )
            })
          })
        })

        context('when the given token is not allowed', () => {
          it('reverts', async () => {
            await expect(action.call(token.address, amount, 0)).to.be.revertedWith('BRIDGER_TOKEN_NOT_ALLOWED')
          })
        })
      })

      context('when the requested amount is zero', () => {
        const amount = 0

        it('reverts', async () => {
          await expect(action.call(token.address, amount, 0)).to.be.revertedWith('BRIDGER_AMOUNT_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS, 0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
