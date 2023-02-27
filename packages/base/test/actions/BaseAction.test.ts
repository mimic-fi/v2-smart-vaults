import {
  assertIndirectEvent,
  assertNoIndirectEvent,
  deploy,
  fp,
  getSigners,
  MAX_UINT256,
  NATIVE_TOKEN_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { createSmartVault, createTokenMock, Mimic, setupMimic } from '../../'
import { createPriceFeedMock } from '../../src/samples'

describe('BaseAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('BaseActionMock', [owner.address, smartVault.address])
  })

  describe('transferToSmartVault', () => {
    const balance = fp(1)

    context('when the sender has permissions', async () => {
      beforeEach('authorize sender', async () => {
        const transferToSmartVaultRole = action.interface.getSighash('transferToSmartVault')
        await action.connect(owner).authorize(owner.address, transferToSmartVaultRole)
        action = action.connect(owner)
      })

      context('when the token is ETH', () => {
        const token = NATIVE_TOKEN_ADDRESS

        beforeEach('fund action', async () => {
          await other.sendTransaction({ to: action.address, value: balance })
        })

        it('transfers it to smart vault', async () => {
          const previousActionBalance = await action.getActionBalance(token)
          const previousSmartVaultBalance = await action.getSmartVaultBalance(token)

          await action.transferToSmartVault(token, balance)

          const currentActionBalance = await action.getActionBalance(token)
          expect(currentActionBalance).to.be.equal(previousActionBalance.sub(balance))

          const currentSmartVaultBalance = await action.getSmartVaultBalance(token)
          expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(balance))
        })
      })

      context('when the token is an ERC20', () => {
        let token: Contract

        beforeEach('fund action', async () => {
          token = await createTokenMock()
          await token.mint(action.address, balance)
        })

        it('transfers it to smart vault', async () => {
          const previousActionBalance = await action.getActionBalance(token.address)
          const previousSmartVaultBalance = await action.getSmartVaultBalance(token.address)

          await action.transferToSmartVault(token.address, balance)

          const currentActionBalance = await action.getActionBalance(token.address)
          expect(currentActionBalance).to.be.equal(previousActionBalance.sub(balance))

          const currentSmartVaultBalance = await action.getSmartVaultBalance(token.address)
          expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(balance))
        })
      })
    })

    context('when the sender does not have permissions', async () => {
      beforeEach('set sender', async () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.transferToSmartVault(NATIVE_TOKEN_ADDRESS, balance)).to.be.revertedWith(
          'SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('redeemGas', () => {
    let token: string | Contract

    const REDEEM_GAS_NOTE = `0x${Buffer.from('RELAYER', 'utf-8').toString('hex')}`

    const toAddress = (token: string | Contract): string => (typeof token === 'string' ? token : token.address)

    beforeEach('set fee collector', async () => {
      const setFeeCollectorRole = smartVault.interface.getSighash('setFeeCollector')
      await smartVault.connect(owner).authorize(owner.address, setFeeCollectorRole)
      await smartVault.connect(owner).setFeeCollector(feeCollector.address)
    })

    beforeEach('authorize gas cost withdrawals', async () => {
      const withdrawRole = smartVault.interface.getSighash('withdraw')
      await smartVault.connect(owner).authorize(action.address, withdrawRole)
    })

    const itDoesNotRedeemAnyCost = () => {
      it('does not redeem any cost', async () => {
        const tx = await action.call(toAddress(token))

        await assertNoIndirectEvent(tx, smartVault.interface, 'Withdraw')
      })
    }

    context('when the sender is a relayer', () => {
      beforeEach('authorize relayer', async () => {
        const setRelayerRole = action.interface.getSighash('setRelayers')
        await action.connect(owner).authorize(owner.address, setRelayerRole)
        await action.connect(owner).setRelayers([other.address], [])
        action = action.connect(other)
      })

      const itRedeemsGasCostProperly = (error: number, rate = 1) => {
        const itRedeemsTheGasCost = () => {
          it('redeems the expected cost to the fee collector', async () => {
            const tx = await action.call(toAddress(token))

            const { args } = await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
              token,
              recipient: feeCollector,
              data: REDEEM_GAS_NOTE,
            })

            const { gasUsed, effectiveGasPrice } = await tx.wait()
            const expectedCost = gasUsed.mul(effectiveGasPrice).mul(rate)
            expect(args.withdrawn).to.be.at.least(expectedCost.sub(error))
            expect(args.withdrawn).to.be.at.most(expectedCost.add(error))
          })
        }

        context('without tx cost limit', () => {
          itRedeemsTheGasCost()
        })

        context('with a tx cost limit', () => {
          beforeEach('authorize owner', async () => {
            const setTxCostLimitRole = action.interface.getSighash('setTxCostLimit')
            await action.connect(owner).authorize(owner.address, setTxCostLimitRole)
          })

          context('when the tx consumes less than the cost limit', () => {
            const txCostLimit = MAX_UINT256

            beforeEach('set tx cost limit', async () => {
              await action.connect(owner).setTxCostLimit(txCostLimit)
            })

            itRedeemsTheGasCost()
          })

          context('when the tx consumes more than the cost limit', () => {
            const txCostLimit = 1

            beforeEach('set tx cost limit', async () => {
              await action.connect(owner).setTxCostLimit(txCostLimit)
            })

            it('reverts', async () => {
              await expect(action.call(toAddress(token))).to.be.revertedWith('TRANSACTION_COST_LIMIT_EXCEEDED')
            })
          })
        })
      }

      context('when paying with the native token', () => {
        const error = 1e13
        const balance = fp(0.1)

        beforeEach('set token and fund smart vault', async () => {
          token = NATIVE_TOKEN_ADDRESS
          await owner.sendTransaction({ to: smartVault.address, value: balance })
        })

        itRedeemsGasCostProperly(error)
      })

      context('when paying with the wrapped native token', () => {
        const error = 1e14
        const balance = fp(0.1)

        beforeEach('set token and fund smart vault', async () => {
          token = mimic.wrappedNativeToken
          await mimic.wrappedNativeToken.connect(owner).deposit({ value: balance })
          await mimic.wrappedNativeToken.connect(owner).transfer(smartVault.address, balance)
        })

        itRedeemsGasCostProperly(error)
      })

      context('when paying with another ERC20', () => {
        const error = 1e14
        const balance = fp(0.1)

        beforeEach('set token and fund smart vault', async () => {
          token = await createTokenMock()
          await token.mint(smartVault.address, balance)
        })

        context('when there is no price feed set', () => {
          it('reverts', async () => {
            await expect(action.call(toAddress(token))).to.be.revertedWith('MISSING_PRICE_FEED')
          })
        })

        context('when there is a price feed set', () => {
          const rate = 2

          beforeEach('mock price feed', async () => {
            const feed = await createPriceFeedMock(fp(rate))
            const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
            await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
            await smartVault
              .connect(owner)
              .setPriceFeed(mimic.wrappedNativeToken.address, toAddress(token), feed.address)
          })

          itRedeemsGasCostProperly(error, rate)
        })
      })
    })

    context('when the sender is not a relayer', () => {
      token = NATIVE_TOKEN_ADDRESS

      itDoesNotRedeemAnyCost()
    })
  })
})
