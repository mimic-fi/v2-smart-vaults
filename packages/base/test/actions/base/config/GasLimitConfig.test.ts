import { assertEvent, BigNumberish, bn, deploy, getSigner, pct } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'

describe('GasLimitConfig', () => {
  let action: Contract, admin: SignerWithAddress

  before('load signer', async () => {
    admin = await getSigner(2)
  })

  beforeEach('deploy action', async () => {
    action = await deploy('GasLimitConfigMock', [0, 0])
  })

  describe('setGasLimit', () => {
    context('when the sender is authorized', async () => {
      beforeEach('authorize sender', async () => {
        const setGasLimitRole = action.interface.getSighash('setGasLimit')
        await action.authorize(admin.address, setGasLimitRole)
        action = action.connect(admin)
      })

      context('when the limits are not zero', async () => {
        const gasPriceLimit = 100e9
        const priorityFeeLimit = 1e9

        it('sets the limits', async () => {
          await action.setGasLimit(gasPriceLimit, priorityFeeLimit)

          const limits = await action.getGasLimit()
          expect(limits.gasPriceLimit).to.be.equal(gasPriceLimit)
          expect(limits.priorityFeeLimit).to.be.equal(priorityFeeLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setGasLimit(gasPriceLimit, priorityFeeLimit)
          await assertEvent(tx, 'GasLimitSet', { gasPriceLimit, priorityFeeLimit })
        })
      })

      context('when the limits are zero', async () => {
        const gasPriceLimit = 0
        const priorityFeeLimit = 0

        it('sets the limits', async () => {
          await action.setGasLimit(gasPriceLimit, priorityFeeLimit)

          const limits = await action.getGasLimit()
          expect(limits.gasPriceLimit).to.be.equal(gasPriceLimit)
          expect(limits.priorityFeeLimit).to.be.equal(priorityFeeLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setGasLimit(gasPriceLimit, priorityFeeLimit)
          await assertEvent(tx, 'GasLimitSet', { gasPriceLimit, priorityFeeLimit })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setGasLimit(0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('validate', () => {
    const NEXT_BLOCK_BASE_FEE_EXPECTED_CORRELATION = 0.3 // 20%

    const call = async (fee: { priorityFee?: BigNumberish; gasPrice?: BigNumberish }): Promise<ContractTransaction> => {
      const { priorityFee, gasPrice } = fee
      if (priorityFee && gasPrice) throw Error('Please specify only a priority fee or a gas price')
      if (!priorityFee && !gasPrice) throw Error('Please specify either a priority fee or a gas price')
      return priorityFee ? action.call({ maxPriorityFeePerGas: priorityFee }) : action.call({ gasPrice })
    }

    const assertValid = async (feeData: { priorityFee?: BigNumberish; gasPrice?: BigNumberish }) => {
      const tx = await call(feeData)
      const { args } = await assertEvent(tx, 'FeeData')
      if (feeData.gasPrice) expect(args.gasPrice).to.be.lte(feeData.gasPrice)
      if (feeData.priorityFee) expect(args.priorityFee).to.be.lte(feeData.priorityFee)
    }

    const assertInvalid = async (feeData: { priorityFee?: BigNumberish; gasPrice?: BigNumberish }) => {
      await expect(call(feeData)).to.be.revertedWith('GAS_PRICE_LIMIT_EXCEEDED')
    }

    beforeEach('authorize sender', async () => {
      const setGasLimitRole = action.interface.getSighash('setGasLimit')
      await action.authorize(admin.address, setGasLimitRole)
    })

    context('when no base fee limit is set', () => {
      const priorityFeeLimit = 0

      context('when no gas price limit is set', () => {
        it('considers valid any gas price', async () => {
          await assertValid({ gasPrice: 1e9 })
          await assertValid({ gasPrice: 10e9 })
          await assertValid({ gasPrice: 100e9 })
          await assertValid({ gasPrice: 1000e9 })
        })

        it('considers valid any priority fee', async () => {
          await assertValid({ priorityFee: 1 })
          await assertValid({ priorityFee: 1e3 })
          await assertValid({ priorityFee: 1e5 })
          await assertValid({ priorityFee: 1e9 })
        })
      })

      context('when a gas price limit is set', () => {
        const gasPriceLimit = bn(40e9)

        beforeEach('set gas price limit', async () => {
          await action.connect(admin).setGasLimit(gasPriceLimit, priorityFeeLimit)
        })

        it('considers valid any priority fee that makes the gas price below the limit', async () => {
          const { lastBaseFeePerGas } = await ethers.provider.getFeeData()

          const highestExpectedNextBaseFee = pct(lastBaseFeePerGas, 1 + NEXT_BLOCK_BASE_FEE_EXPECTED_CORRELATION)
          await assertValid({ priorityFee: gasPriceLimit.sub(highestExpectedNextBaseFee) })

          const lowestExpectedNextBaseFee = pct(lastBaseFeePerGas, 1 - NEXT_BLOCK_BASE_FEE_EXPECTED_CORRELATION)
          await assertInvalid({ priorityFee: gasPriceLimit.sub(lowestExpectedNextBaseFee) })
        })

        it('considers valid any gas price below the limit ', async () => {
          await assertValid({ gasPrice: gasPriceLimit.sub(1) })
          await assertValid({ gasPrice: gasPriceLimit })
          await assertInvalid({ gasPrice: gasPriceLimit.add(1) })
        })
      })
    })

    context('when a base fee limit is set', () => {
      const priorityFeeLimit = bn(3e9)

      context('when no gas price limit is set', () => {
        const gasPriceLimit = 0

        beforeEach('set gas price limit', async () => {
          await action.connect(admin).setGasLimit(gasPriceLimit, priorityFeeLimit)
        })

        it('considers valid any priority fee below the limit ', async () => {
          await assertValid({ priorityFee: priorityFeeLimit.sub(1) })
          await assertValid({ priorityFee: priorityFeeLimit })
          await assertInvalid({ priorityFee: priorityFeeLimit.add(1) })
        })

        it('considers valid any gas fee that makes the priority fee below the limit', async () => {
          const { lastBaseFeePerGas } = await ethers.provider.getFeeData()

          const lowestExpectedNextBaseFee = pct(lastBaseFeePerGas, 1 - NEXT_BLOCK_BASE_FEE_EXPECTED_CORRELATION)
          await assertValid({ gasPrice: lowestExpectedNextBaseFee.add(priorityFeeLimit) })

          const highestExpectedNextBaseFee = pct(lastBaseFeePerGas, 1 + NEXT_BLOCK_BASE_FEE_EXPECTED_CORRELATION)
          await assertInvalid({ gasPrice: highestExpectedNextBaseFee.add(priorityFeeLimit) })
        })
      })

      context('when a gas price limit is set', () => {
        const gasPriceLimit = bn(4e9)

        beforeEach('set gas price limit', async () => {
          await action.connect(admin).setGasLimit(gasPriceLimit, priorityFeeLimit)
        })

        it('considers valid any fee below the combination limit ', async () => {
          const { lastBaseFeePerGas } = await ethers.provider.getFeeData()

          const lowestExpectedNextBaseFee = pct(lastBaseFeePerGas, 1 - NEXT_BLOCK_BASE_FEE_EXPECTED_CORRELATION)
          await assertValid({ gasPrice: lowestExpectedNextBaseFee.add(priorityFeeLimit) })

          const highestExpectedNextBaseFee = pct(lastBaseFeePerGas, 1 + NEXT_BLOCK_BASE_FEE_EXPECTED_CORRELATION)
          await assertInvalid({ gasPrice: highestExpectedNextBaseFee.add(priorityFeeLimit) })
        })
      })
    })
  })
})
