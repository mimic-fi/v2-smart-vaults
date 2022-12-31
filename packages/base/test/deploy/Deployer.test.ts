import {
  assertIndirectEvent,
  currentTimestamp,
  deploy,
  fp,
  instanceAt,
  MONTH,
  ONES_BYTES32,
} from '@mimic-fi/v2-helpers'
import { assertPermissions, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

const randomAddress = (): string => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.randomBytes(20)))

describe('Deployer', () => {
  let smartVault: Contract, mimic: Mimic
  let receiver: Contract, relayed: Contract, timeLocked: Contract, tokenThreshold: Contract, withdrawal: Contract

  const config = {
    registry: undefined,
    smartVaultParams: {
      factory: undefined,
      impl: undefined,
      salt: ONES_BYTES32,
      admin: randomAddress(),
      feeCollector: randomAddress(),
      strategies: [],
      priceFeedParams: [
        { base: randomAddress(), quote: randomAddress(), feed: randomAddress() },
        { base: randomAddress(), quote: randomAddress(), feed: randomAddress() },
      ],
      priceOracle: undefined,
      swapConnector: undefined,
      bridgeConnector: undefined,
      swapFee: { pct: fp(0.1), cap: fp(1), token: randomAddress(), period: 120 },
      bridgeFee: { pct: fp(0.2), cap: fp(2), token: randomAddress(), period: 180 },
      withdrawFee: { pct: fp(0.3), cap: fp(3), token: randomAddress(), period: 240 },
      performanceFee: { pct: fp(0.4), cap: fp(4), token: randomAddress(), period: 300 },
    },
    receiverActionParams: {
      impl: undefined,
      admin: randomAddress(),
    },
    relayedActionParams: {
      impl: undefined,
      admin: randomAddress(),
      relayedActionParams: {
        relayers: [randomAddress(), randomAddress()],
        gasPriceLimit: 100e9,
        totalCostLimit: fp(100),
        payingGasToken: randomAddress(),
        permissiveModeAdmin: randomAddress(),
        isPermissiveModeActive: false,
      },
    },
    timeLockedActionParams: {
      impl: undefined,
      admin: randomAddress(),
      timeLockedActionParams: {
        period: MONTH,
      },
    },
    tokenThresholdActionParams: {
      impl: undefined,
      admin: randomAddress(),
      tokenThresholdActionParams: {
        amount: fp(10),
        token: randomAddress(),
      },
    },
    withdrawalActionParams: {
      impl: undefined,
      admin: randomAddress(),
      withdrawalActionParams: {
        recipient: randomAddress(),
      },
    },
  }

  before('setup mimic', async () => {
    mimic = await setupMimic(false)
  })

  before('deploy smart vault', async () => {
    const deployer = await deploy('DeployerMock', [], undefined, { Deployer: mimic.deployer.address })
    receiver = await deploy('ReceiverActionMock', [deployer.address, mimic.registry.address])
    relayed = await deploy('RelayedActionMock', [deployer.address, mimic.registry.address])
    timeLocked = await deploy('TimeLockedActionMock', [deployer.address, mimic.registry.address])
    tokenThreshold = await deploy('TokenThresholdActionMock', [deployer.address, mimic.registry.address])
    withdrawal = await deploy('WithdrawalActionMock', [deployer.address, mimic.registry.address])

    config.registry = mimic.registry.address
    config.smartVaultParams.impl = mimic.smartVault.address
    config.smartVaultParams.factory = mimic.smartVaultsFactory.address
    config.smartVaultParams.priceOracle = mimic.priceOracle.address
    config.smartVaultParams.swapConnector = mimic.swapConnector.address
    config.smartVaultParams.bridgeConnector = mimic.bridgeConnector.address
    config.receiverActionParams.impl = receiver.address
    config.relayedActionParams.impl = relayed.address
    config.timeLockedActionParams.impl = timeLocked.address
    config.tokenThresholdActionParams.impl = tokenThreshold.address
    config.withdrawalActionParams.impl = withdrawal.address

    const { args } = await assertIndirectEvent(
      await deployer.deploy(config),
      mimic.smartVaultsFactory.interface,
      'Created',
      {
        implementation: mimic.smartVault,
      }
    )

    smartVault = await instanceAt('SmartVault', args.instance)
  })

  describe('smart vault', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(smartVault, [
        {
          name: 'owner',
          account: config.smartVaultParams.admin,
          roles: [
            'authorize',
            'unauthorize',
            'collect',
            'withdraw',
            'wrap',
            'unwrap',
            'claim',
            'join',
            'exit',
            'swap',
            'bridge',
            'setStrategy',
            'setPriceFeed',
            'setPriceFeeds',
            'setPriceOracle',
            'setSwapConnector',
            'setBridgeConnector',
            'setSwapFee',
            'setBridgeFee',
            'setPerformanceFee',
            'setWithdrawFee',
          ],
        },
        { name: 'fee collector', account: config.smartVaultParams.feeCollector, roles: ['setFeeCollector'] },
        { name: 'receiver action', account: receiver, roles: [] },
        { name: 'relayed action', account: relayed, roles: [] },
        { name: 'time locked action', account: timeLocked, roles: [] },
        { name: 'token threshold action', account: tokenThreshold, roles: [] },
        { name: 'withdrawal action', account: withdrawal, roles: [] },
        { name: 'relayers', account: config.relayedActionParams.relayedActionParams.relayers, roles: [] },
      ])
    })

    it('sets a fee collector', async () => {
      expect(await smartVault.feeCollector()).to.be.equal(config.smartVaultParams.feeCollector)
    })

    it('sets a bridge fee', async () => {
      const bridgeFee = await smartVault.bridgeFee()

      expect(bridgeFee.pct).to.be.equal(config.smartVaultParams.bridgeFee.pct)
      expect(bridgeFee.cap).to.be.equal(config.smartVaultParams.bridgeFee.cap)
      expect(bridgeFee.token).to.be.equal(config.smartVaultParams.bridgeFee.token)
      expect(bridgeFee.period).to.be.equal(config.smartVaultParams.bridgeFee.period)
    })

    it('sets no swap fee', async () => {
      const swapFee = await smartVault.swapFee()

      expect(swapFee.pct).to.be.equal(config.smartVaultParams.swapFee.pct)
      expect(swapFee.cap).to.be.equal(config.smartVaultParams.swapFee.cap)
      expect(swapFee.token).to.be.equal(config.smartVaultParams.swapFee.token)
      expect(swapFee.period).to.be.equal(config.smartVaultParams.swapFee.period)
    })

    it('sets no withdraw fee', async () => {
      const withdrawFee = await smartVault.withdrawFee()

      expect(withdrawFee.pct).to.be.equal(config.smartVaultParams.withdrawFee.pct)
      expect(withdrawFee.cap).to.be.equal(config.smartVaultParams.withdrawFee.cap)
      expect(withdrawFee.token).to.be.equal(config.smartVaultParams.withdrawFee.token)
      expect(withdrawFee.period).to.be.equal(config.smartVaultParams.withdrawFee.period)
    })

    it('sets no performance fee', async () => {
      const performanceFee = await smartVault.performanceFee()

      expect(performanceFee.pct).to.be.equal(config.smartVaultParams.performanceFee.pct)
      expect(performanceFee.cap).to.be.equal(config.smartVaultParams.performanceFee.cap)
      expect(performanceFee.token).to.be.equal(config.smartVaultParams.performanceFee.token)
      expect(performanceFee.period).to.be.equal(config.smartVaultParams.performanceFee.period)
    })

    it('sets a price oracle', async () => {
      expect(await smartVault.priceOracle()).to.be.equal(config.smartVaultParams.priceOracle)
    })

    it('sets a swap connector', async () => {
      expect(await smartVault.swapConnector()).to.be.equal(config.smartVaultParams.swapConnector)
    })

    it('sets a bridge connector', async () => {
      expect(await smartVault.bridgeConnector()).to.be.equal(config.smartVaultParams.bridgeConnector)
    })
  })

  describe('receiver action', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(receiver, [
        {
          name: 'owner',
          account: config.receiverActionParams.admin,
          roles: ['authorize', 'unauthorize', 'setSmartVault', 'withdraw', 'call'],
        },
        { name: 'fee collector', account: config.smartVaultParams.feeCollector, roles: [] },
        { name: 'receiver action', account: receiver, roles: [] },
        { name: 'relayed action', account: relayed, roles: [] },
        { name: 'time locked action', account: timeLocked, roles: [] },
        { name: 'token threshold action', account: tokenThreshold, roles: [] },
        { name: 'withdrawal action', account: withdrawal, roles: [] },
        { name: 'relayers', account: config.relayedActionParams.relayedActionParams.relayers, roles: [] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await relayed.smartVault()).to.be.equal(smartVault.address)
    })
  })

  describe('relayed action', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(relayed, [
        {
          name: 'owner',
          account: config.relayedActionParams.admin,
          roles: ['authorize', 'unauthorize', 'setSmartVault', 'setLimits', 'setRelayer', 'call'],
        },
        { name: 'fee collector', account: config.smartVaultParams.feeCollector, roles: [] },
        { name: 'receiver action', account: receiver, roles: [] },
        { name: 'relayed action', account: relayed, roles: [] },
        { name: 'time locked action', account: timeLocked, roles: [] },
        { name: 'token threshold action', account: tokenThreshold, roles: [] },
        { name: 'withdrawal action', account: withdrawal, roles: [] },
        { name: 'relayers', account: config.relayedActionParams.relayedActionParams.relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await relayed.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected gas limits', async () => {
      expect(await relayed.gasPriceLimit()).to.be.equal(config.relayedActionParams.relayedActionParams.gasPriceLimit)
      expect(await relayed.totalCostLimit()).to.be.equal(config.relayedActionParams.relayedActionParams.totalCostLimit)
      expect(await relayed.payingGasToken()).to.be.equal(config.relayedActionParams.relayedActionParams.payingGasToken)
    })

    it('sets the expected permissive mode', async () => {
      expect(await relayed.isPermissiveModeActive()).to.be.equal(
        config.relayedActionParams.relayedActionParams.isPermissiveModeActive
      )
    })

    it('allows the requested relayers', async () => {
      for (const relayer of config.relayedActionParams.relayedActionParams.relayers) {
        expect(await relayed.isRelayer(relayer)).to.be.true
      }
    })
  })

  describe('time locked action', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(timeLocked, [
        {
          name: 'owner',
          account: config.timeLockedActionParams.admin,
          roles: ['authorize', 'unauthorize', 'setSmartVault', 'setTimeLock', 'call'],
        },
        { name: 'fee collector', account: config.smartVaultParams.feeCollector, roles: [] },
        { name: 'receiver action', account: receiver, roles: [] },
        { name: 'relayed action', account: relayed, roles: [] },
        { name: 'time locked action', account: timeLocked, roles: [] },
        { name: 'token threshold action', account: tokenThreshold, roles: [] },
        { name: 'withdrawal action', account: withdrawal, roles: [] },
        { name: 'relayers', account: config.relayedActionParams.relayedActionParams.relayers, roles: [] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await timeLocked.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected period', async () => {
      expect(await timeLocked.period()).to.be.equal(config.timeLockedActionParams.timeLockedActionParams.period)
      expect(await timeLocked.nextResetTime()).to.be.lt(await currentTimestamp())
    })
  })

  describe('token threshold action', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(tokenThreshold, [
        {
          name: 'owner',
          account: config.tokenThresholdActionParams.admin,
          roles: ['authorize', 'unauthorize', 'setSmartVault', 'setThreshold', 'call'],
        },
        { name: 'fee collector', account: config.smartVaultParams.feeCollector, roles: [] },
        { name: 'receiver action', account: receiver, roles: [] },
        { name: 'relayed action', account: relayed, roles: [] },
        { name: 'time locked action', account: timeLocked, roles: [] },
        { name: 'token threshold action', account: tokenThreshold, roles: [] },
        { name: 'withdrawal action', account: withdrawal, roles: [] },
        { name: 'relayers', account: config.relayedActionParams.relayedActionParams.relayers, roles: [] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await tokenThreshold.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected threshold', async () => {
      expect(await tokenThreshold.thresholdToken()).to.be.equal(
        config.tokenThresholdActionParams.tokenThresholdActionParams.token
      )
      expect(await tokenThreshold.thresholdAmount()).to.be.equal(
        config.tokenThresholdActionParams.tokenThresholdActionParams.amount
      )
    })
  })

  describe('withdrawal action', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(withdrawal, [
        {
          name: 'owner',
          account: config.withdrawalActionParams.admin,
          roles: ['authorize', 'unauthorize', 'setSmartVault', 'setRecipient', 'call'],
        },
        { name: 'fee collector', account: config.smartVaultParams.feeCollector, roles: [] },
        { name: 'receiver action', account: receiver, roles: [] },
        { name: 'relayed action', account: relayed, roles: [] },
        { name: 'time locked action', account: timeLocked, roles: [] },
        { name: 'token threshold action', account: tokenThreshold, roles: [] },
        { name: 'withdrawal action', account: withdrawal, roles: [] },
        { name: 'relayers', account: config.relayedActionParams.relayedActionParams.relayers, roles: [] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await withdrawal.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected recipient', async () => {
      expect(await withdrawal.recipient()).to.be.equal(config.withdrawalActionParams.withdrawalActionParams.recipient)
    })
  })
})
