import {
  assertEvent,
  assertIndirectEvent,
  assertNoIndirectEvent,
  deploy,
  fp,
  getSigners,
  MAX_UINT256,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { createSmartVault, createTokenMock, Mimic, setupMimic } from '../../dist'
import { createPriceFeedMock } from '../../src/samples'

describe('RelayedAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('RelayedActionMock', [smartVault.address, owner.address, mimic.registry.address])
  })

  beforeEach('authorize action', async () => {
    const withdrawRole = smartVault.interface.getSighash('withdraw')
    await smartVault.connect(owner).authorize(action.address, withdrawRole)
  })

  beforeEach('set fee collector', async () => {
    const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
    await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
    await smartVault.connect(owner).setFeeCollector(feeCollector.address)
  })

  describe('setPermissiveRelayedMode', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setPermissiveRelayedModeRole = action.interface.getSighash('setPermissiveRelayedMode')
        await action.connect(owner).authorize(owner.address, setPermissiveRelayedModeRole)
        action = action.connect(owner)
      })

      context('when the permissive relayed mode was inactive', async () => {
        it('can be activated', async () => {
          const tx = await action.setPermissiveRelayedMode(true)

          expect(await action.isPermissiveRelayedModeActive()).to.be.true
          await assertEvent(tx, 'PermissiveRelayedModeSet', { active: true })
        })

        it('can be deactivated', async () => {
          const tx = await action.setPermissiveRelayedMode(false)

          expect(await action.isPermissiveRelayedModeActive()).to.be.false
          await assertEvent(tx, 'PermissiveRelayedModeSet', { active: false })
        })
      })

      context('when the permissive relayed mode was active', async () => {
        beforeEach('activate permissive relayed mode', async () => {
          await action.setPermissiveRelayedMode(true)
        })

        it('can be activated', async () => {
          const tx = await action.setPermissiveRelayedMode(true)

          expect(await action.isPermissiveRelayedModeActive()).to.be.true
          await assertEvent(tx, 'PermissiveRelayedModeSet', { active: true })
        })

        it('can be deactivated', async () => {
          const tx = await action.setPermissiveRelayedMode(false)

          expect(await action.isPermissiveRelayedModeActive()).to.be.false
          await assertEvent(tx, 'PermissiveRelayedModeSet', { active: false })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setPermissiveRelayedMode(true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setRelayer', () => {
    let newRelayer: SignerWithAddress

    beforeEach('set new relayer', async () => {
      newRelayer = other
    })

    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setRelayerRole = action.interface.getSighash('setRelayer')
        await action.connect(owner).authorize(owner.address, setRelayerRole)
        action = action.connect(owner)
      })

      context('when the relayer was not allowed', async () => {
        it('can be allowed', async () => {
          const tx = await action.setRelayer(newRelayer.address, true)

          expect(await action.isRelayer(newRelayer.address)).to.be.true
          await assertEvent(tx, 'RelayerSet', { relayer: newRelayer, allowed: true })
        })

        it('can be disallowed', async () => {
          const tx = await action.setRelayer(newRelayer.address, false)

          expect(await action.isRelayer(newRelayer.address)).to.be.false
          await assertEvent(tx, 'RelayerSet', { relayer: newRelayer, allowed: false })
        })
      })

      context('when the relayer was allowed', async () => {
        beforeEach('allow relayer', async () => {
          await action.setRelayer(newRelayer.address, true)
        })

        it('can be allowed', async () => {
          const tx = await action.setRelayer(newRelayer.address, true)

          expect(await action.isRelayer(newRelayer.address)).to.be.true
          await assertEvent(tx, 'RelayerSet', { relayer: newRelayer, allowed: true })
        })

        it('can be disallowed', async () => {
          const tx = await action.setRelayer(newRelayer.address, false)

          expect(await action.isRelayer(newRelayer.address)).to.be.false
          await assertEvent(tx, 'RelayerSet', { relayer: newRelayer, allowed: false })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setRelayer(ZERO_ADDRESS, true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setLimits', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setLimitsRole = action.interface.getSighash('setLimits')
        await action.connect(owner).authorize(owner.address, setLimitsRole)
        action = action.connect(owner)
      })

      context('when the limits are not zero', async () => {
        const gasPriceLimit = 1e10
        const txCostLimit = fp(2)

        it('sets the limits', async () => {
          await action.setLimits(gasPriceLimit, txCostLimit)

          expect(await action.gasPriceLimit()).to.be.equal(gasPriceLimit)
          expect(await action.txCostLimit()).to.be.equal(txCostLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setLimits(gasPriceLimit, txCostLimit)
          await assertEvent(tx, 'LimitsSet', { gasPriceLimit, txCostLimit })
        })
      })

      context('when the limits are zero', async () => {
        const gasPriceLimit = 0
        const txCostLimit = 0

        it('sets the limits', async () => {
          await action.setLimits(gasPriceLimit, txCostLimit)

          expect(await action.gasPriceLimit()).to.be.equal(gasPriceLimit)
          expect(await action.txCostLimit()).to.be.equal(txCostLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setLimits(gasPriceLimit, txCostLimit)
          await assertEvent(tx, 'LimitsSet', { gasPriceLimit, txCostLimit })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setLimits(0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('redeemGas', () => {
    const REDEEM_GAS_NOTE = `0x${Buffer.from('RELAYER', 'utf-8').toString('hex')}`

    beforeEach('authorize owner', async () => {
      const setLimitsRole = action.interface.getSighash('setLimits')
      await action.connect(owner).authorize(owner.address, setLimitsRole)
    })

    const itDoesNotRedeemAnyCost = () => {
      it('does not redeem any cost', async () => {
        const tx = await action.call()

        await assertNoIndirectEvent(tx, smartVault.interface, 'Withdraw')
      })
    }

    context('when the sender is a relayer', () => {
      let token: Contract

      beforeEach('authorize relayer', async () => {
        const setRelayerRole = action.interface.getSighash('setRelayer')
        await action.connect(owner).authorize(owner.address, setRelayerRole)
        await action.connect(owner).setRelayer(other.address, true)
        action = action.connect(other)
      })

      const itRedeemsGasCostProperly = (error: number, native = false, rate = 1) => {
        beforeEach('set token', async () => {
          await action.setToken(native ? NATIVE_TOKEN_ADDRESS : token.address)
        })

        const itRedeemsTheGasCost = (gasPrice?: number) => {
          it('redeems the expected cost to the fee collector', async () => {
            const tx = await action.call(gasPrice ? { gasPrice } : {})

            const { args } = await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
              token: native ? NATIVE_TOKEN_ADDRESS : token.address,
              recipient: feeCollector,
              data: REDEEM_GAS_NOTE,
            })

            const { gasUsed, effectiveGasPrice } = await tx.wait()
            const expectedCost = gasUsed.mul(effectiveGasPrice).mul(rate)
            expect(args.withdrawn).to.be.at.least(expectedCost.sub(error))
            expect(args.withdrawn).to.be.at.most(expectedCost.add(error))
          })
        }

        context('without limits', () => {
          const gasPriceLimit = 0
          const txCostLimit = 0

          beforeEach('set limits', async () => {
            await action.connect(owner).setLimits(gasPriceLimit, txCostLimit)
          })

          context('when the smart vault has enough funds', () => {
            beforeEach('fund smart vault', async () => {
              const amount = fp(0.1).mul(rate)

              if (native) await owner.sendTransaction({ to: smartVault.address, value: amount })
              else if (token != mimic.wrappedNativeToken) await token.mint(smartVault.address, amount)
              else {
                await mimic.wrappedNativeToken.connect(owner).deposit({ value: amount })
                await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, amount)
              }
            })

            context('when the permissive relayed mode is on', () => {
              beforeEach('activate permission relayed mode', async () => {
                const setPermissiveRelayedModeRole = action.interface.getSighash('setPermissiveRelayedMode')
                await action.connect(owner).authorize(owner.address, setPermissiveRelayedModeRole)
                await action.connect(owner).setPermissiveRelayedMode(true)
              })

              itRedeemsTheGasCost()
            })

            context('when the permissive relayed mode is off', () => {
              beforeEach('deactivate permission relayed mode', async () => {
                const setPermissiveRelayedModeRole = action.interface.getSighash('setPermissiveRelayedMode')
                await action.connect(owner).authorize(owner.address, setPermissiveRelayedModeRole)
                await action.connect(owner).setPermissiveRelayedMode(false)
              })

              itRedeemsTheGasCost()
            })
          })

          context('when the smart vault does not have enough funds', () => {
            context('when the permissive relayed mode is on', () => {
              beforeEach('activate permission relayed mode', async () => {
                const setPermissiveRelayedModeRole = action.interface.getSighash('setPermissiveRelayedMode')
                await action.connect(owner).authorize(owner.address, setPermissiveRelayedModeRole)
                await action.connect(owner).setPermissiveRelayedMode(true)
              })

              itDoesNotRedeemAnyCost()
            })

            context('when the permissive relayed mode is off', () => {
              beforeEach('deactivate permission relayed mode', async () => {
                const setPermissiveRelayedModeRole = action.interface.getSighash('setPermissiveRelayedMode')
                await action.connect(owner).authorize(owner.address, setPermissiveRelayedModeRole)
                await action.connect(owner).setPermissiveRelayedMode(false)
              })

              it('reverts', async () => {
                await expect(action.call()).to.be.revertedWith(
                  native
                    ? 'Address: insufficient balance'
                    : token == mimic.wrappedNativeToken
                    ? 'NOT_ENOUGH_BALANCE'
                    : 'ERC20: transfer amount exceeds balance'
                )
              })
            })
          })
        })

        context('with limits', () => {
          const gasPriceLimit = 10e9

          context('when the gas price is under the limit', () => {
            const gasPrice = gasPriceLimit - 1

            context('when the tx consumes less than the cost limit', () => {
              const txCostLimit = MAX_UINT256

              beforeEach('set limits', async () => {
                await action.connect(owner).setLimits(gasPriceLimit, txCostLimit)
              })

              context('when the smart vault has enough funds', () => {
                beforeEach('fund smart vault', async () => {
                  const amount = fp(0.1).mul(rate)

                  if (native) await owner.sendTransaction({ to: smartVault.address, value: amount })
                  else if (token != mimic.wrappedNativeToken) await token.mint(smartVault.address, amount)
                  else {
                    await mimic.wrappedNativeToken.connect(owner).deposit({ value: amount })
                    await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, amount)
                  }
                })

                context('when the permissive relayed mode is on', () => {
                  beforeEach('activate permission relayed mode', async () => {
                    const setPermissiveRelayedModeRole = action.interface.getSighash('setPermissiveRelayedMode')
                    await action.connect(owner).authorize(owner.address, setPermissiveRelayedModeRole)
                    await action.connect(owner).setPermissiveRelayedMode(true)
                  })

                  itRedeemsTheGasCost()
                })

                context('when the permissive relayed mode is off', () => {
                  beforeEach('deactivate permission relayed mode', async () => {
                    const setPermissiveRelayedModeRole = action.interface.getSighash('setPermissiveRelayedMode')
                    await action.connect(owner).authorize(owner.address, setPermissiveRelayedModeRole)
                    await action.connect(owner).setPermissiveRelayedMode(false)
                  })

                  itRedeemsTheGasCost()
                })
              })

              context('when the smart vault does not have enough funds', () => {
                context('when the permissive relayed mode is on', () => {
                  beforeEach('activate permission relayed mode', async () => {
                    const setPermissiveRelayedModeRole = action.interface.getSighash('setPermissiveRelayedMode')
                    await action.connect(owner).authorize(owner.address, setPermissiveRelayedModeRole)
                    await action.connect(owner).setPermissiveRelayedMode(true)
                  })

                  itDoesNotRedeemAnyCost()
                })

                context('when the permissive relayed mode is off', () => {
                  beforeEach('deactivate permission relayed mode', async () => {
                    const setPermissiveRelayedModeRole = action.interface.getSighash('setPermissiveRelayedMode')
                    await action.connect(owner).authorize(owner.address, setPermissiveRelayedModeRole)
                    await action.connect(owner).setPermissiveRelayedMode(false)
                  })

                  it('reverts', async () => {
                    await expect(action.call()).to.be.revertedWith(
                      native
                        ? 'Address: insufficient balance'
                        : token == mimic.wrappedNativeToken
                        ? 'NOT_ENOUGH_BALANCE'
                        : 'ERC20: transfer amount exceeds balance'
                    )
                  })
                })
              })
            })

            context('when the tx consumes more than the cost limit', () => {
              const txCostLimit = 1

              beforeEach('set limits', async () => {
                await action.connect(owner).setLimits(gasPriceLimit, txCostLimit)
              })

              it('reverts', async () => {
                await expect(action.call({ gasPrice })).to.be.revertedWith('TX_COST_ABOVE_LIMIT')
              })
            })
          })

          context('when the gas price is passes the limit', () => {
            const gasPrice = gasPriceLimit + 1

            context('when the tx consumes less than the cost limit', () => {
              const txCostLimit = MAX_UINT256

              beforeEach('set limits', async () => {
                await action.connect(owner).setLimits(gasPriceLimit, txCostLimit)
              })

              it('reverts', async () => {
                await expect(action.call({ gasPrice })).to.be.revertedWith('GAS_PRICE_ABOVE_LIMIT')
              })
            })

            context('when the tx consumes more than the cost limit', () => {
              const txCostLimit = 0

              beforeEach('set limits', async () => {
                await action.connect(owner).setLimits(gasPriceLimit, txCostLimit)
              })

              it('reverts', async () => {
                await expect(action.call({ gasPrice })).to.be.revertedWith('GAS_PRICE_ABOVE_LIMIT')
              })
            })
          })
        })
      }

      context('when paying with the native token', () => {
        const error = 1e13
        const native = true

        itRedeemsGasCostProperly(error, native)
      })

      context('when paying with the wrapped native token', () => {
        const error = 1e14
        const native = false
        const rate = 1

        beforeEach('set token', async () => {
          token = mimic.wrappedNativeToken
        })

        itRedeemsGasCostProperly(error, native, rate)
      })

      context('when paying with another ERC20', () => {
        beforeEach('set token', async () => {
          token = await createTokenMock()
        })

        context('when there is a price feed set', () => {
          const error = 1e14
          const native = false
          const rate = 2

          beforeEach('mock price feed', async () => {
            const feed = await createPriceFeedMock(fp(rate))
            const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
            await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
            await smartVault.connect(owner).setPriceFeed(mimic.wrappedNativeToken.address, token.address, feed.address)
          })

          itRedeemsGasCostProperly(error, native, rate)
        })

        context('when there is no price feed set', () => {
          beforeEach('set token', async () => {
            await action.setToken(token.address)
          })

          it('reverts', async () => {
            await expect(action.call()).to.be.revertedWith('MISSING_PRICE_FEED')
          })
        })
      })
    })

    context('when the sender is not a relayer', () => {
      itDoesNotRedeemAnyCost()
    })
  })
})
