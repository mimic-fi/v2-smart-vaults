import { assertEvent, assertIndirectEvent, deploy, fp, getSigners, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import {
  assertRelayedBaseCost,
  createAction,
  createPriceFeedMock,
  createSmartVault,
  createTokenMock,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

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

      it('sets the swap signer', async () => {
        await action.setProtocolFeeWithdrawer(other.address)

        expect(await action.protocolFeeWithdrawer()).to.be.equal(other.address)
      })

      it('emits an event', async () => {
        const tx = await action.setProtocolFeeWithdrawer(other.address)

        await assertEvent(tx, 'ProtocolFeeWithdrawerSet', { protocolFeeWithdrawer: other })
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
      beforeEach('authorize sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      const itPerformsTheExpectedCall = (relayed: boolean) => {
        let token: Contract

        beforeEach('deploy token', async () => {
          token = await createTokenMock()
        })

        context('when there is a threshold set', () => {
          const tokenRate = 2 // 1 token = 2 wrapped native tokens
          const thresholdAmount = fp(0.1) // in wrapped native tokens
          const thresholdAmountInToken = thresholdAmount.div(tokenRate) // threshold expressed in token

          beforeEach('set threshold', async () => {
            const setThresholdRole = action.interface.getSighash('setThreshold')
            await action.connect(owner).authorize(owner.address, setThresholdRole)
            await action.connect(owner).setThreshold(mimic.wrappedNativeToken.address, thresholdAmount)

            const feed = await createPriceFeedMock(fp(tokenRate))
            const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
            await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
            await smartVault.connect(owner).setPriceFeed(token.address, mimic.wrappedNativeToken.address, feed.address)
          })

          context('when the claimable balance passes the threshold', () => {
            const protocolFeeWithdrawerBalance = thresholdAmountInToken

            beforeEach('fund protocol fee withdrawer', async () => {
              await token.mint(protocolFeeWithdrawer.address, protocolFeeWithdrawerBalance)
            })

            it('calls the call primitive', async () => {
              const tx = await action.call(token.address)

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

              await action.call(token.address)

              const currentFeeCollectorBalance = await token.balanceOf(feeCollector.address)
              const refund = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)

              const currentSmartVaultBalance = await token.balanceOf(smartVault.address)
              const expectedSmartVaultBalance = previousSmartVaultBalance.add(protocolFeeWithdrawerBalance).sub(refund)
              expect(currentSmartVaultBalance).to.be.eq(expectedSmartVaultBalance)

              const currentProtocolFeeWithdrawerBalance = await token.balanceOf(protocolFeeWithdrawer.address)
              expect(currentProtocolFeeWithdrawerBalance).to.be.eq(
                previousProtocolFeeWithdrawerBalance.sub(protocolFeeWithdrawerBalance)
              )
            })

            it('emits an Executed event', async () => {
              const tx = await action.call(token.address)

              await assertEvent(tx, 'Executed')
            })

            if (relayed) {
              it('refunds gas', async () => {
                const previousBalance = await token.balanceOf(feeCollector.address)

                const tx = await action.call(token.address)

                const currentBalance = await token.balanceOf(feeCollector.address)
                expect(currentBalance).to.be.gt(previousBalance)

                const redeemedCost = currentBalance.sub(previousBalance).mul(tokenRate)
                await assertRelayedBaseCost(tx, redeemedCost, 0.05)
              })
            } else {
              it('does not refund gas', async () => {
                const previousBalance = await mimic.wrappedNativeToken.balanceOf(feeCollector.address)

                await action.call(token.address)

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
              await expect(action.call(token.address)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
            })
          })
        })

        context('when there is no threshold set', () => {
          it('reverts', async () => {
            await expect(action.call(token.address)).to.be.reverted
          })
        })
      }

      context('when the sender is a relayer', () => {
        beforeEach('mark sender as relayer', async () => {
          const setRelayerRole = action.interface.getSighash('setRelayer')
          await action.connect(owner).authorize(owner.address, setRelayerRole)
          await action.connect(owner).setRelayer(owner.address, true)
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
