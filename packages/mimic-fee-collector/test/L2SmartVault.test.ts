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
import { assertPermissions, Mimic, MOCKS, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('L2SmartVault', () => {
  let smartVault: Contract, bridger: Contract, swapper: Contract, hopL2Amm: Contract, mimic: Mimic
  let other: SignerWithAddress, owner: SignerWithAddress, managers: SignerWithAddress[]

  beforeEach('set up signers', async () => {
    other = await getSigner(1)
    owner = await getSigner(2)
    managers = await getSigners(3, 3)
  })

  beforeEach('setup mimic', async () => {
    mimic = await setupMimic(false)
  })

  beforeEach('deploy hop l2 amm mock', async () => {
    hopL2Amm = await deploy(MOCKS.HOP_L2_AMM, [mimic.wrappedNativeToken.address, mimic.wrappedNativeToken.address])
  })

  beforeEach('deploy smart vault', async () => {
    const deployer = await deploy('L2SmartVaultDeployer', [], owner, { Deployer: mimic.deployer.address })
    swapper = await deploy('L2HopSwapper', [deployer.address, mimic.registry.address])
    bridger = await deploy('L2HopBridger', [deployer.address, mimic.registry.address])

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
      l2HopSwapperActionParams: {
        impl: swapper.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        maxSlippage: fp(0.001), // 0.1 %
        hopAmmParams: [{ token: mimic.wrappedNativeToken.address, amm: hopL2Amm.address }],
      },
      l2HopBridgerActionParams: {
        impl: bridger.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        maxDeadline: 2 * HOUR,
        maxSlippage: fp(0.002), // 0.2 %
        maxBonderFeePct: fp(0.03), // 3 %
        destinationChainId: 1, // ethereum mainnet
        hopAmmParams: [{ token: mimic.wrappedNativeToken.address, amm: hopL2Amm.address }],
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
        { name: 'swapper', account: swapper, roles: ['swap'] },
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

  describe('swapper', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(swapper, [
        {
          name: 'owner',
          account: owner,
          roles: ['authorize', 'unauthorize', 'setSmartVault', 'setMaxSlippage', 'setTokenAmm', 'call'],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'swapper', account: swapper, roles: [] },
        { name: 'bridger', account: bridger, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await swapper.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the requested AMMs', async () => {
      expect(await swapper.getTokenAmm(owner.address)).to.be.equal(ZERO_ADDRESS)
      expect(await swapper.getTokenAmm(mimic.wrappedNativeToken.address)).to.be.equal(hopL2Amm.address)
    })

    it('sets the requested max slippage', async () => {
      expect(await swapper.maxSlippage()).to.be.equal(fp(0.001))
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
            'setMaxBonderFeePct',
            'setDestinationChainId',
            'setTokenAmm',
            'withdraw',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'swapper', account: swapper, roles: [] },
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
      expect(await bridger.destinationChainId()).to.be.equal(1)
    })

    it('sets the requested AMMs', async () => {
      expect(await bridger.getTokenAmm(owner.address)).to.be.equal(ZERO_ADDRESS)
      expect(await bridger.getTokenAmm(mimic.wrappedNativeToken.address)).to.be.equal(hopL2Amm.address)
    })

    it('sets the requested maximums', async () => {
      expect(await bridger.maxDeadline()).to.be.equal(2 * HOUR)
      expect(await bridger.maxSlippage()).to.be.equal(fp(0.002))
      expect(await bridger.maxBonderFeePct()).to.be.equal(fp(0.03))
    })
  })
})
