import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  fp,
  getSigners,
  MAX_UINT256,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  buildEmptyActionConfig,
  buildExtraFeedData,
  createPriceFeedMock,
  createSmartVault,
  createTokenMock,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract, ContractTransaction } from 'ethers'

describe('Claimer', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  before('setup mimic', async () => {
    mimic = await setupMimic(true)
  })

  beforeEach('deploy action', async () => {
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('Claimer', [
      {
        protocolFeeWithdrawer: ZERO_ADDRESS,
        actionConfig: buildEmptyActionConfig(owner, smartVault),
      },
    ])
  })

  describe('setProtocolFeeWithdrawer', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setProtocolFeeWithdrawerRole = action.interface.getSighash('setProtocolFeeWithdrawer')
        await action.connect(owner).authorize(owner.address, setProtocolFeeWithdrawerRole)
        action = action.connect(owner)
      })

      context('when the given address is not zero', () => {
        it('sets the swap signer', async () => {
          await action.setProtocolFeeWithdrawer(other.address)

          expect(await action.protocolFeeWithdrawer()).to.be.equal(other.address)
        })

        it('emits an event', async () => {
          const tx = await action.setProtocolFeeWithdrawer(other.address)

          await assertEvent(tx, 'ProtocolFeeWithdrawerSet', { protocolFeeWithdrawer: other })
        })
      })

      context('when the given address is zero', () => {
        it('reverts', async () => {
          await expect(action.setProtocolFeeWithdrawer(ZERO_ADDRESS)).to.be.revertedWith(
            'ACTION_PROTOCOL_WITHDRAWER_ZERO'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setProtocolFeeWithdrawer(other.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    let protocolFeeWithdrawer: Contract

    beforeEach('authorize action', async () => {
      const callRole = smartVault.interface.getSighash('call')
      await smartVault.connect(owner).authorize(action.address, callRole)
      const withdrawRole = smartVault.interface.getSighash('withdraw')
      await smartVault.connect(owner).authorize(action.address, withdrawRole)
    })

    beforeEach('set fee collector', async () => {
      const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
      await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
      await smartVault.connect(owner).setFeeCollector(feeCollector.address)
    })

    beforeEach('set protocol fee withdrawer', async () => {
      protocolFeeWithdrawer = await deploy('ProtocolFeeWithdrawerMock')
      const setProtocolFeeWithdrawerRole = action.interface.getSighash('setProtocolFeeWithdrawer')
      await action.connect(owner).authorize(owner.address, setProtocolFeeWithdrawerRole)
      await action.connect(owner).setProtocolFeeWithdrawer(protocolFeeWithdrawer.address)
    })

    context('when the sender is authorized', () => {
      let extraCallData: string
      let sender: SignerWithAddress

      beforeEach('authorize sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        sender = owner
      })

      const itPerformsTheExpectedCall = (relayed: boolean) => {
        context('when the token to claim is not the address zero', () => {
          let token: Contract

          beforeEach('deploy token', async () => {
            token = await createTokenMock()
          })

          context('when the amount is greater than zero', () => {
            const amount = fp(100)
            const tokenRate = 2 // 1 token = 2 wrapped native tokens

            beforeEach('fund protocol fee withdrawer', async () => {
              await token.mint(protocolFeeWithdrawer.address, amount.mul(2))
            })

            const itClaimsCorrectly = () => {
              const claim = async (): Promise<ContractTransaction> => {
                const claimTx = await action.populateTransaction.call(token.address, amount)
                const callData = `${claimTx.data}${(extraCallData || '').replace('0x', '')}`
                return sender.sendTransaction({ to: action.address, data: callData })
              }

              context('when the claimable balance passes the threshold', () => {
                const threshold = amount.mul(tokenRate)

                beforeEach('set threshold', async () => {
                  const setDefaultTokenThresholdRole = action.interface.getSighash('setDefaultTokenThreshold')
                  await action.connect(owner).authorize(owner.address, setDefaultTokenThresholdRole)
                  await action
                    .connect(owner)
                    .setDefaultTokenThreshold({ token: mimic.wrappedNativeToken.address, min: threshold, max: 0 })
                })

                it('calls the call primitive', async () => {
                  const tx = await claim()

                  const callData = protocolFeeWithdrawer.interface.encodeFunctionData('withdrawCollectedFees', [
                    [token.address],
                    [amount],
                    smartVault.address,
                  ])

                  await assertIndirectEvent(tx, smartVault.interface, 'Call', {
                    target: protocolFeeWithdrawer,
                    callData,
                    value: 0,
                    data: '0x',
                  })
                })

                it('transfers the token in from the protocol fee withdrawer to the smart vault', async () => {
                  const previousSmartVaultBalance = await token.balanceOf(smartVault.address)
                  const previousFeeWithdrawerBalance = await token.balanceOf(protocolFeeWithdrawer.address)

                  await claim()

                  const currentSmartVaultBalance = await token.balanceOf(smartVault.address)
                  expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.add(amount))

                  const currentFeeWithdrawerBalance = await token.balanceOf(protocolFeeWithdrawer.address)
                  expect(currentFeeWithdrawerBalance).to.be.eq(previousFeeWithdrawerBalance.sub(amount))
                })

                it('emits an Executed event', async () => {
                  const tx = await claim()

                  await assertIndirectEvent(tx, action.interface, 'Executed')
                })

                it(`${relayed ? 'refunds' : 'does not refund'} gas`, async () => {
                  const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                  const tx = await claim()

                  const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                  expect(currentBalance).to.be[relayed ? 'gt' : 'equal'](previousBalance)

                  if (relayed) {
                    const redeemedCost = currentBalance.sub(previousBalance)
                    await assertRelayedBaseCost(tx, redeemedCost, 0.1)
                  }
                })
              })

              context('when the claimable balance does not pass the threshold', () => {
                const threshold = amount.mul(tokenRate).add(1)

                beforeEach('set threshold', async () => {
                  const setDefaultTokenThresholdRole = action.interface.getSighash('setDefaultTokenThreshold')
                  await action.connect(owner).authorize(owner.address, setDefaultTokenThresholdRole)
                  await action
                    .connect(owner)
                    .setDefaultTokenThreshold({ token: mimic.wrappedNativeToken.address, min: threshold, max: 0 })
                })

                it('reverts', async () => {
                  await expect(claim()).to.be.revertedWith('ACTION_TOKEN_THRESHOLD_NOT_MET')
                })
              })
            }

            context('using an on-chain oracle', () => {
              beforeEach('set on-chain oracle', async () => {
                const feed = await createPriceFeedMock(fp(tokenRate))
                const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                await smartVault
                  .connect(owner)
                  .setPriceFeed(token.address, mimic.wrappedNativeToken.address, feed.address)
              })

              itClaimsCorrectly()
            })

            context('using an off-chain oracle', () => {
              beforeEach('sign off-chain oracle', async () => {
                const setOracleSignersRole = action.interface.getSighash('setOracleSigners')
                await action.connect(owner).authorize(owner.address, setOracleSignersRole)
                await action.connect(owner).setOracleSigners([owner.address], [])

                const feeds = [
                  {
                    base: token.address,
                    quote: mimic.wrappedNativeToken.address,
                    rate: fp(tokenRate),
                    deadline: MAX_UINT256,
                  },
                  {
                    base: mimic.wrappedNativeToken.address,
                    quote: token.address,
                    rate: fp(1).mul(fp(1)).div(fp(tokenRate)),
                    deadline: MAX_UINT256,
                  },
                ]

                extraCallData = await buildExtraFeedData(action, feeds, owner)
              })

              itClaimsCorrectly()
            })
          })

          context('when the amount is zero', () => {
            const amount = 0

            it('reverts', async () => {
              await expect(action.connect(sender).call(token.address, amount)).to.be.revertedWith('ACTION_AMOUNT_ZERO')
            })
          })
        })

        context('when the token to claim is the zero address', () => {
          const token = ZERO_ADDRESS

          it('reverts', async () => {
            await expect(action.connect(sender).call(token, 0)).to.be.revertedWith('ACTION_TOKEN_ZERO')
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
