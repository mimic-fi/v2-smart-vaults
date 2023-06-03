import { assertEvent, assertIndirectEvent, deploy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { createSmartVault, createTokenMock, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { assertRelayedBaseCost } from '../../../src/asserts'
import { buildEmptyActionConfig } from '../../../src/setup'
import { itBehavesLikeBridgerAction } from './BaseBridger.behavior'

describe('AxelarBridger', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, feeCollector] = await getSigners()
  })

  before('set up mimic', async () => {
    mimic = await setupMimic(true)
  })

  beforeEach('deploy action', async () => {
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('AxelarBridger', [
      {
        destinationChain: 0,
        customDestinationChains: [],
        actionConfig: buildEmptyActionConfig(owner, smartVault),
      },
    ])
  })

  describe('base', () => {
    beforeEach('set action', async function () {
      this.action = action
      this.owner = owner
    })

    itBehavesLikeBridgerAction()
  })

  describe('call', () => {
    const SOURCE = 1

    beforeEach('authorize action', async () => {
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

      const itPerformsTheExpectedCall = (relayed: boolean) => {
        context('when the token is not the address zero', () => {
          let token: Contract

          beforeEach('deploy token', async () => {
            token = await createTokenMock()
          })

          context('when the amount is not zero', () => {
            const amount = fp(10)

            context('when the destination chain was set', () => {
              const chainId = 1

              beforeEach('set destination chain ID', async () => {
                const setDefaultDestinationChainRole = action.interface.getSighash('setDefaultDestinationChain')
                await action.connect(owner).authorize(owner.address, setDefaultDestinationChainRole)
                await action.connect(owner).setDefaultDestinationChain(chainId)
              })

              context('when the given token is allowed', () => {
                context('when the current balance passes the threshold', () => {
                  const threshold = amount

                  beforeEach('set threshold', async () => {
                    const setDefaultTokenThresholdRole = action.interface.getSighash('setDefaultTokenThreshold')
                    await action.connect(owner).authorize(owner.address, setDefaultTokenThresholdRole)
                    await action
                      .connect(owner)
                      .setDefaultTokenThreshold({ token: token.address, min: threshold, max: 0 })
                  })

                  beforeEach('fund smart vault', async () => {
                    await token.mint(smartVault.address, amount)
                  })

                  it('calls the bridge primitive', async () => {
                    const tx = await action.call(token.address, amount)

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
                    const tx = await action.call(token.address, amount)

                    await assertEvent(tx, 'Executed')
                  })

                  it(`${relayed ? 'refunds' : 'does not refund'} gas`, async () => {
                    const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                    const tx = await action.call(token.address, amount)

                    const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                    expect(currentBalance).to.be[relayed ? 'gt' : 'eq'](previousBalance)

                    if (relayed) {
                      const redeemedCost = currentBalance.sub(previousBalance)
                      await assertRelayedBaseCost(tx, redeemedCost, 0.1)
                    }
                  })
                })

                context('when the current balance does not pass the threshold', () => {
                  const threshold = amount.add(1)

                  beforeEach('set threshold', async () => {
                    const setDefaultTokenThresholdRole = action.interface.getSighash('setDefaultTokenThreshold')
                    await action.connect(owner).authorize(owner.address, setDefaultTokenThresholdRole)
                    await action
                      .connect(owner)
                      .setDefaultTokenThreshold({ token: token.address, min: threshold, max: 0 })
                  })

                  it('reverts', async () => {
                    await expect(action.call(token.address, amount)).to.be.revertedWith(
                      'ACTION_TOKEN_THRESHOLD_NOT_MET'
                    )
                  })
                })
              })

              context('when the given token is not allowed', () => {
                beforeEach('deny token', async () => {
                  const setTokensAcceptanceListRole = action.interface.getSighash('setTokensAcceptanceList')
                  await action.connect(owner).authorize(owner.address, setTokensAcceptanceListRole)
                  await action.connect(owner).setTokensAcceptanceList([token.address], [])
                })

                it('reverts', async () => {
                  await expect(action.call(token.address, amount)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
                })
              })
            })

            context('when the destination chain was not set', () => {
              it('reverts', async () => {
                await expect(action.call(token.address, amount)).to.be.revertedWith('ACTION_DESTINATION_CHAIN_NOT_SET')
              })
            })
          })

          context('when the amount is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(action.call(token.address, amount)).to.be.revertedWith('ACTION_AMOUNT_ZERO')
            })
          })
        })

        context('when the token is the address zero', () => {
          const token = ZERO_ADDRESS

          it('reverts', async () => {
            await expect(action.call(token, 0)).to.be.revertedWith('ACTION_TOKEN_ZERO')
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayersRole = action.interface.getSighash('setRelayers')
          await action.connect(owner).authorize(owner.address, setRelayersRole)
          await action.connect(owner).setRelayers([owner.address], [])
        })

        beforeEach('set relay gas token', async () => {
          const setRelayGasTokenRole = action.interface.getSighash('setRelayGasToken')
          await action.connect(owner).authorize(owner.address, setRelayGasTokenRole)
          await action.connect(owner).setRelayGasToken(mimic.wrappedNativeToken.address)
        })

        beforeEach('fund smart vault with wrapped native token to pay gas', async () => {
          await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(0.001) })
          await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, fp(0.001))
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
