import {
  assertIndirectEvent,
  deploy,
  fp,
  getSigner,
  getSigners,
  HOUR,
  instanceAt,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { assertPermissions, createTokenMock, Mimic, MOCKS, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('L1SmartVault', () => {
  let smartVault: Contract, bridger: Contract, mimic: Mimic, funder: Contract, holder: Contract
  let holdingToken: Contract, hopL1Bridge: Contract
  let other: SignerWithAddress, owner: SignerWithAddress, managers: SignerWithAddress[], recipient: SignerWithAddress

  beforeEach('set up signers', async () => {
    other = await getSigner(1)
    owner = await getSigner(2)
    managers = await getSigners(3, 3)
    recipient = await getSigner(9)
  })

  beforeEach('setup mimic', async () => {
    mimic = await setupMimic(false)
  })

  beforeEach('deploy mocks', async () => {
    holdingToken = await createTokenMock()
    hopL1Bridge = await deploy(MOCKS.HOP_L1_BRIDGE, [mimic.wrappedNativeToken.address])
  })

  beforeEach('deploy smart vault', async () => {
    const deployer = await deploy('L1SmartVaultDeployer', [], owner, { Deployer: mimic.deployer.address })
    funder = await deploy('Funder', [deployer.address, mimic.registry.address])
    holder = await deploy('Holder', [deployer.address, mimic.registry.address])
    bridger = await deploy('L1HopBridger', [deployer.address, mimic.registry.address])

    const tx = await deployer.deploy({
      registry: mimic.registry.address,
      smartVaultParams: {
        impl: mimic.smartVault.address,
        admin: owner.address,
        feeCollector: ZERO_ADDRESS,
        strategies: [],
        priceFeedParams: [],
        priceOracle: mimic.priceOracle.address,
        swapConnector: mimic.swapConnector.address,
        bridgeConnector: mimic.bridgeConnector.address,
        bridgeFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      },
      funderActionParams: {
        impl: funder.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        minBalance: fp(10),
        maxBalance: fp(20),
        maxSlippage: fp(0.001),
        withdrawalActionParams: {
          recipient: recipient.address,
        },
      },
      holderActionParams: {
        impl: holder.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        maxSlippage: fp(0.002),
        tokenOut: holdingToken.address,
        tokenThresholdActionParams: {
          amount: fp(10),
          token: mimic.wrappedNativeToken.address,
        },
      },
      l1HopBridgerActionParams: {
        impl: bridger.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        maxDeadline: 2 * HOUR,
        maxSlippage: fp(0.002), // 0.2 %
        destinationChainId: 100, // gnosis chain
        hopBridgeParams: [{ token: mimic.wrappedNativeToken.address, bridge: hopL1Bridge.address }],
        hopRelayerParams: [{ relayer: other.address, maxFeePct: fp(0.02) }],
        tokenThresholdActionParams: {
          amount: fp(10),
          token: mimic.wrappedNativeToken.address,
        },
      },
    })

    const { args } = await assertIndirectEvent(tx, mimic.registry.interface, 'Cloned', {
      implementation: mimic.smartVault,
    })

    smartVault = await instanceAt('SmartVault', args.instance)
  })

  describe('smart vault', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(smartVault, [
        {
          name: 'owner',
          account: owner,
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
            'setFeeCollector',
            'setSwapConnector',
            'setBridgeConnector',
            'setSwapFee',
            'setBridgeFee',
            'setPerformanceFee',
            'setWithdrawFee',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'funder', account: funder, roles: ['swap', 'unwrap', 'withdraw'] },
        { name: 'holder', account: holder, roles: ['wrap', 'swap'] },
        { name: 'bridger', account: bridger, roles: ['bridge'] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: [] },
      ])
    })

    it('sets no fee collector', async () => {
      expect(await smartVault.feeCollector()).to.be.equal(ZERO_ADDRESS)
    })

    it('sets no bridge fee', async () => {
      const bridgeFee = await smartVault.bridgeFee()

      expect(bridgeFee.pct).to.be.equal(0)
      expect(bridgeFee.cap).to.be.equal(0)
      expect(bridgeFee.token).to.be.equal(ZERO_ADDRESS)
      expect(bridgeFee.period).to.be.equal(0)
    })

    it('sets no swap fee', async () => {
      const swapFee = await smartVault.swapFee()

      expect(swapFee.pct).to.be.equal(0)
      expect(swapFee.cap).to.be.equal(0)
      expect(swapFee.token).to.be.equal(ZERO_ADDRESS)
      expect(swapFee.period).to.be.equal(0)
    })

    it('sets no withdraw fee', async () => {
      const withdrawFee = await smartVault.withdrawFee()

      expect(withdrawFee.pct).to.be.equal(0)
      expect(withdrawFee.cap).to.be.equal(0)
      expect(withdrawFee.token).to.be.equal(ZERO_ADDRESS)
      expect(withdrawFee.period).to.be.equal(0)
    })

    it('sets no performance fee', async () => {
      const performanceFee = await smartVault.performanceFee()

      expect(performanceFee.pct).to.be.equal(0)
      expect(performanceFee.cap).to.be.equal(0)
      expect(performanceFee.token).to.be.equal(ZERO_ADDRESS)
      expect(performanceFee.period).to.be.equal(0)
    })

    it('sets a price oracle', async () => {
      expect(await smartVault.priceOracle()).to.be.equal(mimic.priceOracle.address)
    })

    it('sets a swap connector', async () => {
      expect(await smartVault.swapConnector()).to.be.equal(mimic.swapConnector.address)
    })

    it('sets a bridge connector', async () => {
      expect(await smartVault.bridgeConnector()).to.be.equal(mimic.bridgeConnector.address)
    })
  })

  describe('funder', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(funder, [
        {
          name: 'owner',
          account: owner,
          roles: [
            'authorize',
            'unauthorize',
            'setSmartVault',
            'setMaxSlippage',
            'setBalanceLimits',
            'setRecipient',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'funder', account: funder, roles: [] },
        { name: 'holder', account: holder, roles: [] },
        { name: 'bridger', account: bridger, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await funder.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected token balance limits', async () => {
      expect(await funder.minBalance()).to.be.equal(fp(10))
      expect(await funder.maxBalance()).to.be.equal(fp(20))
    })

    it('sets the requested max slippage', async () => {
      expect(await funder.maxSlippage()).to.be.equal(fp(0.001))
    })

    it('sets the requested recipient', async () => {
      expect(await funder.recipient()).to.be.equal(recipient.address)
    })
  })

  describe('holder', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(holder, [
        {
          name: 'owner',
          account: owner,
          roles: ['authorize', 'unauthorize', 'setSmartVault', 'setThreshold', 'setMaxSlippage', 'setTokenOut', 'call'],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'funder', account: funder, roles: [] },
        { name: 'holder', account: holder, roles: [] },
        { name: 'bridger', account: bridger, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await holder.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await holder.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await holder.thresholdAmount()).to.be.equal(fp(10))
    })

    it('sets the requested token out', async () => {
      expect(await holder.tokenOut()).to.be.equal(holdingToken.address)
    })

    it('sets the requested max slippage', async () => {
      expect(await holder.maxSlippage()).to.be.equal(fp(0.002))
    })
  })

  describe('bridger', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(bridger, [
        {
          name: 'owner',
          account: owner,
          roles: [
            'authorize',
            'unauthorize',
            'setSmartVault',
            'setThreshold',
            'setMaxSlippage',
            'setMaxDeadline',
            'setMaxRelayerFeePct',
            'setDestinationChainId',
            'setTokenBridge',
            'withdraw',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'funder', account: funder, roles: [] },
        { name: 'holder', account: holder, roles: [] },
        { name: 'bridger', account: bridger, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await bridger.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await bridger.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await bridger.thresholdAmount()).to.be.equal(fp(10))
    })

    it('allows the requested chain ID', async () => {
      expect(await bridger.destinationChainId()).to.be.equal(100)
    })

    it('sets the requested bridges', async () => {
      expect(await bridger.getTokenBridge(owner.address)).to.be.equal(ZERO_ADDRESS)
      expect(await bridger.getTokenBridge(mimic.wrappedNativeToken.address)).to.be.equal(hopL1Bridge.address)
    })

    it('sets the requested maximums', async () => {
      expect(await bridger.maxDeadline()).to.be.equal(2 * HOUR)
      expect(await bridger.maxSlippage()).to.be.equal(fp(0.002))
      expect(await bridger.getMaxRelayerFeePct(ZERO_ADDRESS)).to.be.equal(0)
      expect(await bridger.getMaxRelayerFeePct(other.address)).to.be.equal(fp(0.02))
    })
  })
})
