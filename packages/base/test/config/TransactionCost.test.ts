import {
  assertAlmostEqual,
  assertEvent,
  assertNoEvent,
  deploy,
  fp,
  getSigner,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

describe('TransactionCost', () => {
  let config: Contract

  beforeEach('deploy config', async () => {
    config = await deploy('TransactionCostMock')
  })

  describe('setRelayer', () => {
    const relayerA = '0x1173A9964Cd6F835ECE1702F9f65c1C6aAA8e88D'
    const relayerB = '0x388C818CA8B9251b393131C08a736A67ccB19297'
    const relayerC = '0x31E31C34e297132C46E2acdd2EC481F86d274dB0'

    it('adds relayers', async () => {
      await config.addRelayer(relayerA)

      expect(await config.hasRelayer(relayerA)).to.be.true
      expect(await config.hasRelayer(relayerB)).to.be.false
      expect(await config.hasRelayer(relayerC)).to.be.false
      expect(await config.getRelayers()).to.be.have.members([relayerA])

      await config.addRelayer(relayerB)

      expect(await config.hasRelayer(relayerA)).to.be.true
      expect(await config.hasRelayer(relayerB)).to.be.true
      expect(await config.hasRelayer(relayerC)).to.be.false
      expect(await config.getRelayers()).to.be.have.members([relayerA, relayerB])
    })

    it('adds multiple relayers at once', async () => {
      await config.addRelayers([relayerA, relayerB])

      expect(await config.hasRelayer(relayerA)).to.be.true
      expect(await config.hasRelayer(relayerB)).to.be.true
      expect(await config.hasRelayer(relayerC)).to.be.false

      expect(await config.getRelayers()).to.be.have.members([relayerA, relayerB])
    })

    it('removes relayers', async () => {
      await config.addRelayers([relayerA, relayerB, relayerC])
      await config.removeRelayer(relayerB)

      expect(await config.hasRelayer(relayerA)).to.be.true
      expect(await config.hasRelayer(relayerC)).to.be.true
      expect(await config.hasRelayer(relayerB)).to.be.false

      expect(await config.getRelayers()).to.be.have.members([relayerA, relayerC])
    })

    it('cleans the list of relayers', async () => {
      await config.addRelayers([relayerA, relayerB, relayerC])
      await config.cleanRelayers()

      expect(await config.hasRelayer(relayerA)).to.be.false
      expect(await config.hasRelayer(relayerB)).to.be.false
      expect(await config.hasRelayer(relayerC)).to.be.false

      expect(await config.getRelayers()).to.be.have.members([])
    })

    it('can overrides the list of relayers', async () => {
      await config.addRelayers([relayerA, relayerB, relayerC])

      expect(await config.getRelayers()).to.be.have.members([relayerA, relayerB, relayerC])

      await config.setRelayers([relayerC, relayerA])

      expect(await config.getRelayers()).to.be.have.members([relayerC, relayerA])

      expect(await config.hasRelayer(relayerA)).to.be.true
      expect(await config.hasRelayer(relayerC)).to.be.true
      expect(await config.hasRelayer(relayerB)).to.be.false
    })

    it('does not accept zero addresses', async () => {
      await expect(config.addRelayer(ZERO_ADDRESS)).to.be.revertedWith('TRANSACTION_RELAYER_ZERO')
      await expect(config.addRelayers([ZERO_ADDRESS])).to.be.revertedWith('TRANSACTION_RELAYER_ZERO')
      await expect(config.setRelayers([ZERO_ADDRESS])).to.be.revertedWith('TRANSACTION_RELAYER_ZERO')
    })
  })

  describe('setTxCostLimit', () => {
    context('when not set', () => {
      const txCostLimit = 0

      beforeEach('set tx cost limit', async () => {
        await config.setTxCostLimit(txCostLimit)
      })

      it('is consider valid when un set', async () => {
        expect(await config.getTxCostLimit()).to.be.equal(0)

        expect(await config.isTxCostValid(0)).to.be.true
        expect(await config.isTxCostValid(10)).to.be.true
        expect(await config.isTxCostValid(100)).to.be.true
      })
    })

    context('when it was set', () => {
      const txCostLimit = 100e9

      beforeEach('set tx cost limit', async () => {
        await config.setTxCostLimit(txCostLimit)
      })

      it('is consider valid when un set', async () => {
        expect(await config.getTxCostLimit()).to.be.equal(txCostLimit)

        expect(await config.isTxCostValid(txCostLimit - 1)).to.be.true
        expect(await config.isTxCostValid(txCostLimit)).to.be.true
        expect(await config.isTxCostValid(txCostLimit + 1)).to.be.false
      })
    })
  })

  describe('redeemGas', () => {
    const ERROR = 0.1

    context('when the sender is a relayer', () => {
      let relayer: SignerWithAddress

      beforeEach('set relayer', async () => {
        relayer = await getSigner()
        await config.addRelayer(relayer.address)
      })

      context('when there is a price defined for the paying token', () => {
        const rate = fp(0.5) // 1 native token is 0.5 paying tokens
        const token = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

        beforeEach('mock rate', async () => {
          await config.mockNativeTokenRate(token, rate)
        })

        const itRedeemsGasProperly = () => {
          it('redeems gas properly', async () => {
            const tx = await config.call(token)

            const { args } = await assertEvent(tx, 'TransactionCostPaid', { token })

            const { gasUsed, effectiveGasPrice } = await tx.wait()
            const expectedCost = gasUsed.mul(effectiveGasPrice).mul(rate).div(fp(1))
            assertAlmostEqual(args.amount, expectedCost, ERROR)
          })
        }

        context('when there is no tx cost limit', () => {
          itRedeemsGasProperly()
        })

        context('when there is a tx cost limit', () => {
          context('when the tx cost limit is not passed', () => {
            const txCostLimit = fp(0.5)

            beforeEach('set tx cost limit', async () => {
              await config.setTxCostLimit(txCostLimit)
            })

            itRedeemsGasProperly()
          })

          context('when the tx cost limit is passed', () => {
            const txCostLimit = 1e9

            beforeEach('set tx cost limit', async () => {
              await config.setTxCostLimit(txCostLimit)
            })

            it('reverts', async () => {
              await expect(config.call(token)).to.be.revertedWith('TRANSACTION_COST_FORBIDDEN')
            })
          })
        })
      })

      context('when there is not price defined for the paying token', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(config.call(token)).to.be.revertedWith('TRANSACTION_COST_MOCK_RATE_0')
        })
      })
    })

    context('when the sender is not a relayer', () => {
      const token = ZERO_ADDRESS

      it('does not redeem gas', async () => {
        const tx = await config.call(token)

        await assertNoEvent(tx, 'TransactionCostPaid')
      })
    })
  })
})
