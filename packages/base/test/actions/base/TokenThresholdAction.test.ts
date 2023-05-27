import { assertEvent, assertNoEvent, BigNumberish, deploy, fp, getSigner, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { createPriceFeedMock, createSmartVault, Mimic, setupMimic } from '../../../dist'
import { createTokenMock } from '../../../src/setup'

/* eslint-disable no-secrets/no-secrets */

describe('TokenThresholdAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic, owner: SignerWithAddress

  const tokenA = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const tokenB = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  const tokenC = '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621'

  before('setup dependencies', async () => {
    owner = await getSigner(2)
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('TokenThresholdActionMock', [
      {
        baseConfig: {
          owner: owner.address,
          smartVault: smartVault.address,
        },
        tokenThresholdConfig: {
          customThresholds: [],
          defaultThreshold: {
            token: ZERO_ADDRESS,
            min: 0,
            max: 0,
          },
        },
      },
    ])
  })

  describe('setDefaultTokenThreshold', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setDefaultTokenThresholdRole = action.interface.getSighash('setDefaultTokenThreshold')
        await action.connect(owner).authorize(owner.address, setDefaultTokenThresholdRole)
        action = action.connect(owner)
      })

      const itCanBeSet = (token: string, min: BigNumberish, max: BigNumberish) => {
        it('sets the default correctly', async () => {
          await action.setDefaultTokenThreshold({ token, min, max })

          const threshold = await action.getDefaultTokenThreshold()
          expect(threshold.token).to.be.equal(token)
          expect(threshold.min).to.be.equal(min)
          expect(threshold.max).to.be.equal(max)
        })

        it('emits an event', async () => {
          const tx = await action.setDefaultTokenThreshold({ token, min, max })
          assertEvent(tx, 'DefaultThresholdSet', { threshold: { token, min, max } })
        })
      }

      context('when the token is not zero', () => {
        const token = tokenA

        context('when the maximum amount is zero', () => {
          const max = fp(0)

          context('when the minimum amount is zero', () => {
            const min = fp(0)

            itCanBeSet(token, min, max)
          })

          context('when the minimum amount is not zero', () => {
            const min = fp(2)

            itCanBeSet(token, min, max)
          })
        })

        context('when the maximum amount is not zero', () => {
          const max = fp(2)

          context('when the minimum amount is zero', () => {
            const min = 0

            itCanBeSet(token, min, max)
          })

          context('when the minimum amount is not zero', () => {
            context('when the minimum amount is lower than the maximum amount', () => {
              const min = max.sub(1)

              itCanBeSet(token, min, max)
            })

            context('when the minimum amount is equal to the maximum amount', () => {
              const min = max

              itCanBeSet(token, min, max)
            })

            context('when the minimum amount is greater than the maximum amount', () => {
              const min = max.add(1)

              it('reverts', async () => {
                await expect(action.setDefaultTokenThreshold({ token, min, max })).to.be.revertedWith(
                  'INVALID_THRESHOLD_MAX_LT_MIN'
                )
              })
            })
          })
        })
      })

      context('when the token is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setDefaultTokenThreshold({ token, min: 0, max: 0 })).to.be.revertedWith(
            'INVALID_THRESHOLD_TOKEN_ZERO'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setDefaultTokenThreshold({ token: ZERO_ADDRESS, min: 0, max: 0 })).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('unsetDefaultTokenThreshold', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const unsetDefaultTokenThresholdRole = action.interface.getSighash('unsetDefaultTokenThreshold')
        await action.connect(owner).authorize(owner.address, unsetDefaultTokenThresholdRole)
      })

      const itCanBeUnset = () => {
        it('unsets the default token threshold correctly', async () => {
          await action.connect(owner).unsetDefaultTokenThreshold()

          const threshold = await action.getDefaultTokenThreshold()
          expect(threshold.token).to.be.equal(ZERO_ADDRESS)
          expect(threshold.min).to.be.equal(0)
          expect(threshold.max).to.be.equal(0)
        })

        it('emits an event', async () => {
          const tx = await action.connect(owner).unsetDefaultTokenThreshold()
          assertEvent(tx, 'DefaultThresholdUnset')
        })
      }

      context('when the default threshold was set', () => {
        beforeEach('set default threshold', async () => {
          const setDefaultTokenThresholdRole = action.interface.getSighash('setDefaultTokenThreshold')
          await action.connect(owner).authorize(owner.address, setDefaultTokenThresholdRole)
          await action.connect(owner).setDefaultTokenThreshold({ token: tokenA, min: 0, max: 10 })
        })

        itCanBeUnset()
      })

      context('when the default threshold was not set', () => {
        itCanBeUnset()
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.unsetDefaultTokenThreshold()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setCustomTokenThresholds', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setCustomTokenThresholdsRole = action.interface.getSighash('setCustomTokenThresholds')
        await action.connect(owner).authorize(owner.address, setCustomTokenThresholdsRole)
        action = action.connect(owner)
      })

      context('when the input length is valid', () => {
        const itCanBeSet = (token: string, thresholdToken: string, min: BigNumberish, max: BigNumberish) => {
          it('sets the custom token threshold correctly', async () => {
            await action.setCustomTokenThresholds([token], [{ token: thresholdToken, min, max }])

            const { exists, threshold } = await action.getCustomTokenThreshold(token)
            expect(exists).to.be.true
            expect(threshold.token).to.be.equal(thresholdToken)
            expect(threshold.min).to.be.equal(min)
            expect(threshold.max).to.be.equal(max)

            const { tokens, thresholds } = await action.getCustomTokenThresholds()

            expect(tokens).to.have.lengthOf(1)
            expect(tokens[0]).to.be.equal(token)

            expect(thresholds).to.have.lengthOf(1)
            expect(thresholds[0].token).to.be.equal(thresholdToken)
            expect(thresholds[0].min).to.be.equal(min)
            expect(thresholds[0].max).to.be.equal(max)
          })

          it('emits an event', async () => {
            const tx = await action.setCustomTokenThresholds([token], [{ token: thresholdToken, min, max }])

            assertEvent(tx, 'TokenThresholdSet', { token, threshold: { token: thresholdToken, min, max } })
          })
        }

        context('when the token is not zero', () => {
          const token = tokenA

          context('when the threshold token is not zero', () => {
            const thresholdToken = tokenB

            context('when the maximum amount is zero', () => {
              const max = fp(0)

              context('when the minimum amount is zero', () => {
                const min = fp(0)

                itCanBeSet(token, thresholdToken, min, max)
              })

              context('when the minimum amount is not zero', () => {
                const min = fp(2)

                itCanBeSet(token, thresholdToken, min, max)
              })
            })

            context('when the maximum amount is not zero', () => {
              const max = fp(2)

              context('when the minimum amount is zero', () => {
                const min = 0

                itCanBeSet(token, thresholdToken, min, max)
              })

              context('when the minimum amount is not zero', () => {
                context('when the minimum amount is lower than the maximum amount', () => {
                  const min = max.sub(1)

                  itCanBeSet(token, thresholdToken, min, max)
                })

                context('when the minimum amount is equal to the maximum amount', () => {
                  const min = max

                  itCanBeSet(token, thresholdToken, min, max)
                })

                context('when the minimum amount is greater than the maximum amount', () => {
                  const min = max.add(1)

                  it('reverts', async () => {
                    await expect(
                      action.setCustomTokenThresholds([token], [{ token: thresholdToken, min, max }])
                    ).to.be.revertedWith('INVALID_THRESHOLD_MAX_LT_MIN')
                  })
                })
              })
            })
          })

          context('when the threshold token is zero', () => {
            const thresholdToken = ZERO_ADDRESS

            it('reverts', async () => {
              await expect(
                action.setCustomTokenThresholds([token], [{ token: thresholdToken, min: 0, max: 0 }])
              ).to.be.revertedWith('INVALID_THRESHOLD_TOKEN_ZERO')
            })
          })
        })

        context('when the token is zero', () => {
          const token = ZERO_ADDRESS

          it('reverts', async () => {
            await expect(
              action.setCustomTokenThresholds([token], [{ token: ZERO_ADDRESS, min: 0, max: 0 }])
            ).to.be.revertedWith('THRESHOLD_TOKEN_ADDRESS_ZERO')
          })
        })
      })

      context('when the input length is not valid', () => {
        it('reverts', async () => {
          await expect(action.setCustomTokenThresholds([tokenA], [])).to.be.revertedWith(
            'TOKEN_THRESHOLDS_INPUT_INV_LEN'
          )
          await expect(action.setCustomTokenThresholds([], [{ token: tokenA, min: 0, max: 0 }])).to.be.revertedWith(
            'TOKEN_THRESHOLDS_INPUT_INV_LEN'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setCustomTokenThresholds([], [])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('unsetCustomTokenThresholds', () => {
    const tokens = [tokenA, tokenB]
    const thresholds = [
      { token: tokenC, min: 1, max: 2 },
      { token: tokenC, min: 3, max: 5 },
    ]

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const unsetCustomTokenThresholdsRole = action.interface.getSighash('unsetCustomTokenThresholds')
        await action.connect(owner).authorize(owner.address, unsetCustomTokenThresholdsRole)
      })

      context('when there were some thresholds set', () => {
        beforeEach('set some thresholds', async () => {
          const setCustomTokenThresholdsRole = action.interface.getSighash('setCustomTokenThresholds')
          await action.connect(owner).authorize(owner.address, setCustomTokenThresholdsRole)
          await action.connect(owner).setCustomTokenThresholds(tokens, thresholds)
        })

        context('when there was a custom threshold set', () => {
          const token = tokenA

          it('removes it from the list', async () => {
            await action.connect(owner).unsetCustomTokenThresholds([token])

            const { tokens, thresholds } = await action.getCustomTokenThresholds()

            expect(tokens).to.have.lengthOf(1)
            expect(tokens[0]).to.be.equal(tokenB)

            expect(thresholds).to.have.lengthOf(1)
            expect(thresholds[0].token).to.be.equal(tokenC)
            expect(thresholds[0].min).to.be.equal(3)
            expect(thresholds[0].max).to.be.equal(5)
          })

          it('emits an event', async () => {
            const tx = await action.connect(owner).unsetCustomTokenThresholds([token])

            assertEvent(tx, 'TokenThresholdUnset', { token })
          })
        })

        context('when there was no custom threshold set', () => {
          const token = tokenC

          it('does not affect the list', async () => {
            await action.connect(owner).unsetCustomTokenThresholds([token])

            const { tokens, thresholds } = await action.getCustomTokenThresholds()
            expect(tokens).to.have.lengthOf(tokens.length)
            expect(tokens).to.have.members(tokens)
            expect(thresholds).to.have.members(thresholds)
          })

          it('does not emit an event', async () => {
            const tx = await action.connect(owner).unsetCustomTokenThresholds([token])

            assertNoEvent(tx, 'TokenThresholdUnset')
          })
        })
      })

      context('when there were no token thresholds set', () => {
        it('ignores the request', async () => {
          const tx = await action.connect(owner).unsetCustomTokenThresholds([tokenA])

          assertNoEvent(tx, 'TokenThresholdUnset')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.unsetCustomTokenThresholds([])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    let USDC: string, USDT: string, WETH: string

    before('deploy tokens', async () => {
      USDC = (await createTokenMock('USDC')).address
      USDT = (await createTokenMock('USDT')).address
      WETH = (await createTokenMock('WETH')).address
    })

    const assertValid = async (token: string, amount: BigNumberish) => {
      await expect(action.call(token, amount)).not.to.be.reverted
    }

    const assertInvalid = async (token: Contract | string, amount: BigNumberish) => {
      await expect(action.call(token, amount)).to.be.revertedWith('ACTION_TOKEN_THRESHOLD_NOT_MET')
    }

    context('when there is no default threshold set', () => {
      context('when there are no custom thresholds set', () => {
        it('allows any combination', async () => {
          await assertValid(WETH, fp(0))
          await assertValid(WETH, fp(1000))

          await assertValid(USDC, fp(0))
          await assertValid(USDC, fp(1000))

          await assertValid(ZERO_ADDRESS, fp(0))
          await assertValid(ZERO_ADDRESS, fp(1000))
        })
      })

      context('when there is a custom threshold set', () => {
        beforeEach('mock price feed', async () => {
          const feed = await createPriceFeedMock(fp(1600))
          const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
          await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
          await smartVault.connect(owner).setPriceFeed(WETH, USDT, feed.address)
        })

        beforeEach('set threshold', async () => {
          const setCustomTokenThresholdsRole = action.interface.getSighash('setCustomTokenThresholds')
          await action.connect(owner).authorize(owner.address, setCustomTokenThresholdsRole)
          await action.connect(owner).setCustomTokenThresholds([WETH], [{ token: USDT, min: fp(3200), max: fp(6400) }])
        })

        it('applies only for when the requested token matches', async () => {
          // Applies the default threshold for WETH
          await assertInvalid(WETH, fp(0))
          await assertInvalid(WETH, fp(1))
          await assertValid(WETH, fp(2))
          await assertValid(WETH, fp(3))
          await assertValid(WETH, fp(4))
          await assertInvalid(WETH, fp(5))
          await assertInvalid(WETH, fp(100))

          // No threshold set
          await assertValid(USDC, fp(0))
          await assertValid(USDC, fp(1000))

          // No threshold set
          await assertValid(ZERO_ADDRESS, fp(0))
          await assertValid(ZERO_ADDRESS, fp(1000))
        })
      })
    })

    context('when there is a default threshold set', () => {
      beforeEach('mock price feed', async () => {
        const feed = await createPriceFeedMock(fp(1600))
        const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
        await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
        await smartVault.connect(owner).setPriceFeed(WETH, USDC, feed.address)
      })

      beforeEach('set default', async () => {
        const setDefaultTokenThresholdRole = action.interface.getSighash('setDefaultTokenThreshold')
        await action.connect(owner).authorize(owner.address, setDefaultTokenThresholdRole)
        await action.connect(owner).setDefaultTokenThreshold({ token: USDC, min: fp(400), max: fp(800) })
      })

      context('when there are no custom thresholds set', () => {
        it('applies the default threshold', async () => {
          // Applies the default threshold for WETH
          await assertInvalid(WETH, fp(0))
          await assertValid(WETH, fp(0.25))
          await assertValid(WETH, fp(0.5))
          await assertInvalid(WETH, fp(1))

          // Applies the default threshold for USDC
          await assertInvalid(USDC, fp(0))
          await assertInvalid(USDC, fp(300))
          await assertValid(USDC, fp(400))
          await assertValid(USDC, fp(600))
          await assertValid(USDC, fp(800))
          await assertInvalid(USDC, fp(1000))

          // It tries to fetch a rate since it tries to use the default threshold
          await expect(action.call(USDT, fp(0))).to.be.reverted
          await expect(action.call(ZERO_ADDRESS, fp(0))).to.be.reverted
        })
      })

      context('when there is a custom threshold set', () => {
        beforeEach('mock price feed', async () => {
          const feed = await createPriceFeedMock(fp(1650))
          const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
          await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
          await smartVault.connect(owner).setPriceFeed(WETH, USDT, feed.address)
        })

        beforeEach('set threshold', async () => {
          const setCustomTokenThresholdsRole = action.interface.getSighash('setCustomTokenThresholds')
          await action.connect(owner).authorize(owner.address, setCustomTokenThresholdsRole)
          await action.connect(owner).setCustomTokenThresholds([WETH], [{ token: USDT, min: fp(3300), max: fp(6600) }])
        })

        it('applies the custom threshold only when the requested token matches', async () => {
          // Applies the custom threshold for WETH
          await assertInvalid(WETH, fp(0))
          await assertInvalid(WETH, fp(1))
          await assertValid(WETH, fp(2))
          await assertValid(WETH, fp(3))
          await assertValid(WETH, fp(4))
          await assertInvalid(WETH, fp(5))
          await assertInvalid(WETH, fp(100))

          // Applies the default threshold for USDC
          await assertInvalid(USDC, fp(0))
          await assertInvalid(USDC, fp(300))
          await assertValid(USDC, fp(400))
          await assertValid(USDC, fp(600))
          await assertValid(USDC, fp(800))
          await assertInvalid(USDC, fp(1000))

          // It tries to fetch a rate since it tries to use the default threshold
          await expect(action.call(USDT, fp(0))).to.be.reverted
          await expect(action.call(ZERO_ADDRESS, fp(0))).to.be.reverted
        })
      })
    })
  })
})
