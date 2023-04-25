import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  fp,
  getSigners,
  MAX_UINT256,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  buildExtraFeedData,
  createAction,
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

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('Claimer', mimic, owner, smartVault)
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
            'CLAIMER_WITHDRAWER_ADDRESS_ZERO'
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

  describe('setPayingGasToken', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setPayingGasTokenRole = action.interface.getSighash('setPayingGasToken')
        await action.connect(owner).authorize(owner.address, setPayingGasTokenRole)
        action = action.connect(owner)
      })

      context('when the given address is not zero', () => {
        it('sets the swap signer', async () => {
          await action.setPayingGasToken(other.address)

          expect(await action.payingGasToken()).to.be.equal(other.address)
        })

        it('emits an event', async () => {
          const tx = await action.setPayingGasToken(other.address)

          await assertEvent(tx, 'PayingGasTokenSet', { payingGasToken: other })
        })
      })

      context('when the given address is zero', () => {
        it('reverts', async () => {
          await expect(action.setPayingGasToken(ZERO_ADDRESS)).to.be.revertedWith('CLAIMER_PAYING_GAS_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setPayingGasToken(other.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
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
      let sender: SignerWithAddress

      beforeEach('authorize sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        sender = owner
      })

      const itPerformsTheExpectedCall = (relayed: boolean) => {
        context('when the paying gas token is set', () => {
          let payingGasToken: Contract

          beforeEach('set paying gas token', async () => {
            payingGasToken = await createTokenMock()
            const setPayingGasTokenRole = action.interface.getSighash('setPayingGasToken')
            await action.connect(owner).authorize(owner.address, setPayingGasTokenRole)
            await action.connect(owner).setPayingGasToken(payingGasToken.address)
          })

          context('when the token to claim is not the address zero', () => {
            context('when the token to claim is an ERC20', () => {
              let token: Contract

              beforeEach('set token', async () => {
                token = payingGasToken
              })

              context('when there is a threshold set', () => {
                let extraCallData: string

                const tokenRate = 2 // 1 token = 2 wrapped native tokens
                const thresholdAmount = fp(0.1) // in wrapped native tokens
                const thresholdAmountInToken = thresholdAmount.div(tokenRate) // threshold expressed in token

                beforeEach('set threshold', async () => {
                  const setThresholdRole = action.interface.getSighash('setThreshold')
                  await action.connect(owner).authorize(owner.address, setThresholdRole)
                  await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, thresholdAmount)
                })

                const itClaimsCorrectly = () => {
                  const claim = async (): Promise<ContractTransaction> => {
                    const claimTx = await action.populateTransaction.call(token.address)
                    const callData = `${claimTx.data}${(extraCallData || '').replace('0x', '')}`
                    return sender.sendTransaction({ to: action.address, data: callData })
                  }

                  context('when the claimable balance passes the threshold', () => {
                    const protocolFeeWithdrawerBalance = thresholdAmountInToken

                    beforeEach('fund protocol fee withdrawer', async () => {
                      await token.mint(protocolFeeWithdrawer.address, protocolFeeWithdrawerBalance)
                    })

                    it('calls the call primitive', async () => {
                      const tx = await claim()

                      const callData = protocolFeeWithdrawer.interface.encodeFunctionData('withdrawCollectedFees', [
                        [token.address],
                        [protocolFeeWithdrawerBalance],
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
                      const previousProtocolFeeWithdrawerBalance = await token.balanceOf(protocolFeeWithdrawer.address)
                      const previousFeeCollectorBalance = await token.balanceOf(feeCollector.address)

                      await claim()

                      const currentFeeCollectorBalance = await token.balanceOf(feeCollector.address)
                      const refund = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

                      const currentSmartVaultBalance = await token.balanceOf(smartVault.address)
                      const expectedSmartVaultBalance = previousSmartVaultBalance
                        .add(protocolFeeWithdrawerBalance)
                        .sub(refund)
                      expect(currentSmartVaultBalance).to.be.eq(expectedSmartVaultBalance)

                      const currentProtocolFeeWithdrawerBalance = await token.balanceOf(protocolFeeWithdrawer.address)
                      expect(currentProtocolFeeWithdrawerBalance).to.be.eq(
                        previousProtocolFeeWithdrawerBalance.sub(protocolFeeWithdrawerBalance)
                      )
                    })

                    it('emits an Executed event', async () => {
                      const tx = await claim()

                      await assertIndirectEvent(tx, action.interface, 'Executed')
                    })

                    if (relayed) {
                      it('refunds gas', async () => {
                        const previousBalance = await token.balanceOf(feeCollector.address)

                        const tx = await claim()

                        const currentBalance = await token.balanceOf(feeCollector.address)
                        expect(currentBalance).to.be.gt(previousBalance)

                        const redeemedCost = currentBalance.sub(previousBalance).mul(tokenRate)
                        await assertRelayedBaseCost(tx, redeemedCost, 0.05)
                      })
                    } else {
                      it('does not refund gas', async () => {
                        const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                        await claim()

                        const currentBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)
                        expect(currentBalance).to.be.equal(previousBalance)
                      })
                    }
                  })

                  context('when the claimable balance does not pass the threshold', () => {
                    const protocolFeeWithdrawerBalance = thresholdAmountInToken.div(2)

                    beforeEach('fund protocol fee withdrawer', async () => {
                      await token.mint(protocolFeeWithdrawer.address, protocolFeeWithdrawerBalance)
                    })

                    it('reverts', async () => {
                      await expect(claim()).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
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
                    const setOracleSignerRole = action.interface.getSighash('setOracleSigner')
                    await action.connect(owner).authorize(owner.address, setOracleSignerRole)
                    await action.connect(owner).setOracleSigner(owner.address, true)

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

              context('when there is no threshold set', () => {
                it('reverts', async () => {
                  await expect(action.connect(sender).call(token.address)).to.be.reverted
                })
              })
            })

            context('when the token to claim is the native token', () => {
              const token = NATIVE_TOKEN_ADDRESS

              it('reverts', async () => {
                await expect(action.connect(sender).call(token)).to.be.revertedWith('CLAIMER_NATIVE_TOKEN')
              })
            })
          })

          context('when the token to claim is the zero address', () => {
            const token = ZERO_ADDRESS

            it('reverts', async () => {
              await expect(action.connect(sender).call(token)).to.be.revertedWith('CLAIMER_TOKEN_ADDRESS_ZERO')
            })
          })
        })

        context('when the paying gas token is not set', () => {
          const token = ZERO_ADDRESS

          it('reverts', async () => {
            await expect(action.connect(sender).call(token)).to.be.revertedWith('CLAIMER_PAYING_GAS_TOKEN_ZERO')
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(owner).authorize(sender.address, setRelayerRole)
          await action.connect(owner).setRelayer(sender.address, true)
        })

        itPerformsTheExpectedCall(true)
      })

      context('when the sender is not a relayer', () => {
        itPerformsTheExpectedCall(false)
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.call(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
