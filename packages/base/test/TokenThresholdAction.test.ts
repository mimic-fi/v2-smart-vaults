import { assertEvent, deploy, fp, getSigners, NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { createClone } from '@mimic-fi/v2-registry'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('TokenThresholdAction', () => {
  let action: Contract, wallet: Contract, registry: Contract, priceOracle: Contract
  let admin: SignerWithAddress, other: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, admin, other] = await getSigners()
  })

  beforeEach('deploy wallet', async () => {
    registry = await deploy('@mimic-fi/v2-registry/artifacts/contracts/registry/Registry.sol/Registry', [admin.address])
    wallet = await createClone(
      registry,
      admin,
      '@mimic-fi/v2-wallet/artifacts/contracts/Wallet.sol/Wallet',
      [ZERO_ADDRESS, registry.address],
      [admin.address]
    )
  })

  beforeEach('set price oracle', async () => {
    priceOracle = await createClone(registry, admin, 'PriceOracleMock', [])
    const setPriceOracleRole = wallet.interface.getSighash('setPriceOracle')
    await wallet.connect(admin).authorize(admin.address, setPriceOracleRole)
    await wallet.connect(admin).setPriceOracle(priceOracle.address)
  })

  beforeEach('deploy action', async () => {
    action = await deploy('TokenThresholdActionMock', [admin.address, wallet.address])
  })

  describe('setThreshold', () => {
    const amount = fp(1)
    const token = ZERO_ADDRESS

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setThresholdRole = action.interface.getSighash('setThreshold')
        await action.connect(admin).authorize(admin.address, setThresholdRole)
        action = action.connect(admin)
      })

      it('sets the swap signer', async () => {
        await action.setThreshold(token, amount)

        expect(await action.thresholdToken()).to.be.equal(token)
        expect(await action.thresholdAmount()).to.be.equal(amount)
      })

      it('emits an event', async () => {
        const tx = await action.setThreshold(token, amount)

        await assertEvent(tx, 'ThresholdSet', { token, amount })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setThreshold(token, amount)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('validate', () => {
    const rate = 2
    const thresholdAmount = fp(2)
    const thresholdToken = NATIVE_TOKEN_ADDRESS

    beforeEach('set threshold', async () => {
      const setThresholdRole = action.interface.getSighash('setThreshold')
      await action.connect(admin).authorize(admin.address, setThresholdRole)
      await action.connect(admin).setThreshold(thresholdToken, thresholdAmount)
    })

    beforeEach('mock rate', async () => {
      await priceOracle.mockRate(fp(rate))
    })

    context('when the given amount is lower than the set limit', () => {
      const amount = thresholdAmount.div(rate).sub(1)

      it('reverts', async () => {
        await expect(action.validateThreshold(ZERO_ADDRESS, amount)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')
      })
    })

    context('when the given amount is greater than the set limit', () => {
      const amount = thresholdAmount.div(rate).add(1)

      it('does not revert', async () => {
        await expect(action.validateThreshold(ZERO_ADDRESS, amount)).not.to.be.reverted
      })
    })
  })
})
