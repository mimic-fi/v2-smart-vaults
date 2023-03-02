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

describe('RelayersConfig', () => {
  let action: Contract, admin: SignerWithAddress

  before('load signer', async () => {
    admin = await getSigner(2)
  })

  beforeEach('deploy action', async () => {
    action = await deploy('RelayersConfigMock', [0, []])
  })

  describe('setTxCostLimit', () => {
    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setTxCostLimitRole = action.interface.getSighash('setTxCostLimit')
        await action.authorize(admin.address, setTxCostLimitRole)
        action = action.connect(admin)
      })

      context('when the limit is not zero', () => {
        const txCostLimit = 100e9

        it('sets the tx cost limit', async () => {
          await action.setTxCostLimit(txCostLimit)
          expect(await action.getTxCostLimit()).to.be.equal(txCostLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setTxCostLimit(txCostLimit)
          await assertEvent(tx, 'TxCostLimitSet', { txCostLimit })
        })
      })

      context('when the limit is zero', () => {
        const txCostLimit = 0

        it('sets the tx cost limit', async () => {
          await action.setTxCostLimit(txCostLimit)
          expect(await action.getTxCostLimit()).to.be.equal(txCostLimit)
        })

        it('emits an event', async () => {
          const tx = await action.setTxCostLimit(txCostLimit)
          await assertEvent(tx, 'TxCostLimitSet', { txCostLimit })
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(action.setTxCostLimit(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setRelayers', () => {
    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setRelayersRole = action.interface.getSighash('setRelayers')
        await action.authorize(admin.address, setRelayersRole)
        action = action.connect(admin)
      })

      context('when no address zero is given', () => {
        const relayerA = '0x1173A9964Cd6F835ECE1702F9f65c1C6aAA8e88D'
        const relayerB = '0x388C818CA8B9251b393131C08a736A67ccB19297'
        const relayerC = '0x31E31C34e297132C46E2acdd2EC481F86d274dB0'

        it('updates the list of allowed relayers', async () => {
          await action.setRelayers([relayerA], [])

          expect(await action.isRelayer(relayerA)).to.be.true
          expect(await action.isRelayer(relayerB)).to.be.false
          expect(await action.isRelayer(relayerC)).to.be.false

          await action.setRelayers([relayerB, relayerC], [relayerA])

          expect(await action.isRelayer(relayerA)).to.be.false
          expect(await action.isRelayer(relayerB)).to.be.true
          expect(await action.isRelayer(relayerC)).to.be.true

          await action.setRelayers([relayerA], [relayerA])

          expect(await action.isRelayer(relayerA)).to.be.false
          expect(await action.isRelayer(relayerB)).to.be.true
          expect(await action.isRelayer(relayerC)).to.be.true

          await action.setRelayers([relayerA, relayerB], [relayerC])

          expect(await action.isRelayer(relayerA)).to.be.true
          expect(await action.isRelayer(relayerB)).to.be.true
          expect(await action.isRelayer(relayerC)).to.be.false
        })

        it('emits events only when the allow list is modified', async () => {
          const tx1 = await action.setRelayers([relayerA], [])

          await assertEvent(tx1, 'RelayerAllowed', { relayer: relayerA })

          expect(await action.isRelayer(relayerA)).to.be.true
          expect(await action.isRelayer(relayerB)).to.be.false
          expect(await action.isRelayer(relayerC)).to.be.false

          const tx2 = await action.setRelayers([relayerB, relayerC], [relayerA])

          await assertEvent(tx2, 'RelayerAllowed', { relayer: relayerB })
          await assertEvent(tx2, 'RelayerAllowed', { relayer: relayerC })
          await assertEvent(tx2, 'RelayerDisallowed', { relayer: relayerA })

          const tx3 = await action.setRelayers([relayerA], [relayerA])

          await assertEvent(tx3, 'RelayerAllowed', { relayer: relayerA })
          await assertEvent(tx3, 'RelayerDisallowed', { relayer: relayerA })

          const tx4 = await action.setRelayers([relayerA, relayerB], [relayerC])

          await assertEvent(tx4, 'RelayerAllowed', { relayer: relayerA })
          await assertEvent(tx4, 'RelayerDisallowed', { relayer: relayerC })
        })
      })

      context('when no address zero is given', () => {
        it('reverts', async () => {
          await expect(action.setRelayers([ZERO_ADDRESS], [])).to.be.revertedWith('RELAYER_ADDRESS_ZERO')
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(action.setRelayers([], [])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('redeemGas', () => {
    const ERROR = 0.05

    context('when the sender is a relayer', () => {
      let relayer: SignerWithAddress

      beforeEach('set relayer', async () => {
        relayer = await getSigner(3)
        const setRelayersRole = action.interface.getSighash('setRelayers')
        await action.authorize(admin.address, setRelayersRole)
        await action.connect(admin).setRelayers([relayer.address], [])
      })

      context('when there is a price defined for the paying token', () => {
        const price = fp(0.5) // 1 native token is 0.5 paying tokens
        const token = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

        beforeEach('mock price', async () => {
          await action.mockNativeTokenPrice(token, price)
        })

        const itRedeemsGasProperly = () => {
          it('redeems gas properly', async () => {
            const tx = await action.connect(relayer).call(token)

            const { args } = await assertEvent(tx, 'TransactionCostPaid', { token })

            const { gasUsed, effectiveGasPrice } = await tx.wait()
            const expectedCost = gasUsed.mul(effectiveGasPrice).mul(price).div(fp(1))
            assertAlmostEqual(args.amount, expectedCost, ERROR)
          })
        }

        context('when there is no tx cost limit', () => {
          itRedeemsGasProperly()
        })

        context('when there is a tx cost limit', () => {
          beforeEach('authorize sender', async () => {
            const setTxCostLimitRole = action.interface.getSighash('setTxCostLimit')
            await action.authorize(admin.address, setTxCostLimitRole)
          })

          context('when the tx cost limit is not passed', () => {
            const txCostLimit = fp(0.5)

            beforeEach('set tx cost limit', async () => {
              await action.connect(admin).setTxCostLimit(txCostLimit)
            })

            itRedeemsGasProperly()
          })

          context('when the tx cost limit is passed', () => {
            const txCostLimit = 1e9

            beforeEach('set tx cost limit', async () => {
              await action.connect(admin).setTxCostLimit(txCostLimit)
            })

            it('reverts', async () => {
              await expect(action.connect(relayer).call(token)).to.be.revertedWith('TRANSACTION_COST_LIMIT_EXCEEDED')
            })
          })
        })
      })

      context('when there is not price defined for the paying token', () => {
        const token = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.connect(relayer).call(token)).to.be.revertedWith('MOCKED_NATIVE_PRICE_ZERO')
        })
      })
    })

    context('when the sender is not a relayer', () => {
      const token = ZERO_ADDRESS

      it('does not redeem gas', async () => {
        const tx = await action.call(token)

        await assertNoEvent(tx, 'TransactionCostPaid')
      })
    })
  })
})
