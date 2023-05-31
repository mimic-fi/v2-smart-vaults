import { assertEvent, assertIndirectEvent, deploy, fp, getSigner, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { createSmartVault, createTokenMock, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'

import { assertRelayedBaseCost } from '../../../src/asserts'
import { buildEmptyActionConfig } from '../../../src/setup'
import { itBehavesLikeBridgerAction } from './BaseBridger.behavior'

describe('HopBridger', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  before('set up mimic', async () => {
    mimic = await setupMimic(true)
  })

  beforeEach('deploy action', async () => {
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('HopBridger', [
      {
        relayer: ZERO_ADDRESS,
        maxFeePct: 0,
        maxSlippage: 0,
        maxDeadline: 1,
        customMaxFeePcts: [],
        customMaxSlippages: [],
        tokenHopEntrypoints: [],
        bridgerConfig: {
          destinationChain: 0,
          customDestinationChains: [],
          actionConfig: buildEmptyActionConfig(owner, smartVault),
        },
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

  describe('setRelayer', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setMaxDeadlineRole = action.interface.getSighash('setMaxDeadline')
        await action.connect(owner).authorize(owner.address, setMaxDeadlineRole)
        action = action.connect(owner)
      })

      context('when the deadline is not zero', () => {
        const deadline = 60 * 60

        it('sets the relayer', async () => {
          await action.setMaxDeadline(deadline)

          expect(await action.getMaxDeadline()).to.be.equal(deadline)
        })

        it('emits an event', async () => {
          const tx = await action.setMaxDeadline(deadline)

          await assertEvent(tx, 'MaxDeadlineSet', { maxDeadline: deadline })
        })
      })

      context('when the deadline is zero', () => {
        const deadline = 0

        it('reverts', async () => {
          await expect(action.setMaxDeadline(deadline)).to.be.revertedWith('ACTION_MAX_DEADLINE_ZERO')
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

  describe('setMaxDeadline', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setMaxDeadlineRole = action.interface.getSighash('setMaxDeadline')
        await action.connect(owner).authorize(owner.address, setMaxDeadlineRole)
        action = action.connect(owner)
      })

      context('when the deadline is not zero', () => {
        const deadline = 60 * 60

        it('sets the max deadline', async () => {
          await action.setMaxDeadline(deadline)

          expect(await action.getMaxDeadline()).to.be.equal(deadline)
        })

        it('emits an event', async () => {
          const tx = await action.setMaxDeadline(deadline)

          await assertEvent(tx, 'MaxDeadlineSet', { maxDeadline: deadline })
        })
      })

      context('when the deadline is zero', () => {
        const deadline = 0

        it('reverts', async () => {
          await expect(action.setMaxDeadline(deadline)).to.be.revertedWith('ACTION_MAX_DEADLINE_ZERO')
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

  describe('setDefaultMaxFeePct', () => {
    const maxFeePct = fp(0.5)

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setDefaultMaxFeePctRole = action.interface.getSighash('setDefaultMaxFeePct')
        await action.connect(owner).authorize(owner.address, setDefaultMaxFeePctRole)
        action = action.connect(owner)
      })

      it('sets the default max fee pct', async function () {
        await action.setDefaultMaxFeePct(maxFeePct)

        expect(await action.getDefaultMaxFeePct()).to.be.equal(maxFeePct)
      })

      it('emits an event', async function () {
        const tx = await action.setDefaultMaxFeePct(maxFeePct)

        await assertEvent(tx, 'DefaultMaxFeePctSet', { maxFeePct })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(action.setDefaultMaxFeePct(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setDefaultMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setDefaultMaxSlippageRole = action.interface.getSighash('setDefaultMaxSlippage')
        await action.connect(owner).authorize(owner.address, setDefaultMaxSlippageRole)
        action = action.connect(owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await action.setDefaultMaxSlippage(slippage)

          expect(await action.getDefaultMaxSlippage()).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await action.setDefaultMaxSlippage(slippage)

          await assertEvent(tx, 'DefaultMaxSlippageSet', { maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(action.setDefaultMaxSlippage(slippage)).to.be.revertedWith('ACTION_SLIPPAGE_ABOVE_ONE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(action.setDefaultMaxSlippage(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setCustomMaxFeePcts', () => {
    const maxFeePct = fp(0.5)
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setCustomMaxFeePctsRole = action.interface.getSighash('setCustomMaxFeePcts')
        await action.connect(owner).authorize(owner.address, setCustomMaxFeePctsRole)
        action = action.connect(owner)
      })

      it('sets the max fee pct', async function () {
        await action.setCustomMaxFeePcts([token.address], [maxFeePct])

        const customMaxFeePct = await action.getCustomMaxFeePct(token.address)
        expect(customMaxFeePct[0]).to.be.true
        expect(customMaxFeePct[1]).to.be.equal(maxFeePct)
      })

      it('emits an event', async function () {
        const tx = await action.setCustomMaxFeePcts([token.address], [maxFeePct])

        await assertEvent(tx, 'CustomMaxFeePctSet', { token, maxFeePct })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(action.setCustomMaxFeePcts([ZERO_ADDRESS], [0])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setCustomMaxSlippages', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setCustomMaxSlippagesRole = action.interface.getSighash('setCustomMaxSlippages')
        await action.connect(owner).authorize(owner.address, setCustomMaxSlippagesRole)
        action = action.connect(owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await action.setCustomMaxSlippages([token.address], [slippage])

          const customMaxSlippage = await action.getCustomMaxSlippage(token.address)
          expect(customMaxSlippage[0]).to.be.equal(true)
          expect(customMaxSlippage[1]).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await action.setCustomMaxSlippages([token.address], [slippage])

          await assertEvent(tx, 'CustomMaxSlippageSet', { token, maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(action.setCustomMaxSlippages([token.address], [slippage])).to.be.revertedWith(
            'ACTION_SLIPPAGE_ABOVE_ONE'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(action.setCustomMaxSlippages([ZERO_ADDRESS], [0])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTokenHopEntrypoints', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenHopEntrypointsRole = action.interface.getSighash('setTokenHopEntrypoints')
        await action.connect(owner).authorize(owner.address, setTokenHopEntrypointsRole)
        action = action.connect(owner)
      })

      context('when the token address is not zero', () => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await createTokenMock()
        })

        context('when setting the Hop entrypoint', () => {
          let entrypoint: SignerWithAddress

          beforeEach('load entrypoint', async () => {
            entrypoint = await getSigner(9)
          })

          const itSetsTheHopEntrypoint = () => {
            it('sets the Hop entrypoint', async () => {
              await action.setTokenHopEntrypoints([token.address], [entrypoint.address])

              const hopEntrypoint = await action.getTokenHopEntrypoint(token.address)
              expect(hopEntrypoint[0]).to.be.equal(true)
              expect(hopEntrypoint[1]).to.be.equal(entrypoint.address)
            })

            it('emits an event', async () => {
              const tx = await action.setTokenHopEntrypoints([token.address], [entrypoint.address])

              await assertEvent(tx, 'TokenHopEntrypointSet', { token, entrypoint })
            })
          }

          context('when the Hop entrypoint was set', () => {
            beforeEach('set Hop entrypoint', async () => {
              await action.setTokenHopEntrypoints([token.address], [entrypoint.address])
            })

            itSetsTheHopEntrypoint()
          })

          context('when the Hop entrypoint was not set', () => {
            beforeEach('unset Hop entrypoint', async () => {
              await action.setTokenHopEntrypoints([token.address], [ZERO_ADDRESS])
            })

            itSetsTheHopEntrypoint()
          })
        })

        context('when unsetting the Hop entrypoint', () => {
          const entrypoint = ZERO_ADDRESS

          const itUnsetsTheHopEntrypoint = () => {
            it('unsets the Hop entrypoint', async () => {
              await action.setTokenHopEntrypoints([token.address], [entrypoint])

              const hopEntrypoint = await action.getTokenHopEntrypoint(token.address)
              expect(hopEntrypoint[0]).to.be.equal(false)
              expect(hopEntrypoint[1]).to.be.equal(entrypoint)
            })

            it('emits an event', async () => {
              const tx = await action.setTokenHopEntrypoints([token.address], [entrypoint])

              await assertEvent(tx, 'TokenHopEntrypointSet', { token, entrypoint })
            })
          }

          context('when the Hop entrypoint was set', () => {
            beforeEach('set Hop entrypoint', async () => {
              await action.setTokenHopEntrypoints([token.address], [token.address])
            })

            itUnsetsTheHopEntrypoint()
          })

          context('when the token was not set', () => {
            beforeEach('unset Hop entrypoint', async () => {
              await action.setTokenHopEntrypoints([token.address], [entrypoint])
            })

            itUnsetsTheHopEntrypoint()
          })
        })
      })

      context('when the token address is zero', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setTokenHopEntrypoints([token], [ZERO_ADDRESS])).to.be.revertedWith(
            'ACTION_HOP_TOKEN_ZERO'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenHopEntrypoints([ZERO_ADDRESS], [ZERO_ADDRESS])).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('call', () => {
    const SOURCE = 0

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

              context('when the given token has a Hop entrypoint set', () => {
                let entrypoint: SignerWithAddress

                beforeEach('load entrypoint', async () => {
                  entrypoint = await getSigner()
                })

                beforeEach('set Hop entrypoint', async () => {
                  const setTokenHopEntrypointsRole = action.interface.getSighash('setTokenHopEntrypoints')
                  await action.connect(owner).authorize(owner.address, setTokenHopEntrypointsRole)
                  await action.connect(owner).setTokenHopEntrypoints([token.address], [entrypoint.address])
                })

                context('when the slippage is below the max slippage', () => {
                  const slippage = fp(0.01)

                  beforeEach('set max slippage', async () => {
                    const setDefaultMaxSlippageRole = action.interface.getSighash('setDefaultMaxSlippage')
                    await action.connect(owner).authorize(owner.address, setDefaultMaxSlippageRole)
                    await action.connect(owner).setDefaultMaxSlippage(slippage)
                  })

                  context('when the fee is below the max percentage', () => {
                    const feePct = fp(0.002)
                    const fee = amount.mul(feePct).div(fp(1))

                    beforeEach('set max fee pct', async () => {
                      const setDefaultMaxFeePctRole = action.interface.getSighash('setDefaultMaxFeePct')
                      await action.connect(owner).authorize(owner.address, setDefaultMaxFeePctRole)
                      await action.connect(owner).setDefaultMaxFeePct(feePct)
                    })

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
                        const tx = await action.call(token.address, amount, slippage, fee)

                        const data = defaultAbiCoder.encode(['address', 'uint256'], [entrypoint.address, fee])

                        await assertIndirectEvent(tx, smartVault.interface, 'Bridge', {
                          source: SOURCE,
                          chainId,
                          token,
                          amountIn: amount,
                          minAmountOut: amount.sub(amount.mul(slippage).div(fp(1))),
                          data,
                        })
                      })

                      it('emits an Executed event', async () => {
                        const tx = await action.call(token.address, amount, slippage, fee)

                        await assertEvent(tx, 'Executed')
                      })

                      it(`${relayed ? 'refunds' : 'does not refund'} gas`, async () => {
                        const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                        const tx = await action.call(token.address, amount, slippage, fee)

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
                        await expect(action.call(token.address, amount, slippage, fee)).to.be.revertedWith(
                          'ACTION_TOKEN_THRESHOLD_NOT_MET'
                        )
                      })
                    })
                  })

                  context('when the fee is above the max percentage', () => {
                    const fee = 1

                    it('reverts', async () => {
                      await expect(action.call(token.address, amount, slippage, fee)).to.be.revertedWith(
                        'ACTION_FEE_TOO_HIGH'
                      )
                    })
                  })
                })

                context('when the slippage is above the max slippage', () => {
                  const slippage = 1

                  it('reverts', async () => {
                    await expect(action.call(token.address, amount, slippage, 0)).to.be.revertedWith(
                      'ACTION_SLIPPAGE_TOO_HIGH'
                    )
                  })
                })
              })

              context('when the given token has no Hop entrypoint set', () => {
                it('reverts', async () => {
                  await expect(action.call(token.address, amount, 0, 0)).to.be.revertedWith(
                    'ACTION_MISSING_HOP_ENTRYPOINT'
                  )
                })
              })
            })

            context('when the destination chain was not set', () => {
              it('reverts', async () => {
                await expect(action.call(token.address, amount, 0, 0)).to.be.revertedWith(
                  'ACTION_DESTINATION_CHAIN_NOT_SET'
                )
              })
            })
          })

          context('when the amount is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(action.call(token.address, amount, 0, 0)).to.be.revertedWith('ACTION_AMOUNT_ZERO')
            })
          })
        })

        context('when the token is the address zero', () => {
          const token = ZERO_ADDRESS

          it('reverts', async () => {
            await expect(action.call(token, 0, 0, 0)).to.be.revertedWith('ACTION_TOKEN_ZERO')
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

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS, 0, 0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
