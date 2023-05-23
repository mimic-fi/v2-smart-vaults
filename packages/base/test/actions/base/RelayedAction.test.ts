import {
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
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

import { createPriceFeedMock, createSmartVault, createTokenMock, Mimic, setupMimic } from '../../../dist'

describe('RelayedAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('setup dependencies', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
    mimic = await setupMimic(true)
  })

  beforeEach('deploy action', async () => {
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('RelayedActionMock', [
      {
        baseConfig: {
          owner: owner.address,
          smartVault: smartVault.address,
        },
        relayConfig: {
          gasPriceLimit: 0,
          priorityFeeLimit: 0,
          txCostLimit: 0,
          gasToken: ZERO_ADDRESS,
          permissiveMode: false,
          relayers: [],
        },
      },
    ])
  })

  describe('setRelayPermissiveMode', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setRelayPermissiveModeRole = action.interface.getSighash('setRelayPermissiveMode')
        await action.connect(owner).authorize(owner.address, setRelayPermissiveModeRole)
        action = action.connect(owner)
      })

      context('when the permissive relayed mode was inactive', async () => {
        it('can be activated', async () => {
          const tx = await action.setRelayPermissiveMode(true)

          expect(await action.isRelayPermissiveModeActive()).to.be.true
          await assertEvent(tx, 'RelayPermissiveModeSet', { active: true })
        })

        it('can be deactivated', async () => {
          const tx = await action.setRelayPermissiveMode(false)

          expect(await action.isRelayPermissiveModeActive()).to.be.false
          await assertEvent(tx, 'RelayPermissiveModeSet', { active: false })
        })
      })

      context('when the permissive relayed mode was active', async () => {
        beforeEach('activate permissive relayed mode', async () => {
          await action.setRelayPermissiveMode(true)
        })

        it('can be activated', async () => {
          const tx = await action.setRelayPermissiveMode(true)

          expect(await action.isRelayPermissiveModeActive()).to.be.true
          await assertEvent(tx, 'RelayPermissiveModeSet', { active: true })
        })

        it('can be deactivated', async () => {
          const tx = await action.setRelayPermissiveMode(false)

          expect(await action.isRelayPermissiveModeActive()).to.be.false
          await assertEvent(tx, 'RelayPermissiveModeSet', { active: false })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setRelayPermissiveMode(true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setRelayGasToken', () => {
    let token: Contract

    beforeEach('deploy token', async () => {
      token = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setRelayGasTokenRole = action.interface.getSighash('setRelayGasToken')
        await action.connect(owner).authorize(owner.address, setRelayGasTokenRole)
        action = action.connect(owner)
      })

      context('when setting the relay gas token', () => {
        const itCanSetTheRelayGasTokenProperly = () => {
          it('sets the relay gas token', async () => {
            await action.setRelayGasToken(token.address)

            expect(await action.getRelayGasToken()).to.be.equal(token.address)
          })

          it('emits an event', async () => {
            const tx = await action.setRelayGasToken(token.address)

            await assertEvent(tx, 'RelayGasTokenSet', { token: token })
          })
        }

        context('when the relay gas token was set', () => {
          beforeEach('set the relay gas token', async () => {
            await action.setRelayGasToken(token.address)
          })

          itCanSetTheRelayGasTokenProperly()
        })

        context('when the relay gas token was not set', () => {
          beforeEach('unset the relay gas token', async () => {
            await action.setRelayGasToken(ZERO_ADDRESS)
          })

          itCanSetTheRelayGasTokenProperly()
        })
      })

      context('when unsetting the relay gas token', () => {
        const itCanUnsetTheGasTokenProperly = () => {
          it('unsets the relay gas token', async () => {
            await action.setRelayGasToken(ZERO_ADDRESS)

            expect(await action.getRelayGasToken()).to.be.equal(ZERO_ADDRESS)
          })

          it('emits an event', async () => {
            const tx = await action.setRelayGasToken(ZERO_ADDRESS)

            await assertEvent(tx, 'RelayGasTokenSet', { token: ZERO_ADDRESS })
          })
        }

        context('when the relay gas token was set', () => {
          beforeEach('set the relay gas token', async () => {
            await action.setRelayGasToken(token.address)
          })

          itCanUnsetTheGasTokenProperly()
        })

        context('when the relay gas token was not allowed', () => {
          beforeEach('unset the relay gas token', async () => {
            await action.setRelayGasToken(ZERO_ADDRESS)
          })

          itCanUnsetTheGasTokenProperly()
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setRelayGasToken(token.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setRelayGasLimits', () => {
    context('when the sender is authorized', async () => {
      beforeEach('authorize sender', async () => {
        const setRelayGasLimitsRole = action.interface.getSighash('setRelayGasLimits')
        await action.connect(owner).authorize(owner.address, setRelayGasLimitsRole)
        action = action.connect(owner)
      })

      context('when the limits are not zero', async () => {
        const gasPriceLimit = 100e9
        const priorityFeeLimit = 1e9

        it('sets the limits', async () => {
          await action.setRelayGasLimits(gasPriceLimit, priorityFeeLimit)

          const limits = await action.getRelayGasLimits()
          expect(limits.gasPriceLimit).to.be.equal(gasPriceLimit)
          expect(limits.priorityFeeLimit).to.be.equal(priorityFeeLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setRelayGasLimits(gasPriceLimit, priorityFeeLimit)
          await assertEvent(tx, 'RelayGasLimitsSet', { gasPriceLimit, priorityFeeLimit })
        })
      })

      context('when the limits are zero', async () => {
        const gasPriceLimit = 0
        const priorityFeeLimit = 0

        it('sets the limits', async () => {
          await action.setRelayGasLimits(gasPriceLimit, priorityFeeLimit)

          const limits = await action.getRelayGasLimits()
          expect(limits.gasPriceLimit).to.be.equal(gasPriceLimit)
          expect(limits.priorityFeeLimit).to.be.equal(priorityFeeLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setRelayGasLimits(gasPriceLimit, priorityFeeLimit)
          await assertEvent(tx, 'RelayGasLimitsSet', { gasPriceLimit, priorityFeeLimit })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setRelayGasLimits(0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setRelayTxCostLimit', () => {
    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setRelayTxCostLimitRole = action.interface.getSighash('setRelayTxCostLimit')
        await action.connect(owner).authorize(owner.address, setRelayTxCostLimitRole)
        action = action.connect(owner)
      })

      context('when the limit is not zero', () => {
        const txCostLimit = 100e9

        it('sets the tx cost limit', async () => {
          await action.setRelayTxCostLimit(txCostLimit)
          expect(await action.getRelayTxCostLimit()).to.be.equal(txCostLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setRelayTxCostLimit(txCostLimit)
          await assertEvent(tx, 'RelayTxCostLimitSet', { txCostLimit })
        })
      })

      context('when the limit is zero', () => {
        const txCostLimit = 0

        it('sets the tx cost limit', async () => {
          await action.setRelayTxCostLimit(txCostLimit)
          expect(await action.getRelayTxCostLimit()).to.be.equal(txCostLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setRelayTxCostLimit(txCostLimit)
          await assertEvent(tx, 'RelayTxCostLimitSet', { txCostLimit })
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(action.setRelayTxCostLimit(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setRelayers', () => {
    let newRelayer: SignerWithAddress

    beforeEach('set new relayer', async () => {
      newRelayer = other
    })

    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setRelayersRole = action.interface.getSighash('setRelayers')
        await action.connect(owner).authorize(owner.address, setRelayersRole)
        action = action.connect(owner)
      })

      context('when the relayer was not allowed', async () => {
        it('can be allowed', async () => {
          const tx = await action.setRelayers([newRelayer.address], [])

          expect(await action.isRelayer(newRelayer.address)).to.be.true
          await assertEvent(tx, 'RelayerAllowed', { relayer: newRelayer })
        })

        it('can be disallowed', async () => {
          const tx = await action.setRelayers([], [newRelayer.address])

          expect(await action.isRelayer(newRelayer.address)).to.be.false
          await assertNoEvent(tx, 'RelayerDisallowed')
        })
      })

      context('when the relayer was allowed', async () => {
        beforeEach('allow relayer', async () => {
          await action.setRelayers([newRelayer.address], [])
        })

        it('can be allowed', async () => {
          const tx = await action.setRelayers([newRelayer.address], [])

          expect(await action.isRelayer(newRelayer.address)).to.be.true
          await assertNoEvent(tx, 'RelayerAllowed')
        })

        it('can be disallowed', async () => {
          const tx = await action.setRelayers([], [newRelayer.address])

          expect(await action.isRelayer(newRelayer.address)).to.be.false
          await assertEvent(tx, 'RelayerDisallowed', { relayer: newRelayer })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setRelayers([], [])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    const REDEEM_GAS_NOTE = `0x${Buffer.from('RELAYER', 'utf-8').toString('hex')}`

    beforeEach('authorize action', async () => {
      const withdrawRole = smartVault.interface.getSighash('withdraw')
      await smartVault.connect(owner).authorize(action.address, withdrawRole)
    })

    beforeEach('set fee collector', async () => {
      const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
      await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
      await smartVault.connect(owner).setFeeCollector(feeCollector.address)
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
        const setRelayerRole = action.interface.getSighash('setRelayers')
        await action.connect(owner).authorize(owner.address, setRelayerRole)
        await action.connect(owner).setRelayers([other.address], [])
        action = action.connect(other)
      })

      const itRedeemsGasCostProperly = (error: number, native = false, rate = 1) => {
        beforeEach('set relay gas token', async () => {
          const setRelayGasTokenRole = action.interface.getSighash('setRelayGasToken')
          await action.connect(owner).authorize(owner.address, setRelayGasTokenRole)
          await action.connect(owner).setRelayGasToken(native ? NATIVE_TOKEN_ADDRESS : token.address)
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
                const setRelayPermissiveModeRole = action.interface.getSighash('setRelayPermissiveMode')
                await action.connect(owner).authorize(owner.address, setRelayPermissiveModeRole)
                await action.connect(owner).setRelayPermissiveMode(true)
              })

              itRedeemsTheGasCost()
            })

            context('when the permissive relayed mode is off', () => {
              beforeEach('deactivate permission relayed mode', async () => {
                const setRelayPermissiveModeRole = action.interface.getSighash('setRelayPermissiveMode')
                await action.connect(owner).authorize(owner.address, setRelayPermissiveModeRole)
                await action.connect(owner).setRelayPermissiveMode(false)
              })

              itRedeemsTheGasCost()
            })
          })

          context('when the smart vault does not have enough funds', () => {
            context('when the permissive relayed mode is on', () => {
              beforeEach('activate permission relayed mode', async () => {
                const setRelayPermissiveModeRole = action.interface.getSighash('setRelayPermissiveMode')
                await action.connect(owner).authorize(owner.address, setRelayPermissiveModeRole)
                await action.connect(owner).setRelayPermissiveMode(true)
              })

              itDoesNotRedeemAnyCost()
            })

            context('when the permissive relayed mode is off', () => {
              beforeEach('deactivate permission relayed mode', async () => {
                const setRelayPermissiveModeRole = action.interface.getSighash('setRelayPermissiveMode')
                await action.connect(owner).authorize(owner.address, setRelayPermissiveModeRole)
                await action.connect(owner).setRelayPermissiveMode(false)
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

          beforeEach('set gas price limit', async () => {
            const setRelayGasLimitsRole = action.interface.getSighash('setRelayGasLimits')
            await action.connect(owner).authorize(owner.address, setRelayGasLimitsRole)
            await action.connect(owner).setRelayGasLimits(gasPriceLimit, 0)
          })

          context('when the gas price is under the limit', () => {
            const gasPrice = gasPriceLimit - 1

            context('when the tx consumes less than the cost limit', () => {
              const txCostLimit = MAX_UINT256

              beforeEach('set tx cost limit', async () => {
                const setRelayTxCostLimitRole = action.interface.getSighash('setRelayTxCostLimit')
                await action.connect(owner).authorize(owner.address, setRelayTxCostLimitRole)
                await action.connect(owner).setRelayTxCostLimit(txCostLimit)
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
                    const setRelayPermissiveModeRole = action.interface.getSighash('setRelayPermissiveMode')
                    await action.connect(owner).authorize(owner.address, setRelayPermissiveModeRole)
                    await action.connect(owner).setRelayPermissiveMode(true)
                  })

                  itRedeemsTheGasCost()
                })

                context('when the permissive relayed mode is off', () => {
                  beforeEach('deactivate permission relayed mode', async () => {
                    const setRelayPermissiveModeRole = action.interface.getSighash('setRelayPermissiveMode')
                    await action.connect(owner).authorize(owner.address, setRelayPermissiveModeRole)
                    await action.connect(owner).setRelayPermissiveMode(false)
                  })

                  itRedeemsTheGasCost()
                })
              })

              context('when the smart vault does not have enough funds', () => {
                context('when the permissive relayed mode is on', () => {
                  beforeEach('activate permission relayed mode', async () => {
                    const setRelayPermissiveModeRole = action.interface.getSighash('setRelayPermissiveMode')
                    await action.connect(owner).authorize(owner.address, setRelayPermissiveModeRole)
                    await action.connect(owner).setRelayPermissiveMode(true)
                  })

                  itDoesNotRedeemAnyCost()
                })

                context('when the permissive relayed mode is off', () => {
                  beforeEach('deactivate permission relayed mode', async () => {
                    const setRelayPermissiveModeRole = action.interface.getSighash('setRelayPermissiveMode')
                    await action.connect(owner).authorize(owner.address, setRelayPermissiveModeRole)
                    await action.connect(owner).setRelayPermissiveMode(false)
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

              beforeEach('set tx cost limit', async () => {
                const setRelayTxCostLimitRole = action.interface.getSighash('setRelayTxCostLimit')
                await action.connect(owner).authorize(owner.address, setRelayTxCostLimitRole)
                await action.connect(owner).setRelayTxCostLimit(txCostLimit)
              })

              it('reverts', async () => {
                await expect(action.call({ gasPrice })).to.be.revertedWith('ACTION_TX_COST_LIMIT_EXCEEDED')
              })
            })
          })

          context('when the gas price is passes the limit', () => {
            const gasPrice = gasPriceLimit + 1

            context('when the tx consumes less than the cost limit', () => {
              const txCostLimit = MAX_UINT256

              beforeEach('set tx cost limit', async () => {
                const setRelayTxCostLimitRole = action.interface.getSighash('setRelayTxCostLimit')
                await action.connect(owner).authorize(owner.address, setRelayTxCostLimitRole)
                await action.connect(owner).setRelayTxCostLimit(txCostLimit)
              })

              it('reverts', async () => {
                await expect(action.call({ gasPrice })).to.be.revertedWith('ACTION_GAS_LIMITS_EXCEEDED')
              })
            })

            context('when the tx consumes more than the cost limit', () => {
              const txCostLimit = 0

              beforeEach('set tx cost limit', async () => {
                const setRelayTxCostLimitRole = action.interface.getSighash('setRelayTxCostLimit')
                await action.connect(owner).authorize(owner.address, setRelayTxCostLimitRole)
                await action.connect(owner).setRelayTxCostLimit(txCostLimit)
              })

              it('reverts', async () => {
                await expect(action.call({ gasPrice })).to.be.revertedWith('ACTION_GAS_LIMITS_EXCEEDED')
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
          beforeEach('set relay gas token', async () => {
            const setRelayGasTokenRole = action.interface.getSighash('setRelayGasToken')
            await action.connect(owner).authorize(owner.address, setRelayGasTokenRole)
            await action.connect(owner).setRelayGasToken(token.address)
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
