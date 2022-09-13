import {
  assertAlmostEqual,
  assertEvent,
  assertIndirectEvent,
  deploy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('RelayedAction', () => {
  let action: Contract, wallet: Contract, priceOracle: Contract, wrappedNativeToken: Contract
  let admin: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, admin, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    priceOracle = await deploy('PriceOracleMock')
    wrappedNativeToken = await deploy('WrappedNativeTokenMock')
    wallet = await deploy('WalletMock', [priceOracle.address, feeCollector.address, wrappedNativeToken.address])
    action = await deploy('RelayedActionMock', [admin.address, wallet.address])
  })

  describe('setRelayer', () => {
    let newRelayer: SignerWithAddress

    beforeEach('set new relayer', async () => {
      newRelayer = other
    })

    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setRelayerRole = action.interface.getSighash('setRelayer')
        await action.connect(admin).authorize(admin.address, setRelayerRole)
        action = action.connect(admin)
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

      context('when the relayer was not allowed', async () => {
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
        await action.connect(admin).authorize(admin.address, setLimitsRole)
        action = action.connect(admin)
      })

      context('when the paying gas token is not zero', async () => {
        const payingGasToken = NATIVE_TOKEN_ADDRESS

        context('when the limits are not zero', async () => {
          const gasPriceLimit = 1e10
          const totalCostLimit = fp(2)

          it('sets the limits', async () => {
            await action.setLimits(gasPriceLimit, totalCostLimit, payingGasToken)

            expect(await action.gasPriceLimit()).to.be.equal(gasPriceLimit)
            expect(await action.totalCostLimit()).to.be.equal(totalCostLimit)
            expect(await action.payingGasToken()).to.be.equal(payingGasToken)
          })

          it('emits an event', async () => {
            const tx = await action.setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
            await assertEvent(tx, 'LimitsSet', { gasPriceLimit, totalCostLimit, payingGasToken })
          })
        })

        context('when the limits are zero', async () => {
          const gasPriceLimit = 0
          const totalCostLimit = 0
          const payingGasToken = NATIVE_TOKEN_ADDRESS

          it('sets the limits', async () => {
            await action.setLimits(gasPriceLimit, totalCostLimit, payingGasToken)

            expect(await action.gasPriceLimit()).to.be.equal(gasPriceLimit)
            expect(await action.totalCostLimit()).to.be.equal(totalCostLimit)
            expect(await action.payingGasToken()).to.be.equal(payingGasToken)
          })

          it('emits an event', async () => {
            const tx = await action.setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
            await assertEvent(tx, 'LimitsSet', { gasPriceLimit, totalCostLimit, payingGasToken })
          })
        })
      })

      context('when the paying gas token is zero', async () => {
        const payingGasToken = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setLimits(0, 0, payingGasToken)).to.be.revertedWith('PAYING_GAS_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setLimits(0, 0, ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('redeemGas', () => {
    const REDEEM_GAS_NOTE = `0x${Buffer.from('RELAYER', 'utf-8').toString('hex')}`

    beforeEach('authorize admin', async () => {
      const setLimitsRole = action.interface.getSighash('setLimits')
      await action.connect(admin).authorize(admin.address, setLimitsRole)
    })

    context('when the sender is a relayer', () => {
      beforeEach('authorize relayer', async () => {
        const setRelayerRole = action.interface.getSighash('setRelayer')
        await action.connect(admin).authorize(admin.address, setRelayerRole)
        await action.connect(admin).setRelayer(other.address, true)
        action = action.connect(other)
      })

      context('with gas price limit', () => {
        const gasPriceLimit = 10e9
        const totalCostLimit = 0
        const payingGasToken = NATIVE_TOKEN_ADDRESS

        beforeEach('setLimits', async () => {
          await action.connect(admin).setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
        })

        context('when the tx gas price is under the limit', () => {
          const gasPrice = gasPriceLimit - 1

          it('redeems the expected cost to the wallet fee collector', async () => {
            const tx = await action.call({ gasPrice })

            const { args } = await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
              token: payingGasToken,
              recipient: feeCollector,
              data: REDEEM_GAS_NOTE,
            })

            const { gasUsed, effectiveGasPrice } = await tx.wait()
            const expectedCost = gasUsed.mul(effectiveGasPrice)
            assertAlmostEqual(args.amount, expectedCost, 0.15)
          })
        })

        context('when the tx gas price is above the limit', () => {
          const gasPrice = gasPriceLimit + 1

          it('reverts', async () => {
            await expect(action.call({ gasPrice })).to.be.revertedWith('GAS_PRICE_ABOVE_LIMIT')
          })
        })
      })

      context('with total cost limit', () => {
        let realGasCostEth
        const gasCostError = 1e12
        const gasPriceLimit = 0

        beforeEach('measure real gas cost', async () => {
          await action.connect(admin).setLimits(gasPriceLimit, fp(100), NATIVE_TOKEN_ADDRESS)
          const { args } = await assertIndirectEvent(await action.call(), wallet.interface, 'Withdraw')
          realGasCostEth = args.amount
        })

        context('paying in the native token', () => {
          const payingGasToken = NATIVE_TOKEN_ADDRESS

          context('when total gas cost limit is above the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.add(gasCostError)
              await action.connect(admin).setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
            })

            it('redeems the expected cost to the wallet fee collector', async () => {
              const tx = await action.call()

              const { args } = await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
                token: payingGasToken,
                recipient: feeCollector,
                data: REDEEM_GAS_NOTE,
              })

              expect(args.amount).to.be.at.least(realGasCostEth.sub(gasCostError))
              expect(args.amount).to.be.at.most(realGasCostEth.add(gasCostError))
            })
          })

          context('when total gas cost limit is below the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.sub(gasCostError)
              await action.connect(admin).setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
            })

            it('reverts', async () => {
              await expect(action.call()).to.be.revertedWith('TX_COST_ABOVE_LIMIT')
            })
          })
        })

        context('paying in the wrapped native token', () => {
          let payingGasToken: Contract

          beforeEach('set paying token', async () => {
            payingGasToken = wrappedNativeToken
          })

          context('when total gas cost limit is above the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.add(gasCostError)
              await action.connect(admin).setLimits(gasPriceLimit, totalCostLimit, payingGasToken.address)
            })

            it('redeems the expected cost to the wallet fee collector', async () => {
              const tx = await action.call()

              const { args } = await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
                token: payingGasToken,
                recipient: feeCollector,
                data: REDEEM_GAS_NOTE,
              })

              expect(args.amount).to.be.at.least(realGasCostEth.sub(gasCostError))
              expect(args.amount).to.be.at.most(realGasCostEth.add(gasCostError))
            })
          })

          context('when total gas cost limit is below the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.sub(gasCostError)
              await action.connect(admin).setLimits(gasPriceLimit, totalCostLimit, payingGasToken.address)
            })

            it('reverts', async () => {
              await expect(action.call()).to.be.revertedWith('TX_COST_ABOVE_LIMIT')
            })
          })
        })

        context('paying in another ERC20', () => {
          const rate = fp(2)
          let payingGasToken: Contract

          beforeEach('set paying token and mock oracle rate', async () => {
            payingGasToken = await deploy('TokenMock', ['TKN'])
            await priceOracle.mockRate(rate)
          })

          context('when total gas cost limit is above the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.add(gasCostError).mul(rate).div(fp(1))
              await action.connect(admin).setLimits(gasPriceLimit, totalCostLimit, payingGasToken.address)
            })

            it('redeems the expected cost to the wallet fee collector', async () => {
              const tx = await action.call()

              const { args } = await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
                token: payingGasToken,
                recipient: feeCollector,
                data: REDEEM_GAS_NOTE,
              })

              expect(args.amount).to.be.at.least(realGasCostEth.sub(gasCostError).mul(rate).div(fp(1)))
              expect(args.amount).to.be.at.most(realGasCostEth.add(gasCostError).mul(rate).div(fp(1)))
            })
          })

          context('when total gas cost limit is below the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.sub(gasCostError).mul(rate).div(fp(1))
              await action.connect(admin).setLimits(gasPriceLimit, totalCostLimit, payingGasToken.address)
            })

            it('reverts', async () => {
              await expect(action.call()).to.be.revertedWith('TX_COST_ABOVE_LIMIT')
            })
          })
        })
      })
    })

    context('when the sender is not a relayer', () => {
      it('reverts', async () => {
        await expect(action.call()).to.be.revertedWith('SENDER_NOT_RELAYER')
      })
    })
  })
})
