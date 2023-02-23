import { assertEvent, BigNumberish, bn, deploy, pct } from '@mimic-fi/v2-helpers'
import { expect } from 'chai'
import { Contract, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'

describe('TransactionGas', () => {
  let config: Contract

  beforeEach('deploy acceptance list', async () => {
    config = await deploy('TransactionGasMock')
  })

  describe('validate', () => {
    const NEXT_BLOCK_BASE_FEE_EXPECTED_CORRELATION = 0.3 // 20%

    const call = async (fee: { priorityFee?: BigNumberish; gasPrice?: BigNumberish }): Promise<ContractTransaction> => {
      const { priorityFee, gasPrice } = fee
      if (priorityFee && gasPrice) throw Error('Please specify only a priority fee or a gas price')
      if (!priorityFee && !gasPrice) throw Error('Please specify either a priority fee or a gas price')
      return priorityFee ? config.call({ maxPriorityFeePerGas: priorityFee }) : config.call({ gasPrice })
    }

    const assertValid = async (feeData: { priorityFee?: BigNumberish; gasPrice?: BigNumberish }) => {
      const tx = await call(feeData)
      const { args } = await assertEvent(tx, 'FeeData')
      if (feeData.gasPrice) expect(args.gasPrice).to.be.lte(feeData.gasPrice)
      if (feeData.priorityFee) expect(args.priorityFee).to.be.lte(feeData.priorityFee)
    }

    const assertInvalid = async (feeData: { priorityFee?: BigNumberish; gasPrice?: BigNumberish }) => {
      await expect(call(feeData)).to.be.revertedWith('TRANSACTION_GAS_FORBIDDEN')
    }

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
          await config.set(gasPriceLimit, priorityFeeLimit)
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
          await config.set(gasPriceLimit, priorityFeeLimit)
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
          await config.set(gasPriceLimit, priorityFeeLimit)
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
