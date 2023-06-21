import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  deploy,
  fp,
  getSigners,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { createSmartVault, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('FantomBridger', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('FantomBridger', [
      {
        admin: owner.address,
        registry: mimic.registry.address,
        smartVault: smartVault.address,
        allowedTokens: [mimic.wrappedNativeToken.address],
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

  describe('call', () => {
    let token: Contract

    beforeEach('deploy token', async () => {
      token = await deploy('FantomAssetMock', ['WETH'])
    })

    beforeEach('authorize action', async () => {
      const callRole = smartVault.interface.getSighash('call')
      await smartVault.connect(owner).authorize(action.address, callRole)
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

          context('when the current balance passes the threshold', () => {
            const threshold = amount

            beforeEach('set threshold', async () => {
              const setThresholdRole = action.interface.getSighash('setThreshold')
              await action.connect(owner).authorize(owner.address, setThresholdRole)
              await action.connect(owner).setThreshold(token.address, threshold)
            })

            it('calls the bridge primitive', async () => {
              const tx = await action.call(token.address, amount)

              const callData = token.interface.encodeFunctionData('Swapout', [amount, smartVault.address])
              await assertIndirectEvent(tx, smartVault.interface, 'Call', {
                target: token.address,
                callData,
                value: 0,
                data: '0x',
              })
            })

            it('emits an Executed event', async () => {
              const tx = await action.call(token.address, amount)

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
              await expect(action.call(token.address, amount)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when the given token is not allowed', () => {
          it('reverts', async () => {
            await expect(action.call(token.address, amount)).to.be.revertedWith('BRIDGER_TOKEN_NOT_ALLOWED')
          })
        })
      })

      context('when the requested amount is zero', () => {
        const amount = 0

        it('reverts', async () => {
          await expect(action.call(token.address, amount)).to.be.revertedWith('BRIDGER_AMOUNT_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
