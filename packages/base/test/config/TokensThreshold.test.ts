import { BigNumberish, deploy, fp, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

describe('TokensThreshold', () => {
  let config: Contract

  const tokenA = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const tokenB = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  const tokenC = '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621'

  beforeEach('deploy threshold config', async () => {
    config = await deploy('TokensThresholdMock')
  })

  describe('set default', () => {
    const itCanBeSet = (token: string, min: BigNumberish, max: BigNumberish) => {
      it('sets the default correctly', async () => {
        await config.setDefault({ token, min, max })

        const threshold = await config.getDefault()
        expect(threshold.token).to.be.equal(token)
        expect(threshold.min).to.be.equal(min)
        expect(threshold.max).to.be.equal(max)
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
              await expect(config.setDefault({ token, min, max })).to.be.revertedWith('INVALID_THRESHOLD_MAX_LT_MIN')
            })
          })
        })
      })
    })

    context('when the token is zero', () => {
      const token = ZERO_ADDRESS

      it('reverts', async () => {
        await expect(config.setDefault({ token, min: 0, max: 0 })).to.be.revertedWith('INVALID_THRESHOLD_TOKEN_ZERO')
      })
    })
  })

  describe('set custom', () => {
    const itCanBeSet = (token: string, thresholdToken: string, min: BigNumberish, max: BigNumberish) => {
      it('sets the custom threshold correctly', async () => {
        await config.setThreshold(token, { token: thresholdToken, min, max })

        const threshold = await config.getThreshold(token)
        expect(threshold.token).to.be.equal(thresholdToken)
        expect(threshold.min).to.be.equal(min)
        expect(threshold.max).to.be.equal(max)

        const { tokens, thresholds } = await config.getThresholds()

        expect(tokens).to.have.lengthOf(1)
        expect(tokens[0]).to.be.equal(token)

        expect(thresholds).to.have.lengthOf(1)
        expect(thresholds[0].token).to.be.equal(thresholdToken)
        expect(thresholds[0].min).to.be.equal(min)
        expect(thresholds[0].max).to.be.equal(max)
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
                await expect(config.setThreshold(token, { token: thresholdToken, min, max })).to.be.revertedWith(
                  'INVALID_THRESHOLD_MAX_LT_MIN'
                )
              })
            })
          })
        })
      })

      context('when the threshold token is zero', () => {
        const thresholdToken = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(config.setThreshold(token, { token: thresholdToken, min: 0, max: 0 })).to.be.revertedWith(
            'INVALID_THRESHOLD_TOKEN_ZERO'
          )
        })
      })
    })

    context('when the token is zero', () => {
      const token = ZERO_ADDRESS

      it('reverts', async () => {
        await expect(config.setThreshold(token, { token: ZERO_ADDRESS, min: 0, max: 0 })).to.be.revertedWith(
          'THRESHOLD_TOKEN_ADDRESS_ZERO'
        )
      })
    })
  })

  describe('remove', () => {
    const tokens = [tokenA, tokenB]
    const thresholds = [
      { token: tokenC, min: 1, max: 2 },
      { token: tokenC, min: 3, max: 5 },
    ]

    beforeEach('set some thresholds', async () => {
      await config.setManyThresholds(tokens, thresholds)
    })

    context('when there was a custom threshold set', () => {
      const token = tokenA

      it('removes it from the list', async () => {
        await config.removeThreshold(token)

        const { tokens, thresholds } = await config.getThresholds()

        expect(tokens).to.have.lengthOf(1)
        expect(tokens[0]).to.be.equal(tokenB)

        expect(thresholds).to.have.lengthOf(1)
        expect(thresholds[0].token).to.be.equal(tokenC)
        expect(thresholds[0].min).to.be.equal(3)
        expect(thresholds[0].max).to.be.equal(5)
      })
    })

    context('when there was no custom threshold set', () => {
      const token = tokenC

      it('does not affect the list', async () => {
        await config.removeThreshold(token)

        const { tokens, thresholds } = await config.getThresholds()
        expect(tokens).to.have.lengthOf(tokens.length)
        expect(tokens).to.have.members(tokens)
        expect(thresholds).to.have.members(thresholds)
      })
    })
  })

  describe('validate', () => {
    const USDC = tokenA
    const USDT = tokenB
    const WETH = tokenC

    const assertValid = async (token: string, amount: BigNumberish) => {
      expect(await config.isValid(token, amount)).to.be.true
      await expect(config.validate(token, amount)).not.to.be.reverted
    }

    const assertInvalid = async (token: string, amount: BigNumberish) => {
      expect(await config.isValid(token, amount)).to.be.false
      await expect(config.validate(token, amount)).to.be.revertedWith('TOKEN_THRESHOLD_FORBIDDEN')
    }

    context('when there is no default threshold set', () => {
      context('when there are no custom thresholds set', () => {
        it('rejects any combination', async () => {
          await assertInvalid(WETH, fp(0))
          await assertInvalid(WETH, fp(1000))

          await assertInvalid(USDC, fp(0))
          await assertInvalid(USDC, fp(1000))

          await assertInvalid(ZERO_ADDRESS, fp(0))
          await assertInvalid(ZERO_ADDRESS, fp(1000))
        })
      })

      context('when there is a custom threshold set', () => {
        beforeEach('set threshold', async () => {
          await config.mockRate(WETH, USDT, fp(1600))
          await config.setThreshold(WETH, { token: USDT, min: fp(3200), max: fp(6400) })
        })

        it('applies only for when the requested token matches', async () => {
          await assertInvalid(WETH, fp(0))
          await assertInvalid(WETH, fp(1))
          await assertValid(WETH, fp(2))
          await assertValid(WETH, fp(3))
          await assertValid(WETH, fp(4))
          await assertInvalid(WETH, fp(5))
          await assertInvalid(WETH, fp(100))

          await assertInvalid(USDC, fp(0))
          await assertInvalid(USDC, fp(1000))

          await assertInvalid(ZERO_ADDRESS, fp(0))
          await assertInvalid(ZERO_ADDRESS, fp(1000))
        })
      })
    })

    context('when there is a default threshold set', () => {
      beforeEach('set default', async () => {
        await config.mockRate(WETH, USDC, fp(1600))
        await config.setDefault({ token: USDC, min: fp(400), max: fp(800) })
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
          await expect(config.validate(USDT, fp(0))).to.be.revertedWith('TOKENS_THRESHOLD_MOCK_RATE_ZERO')
          await expect(config.validate(ZERO_ADDRESS, fp(0))).to.be.revertedWith('TOKENS_THRESHOLD_MOCK_RATE_ZERO')
        })
      })

      context('when there is a custom threshold set', () => {
        beforeEach('set threshold', async () => {
          await config.mockRate(WETH, USDT, fp(1650))
          await config.setThreshold(WETH, { token: USDT, min: fp(3300), max: fp(6600) })
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
          await expect(config.validate(USDT, fp(0))).to.be.revertedWith('TOKENS_THRESHOLD_MOCK_RATE_ZERO')
          await expect(config.validate(ZERO_ADDRESS, fp(0))).to.be.revertedWith('TOKENS_THRESHOLD_MOCK_RATE_ZERO')
        })
      })
    })
  })
})
