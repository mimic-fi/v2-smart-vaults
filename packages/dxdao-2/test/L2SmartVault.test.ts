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
import { assertPermissions, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('L2SmartVault', () => {
  let smartVault: Contract, bridger: Contract, hopL2Amm: Contract, mimic: Mimic
  let other: SignerWithAddress, owner: SignerWithAddress, managers: SignerWithAddress[], relayers: SignerWithAddress[]

  beforeEach('set up signers', async () => {
    other = await getSigner(1)
    owner = await getSigner(2)
    managers = await getSigners(3, 3)
    relayers = await getSigners(2, 6)
  })

  beforeEach('setup mimic', async () => {
    mimic = await setupMimic(false)
  })

  beforeEach('deploy hop l2 amm mock', async () => {
    hopL2Amm = await deploy('HopL2AmmMock', [mimic.wrappedNativeToken.address])
  })

  beforeEach('deploy smart vault', async () => {
    const deployer = await deploy('L2SmartVaultDeployer', [], owner, { Deployer: mimic.deployer.address })
    bridger = await deploy('L2HopBridger', [deployer.address, mimic.registry.address])

    const tx = await deployer.deploy({
      registry: mimic.registry.address,
      smartVaultParams: {
        impl: mimic.smartVault.address,
        admin: owner.address,
        feeCollector: mimic.admin.address,
        strategies: [],
        priceFeedParams: [],
        priceOracle: mimic.priceOracle.address,
        swapConnector: mimic.swapConnector.address,
        bridgeConnector: mimic.bridgeConnector.address,
        bridgeFee: { pct: fp(0.01), cap: fp(2), token: mimic.wrappedNativeToken.address, period: 120 },
        swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      },
      l2HopBridgerActionParams: {
        impl: bridger.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        maxDeadline: 2 * HOUR,
        maxSlippage: fp(0.002), // 0.2 %
        maxBonderFeePct: fp(0.03), // 3 %
        allowedChainIds: [1], // ethereum mainnet
        hopAmmParams: [{ token: mimic.wrappedNativeToken.address, amm: hopL2Amm.address }],
        tokenThresholdActionParams: {
          amount: fp(10),
          token: mimic.wrappedNativeToken.address,
        },
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: 0,
          totalCostLimit: fp(100),
          payingGasToken: mimic.wrappedNativeToken.address,
          permissiveModeAdmin: mimic.admin.address,
          isPermissiveModeActive: false,
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
            'setSwapConnector',
            'setBridgeConnector',
            'setSwapFee',
            'setBridgeFee',
            'setPerformanceFee',
            'setWithdrawFee',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: ['setFeeCollector'] },
        { name: 'bridger', account: bridger, roles: ['bridge', 'withdraw'] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })

    it('sets a fee collector', async () => {
      expect(await smartVault.feeCollector()).to.be.equal(mimic.admin.address)
    })

    it('sets a bridge fee', async () => {
      const bridgeFee = await smartVault.bridgeFee()

      expect(bridgeFee.pct).to.be.equal(fp(0.01))
      expect(bridgeFee.cap).to.be.equal(fp(2))
      expect(bridgeFee.token).to.be.equal(mimic.wrappedNativeToken.address)
      expect(bridgeFee.period).to.be.equal(120)
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
            'setLimits',
            'setRelayer',
            'setThreshold',
            'setMaxSlippage',
            'setMaxDeadline',
            'setMaxBonderFeePct',
            'setAllowedChain',
            'setTokenAmm',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: ['setPermissiveMode'] },
        { name: 'bridger', account: bridger, roles: ['bridge', 'withdraw'] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await bridger.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await bridger.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await bridger.thresholdAmount()).to.be.equal(fp(10))
    })

    it('sets the expected gas limits', async () => {
      expect(await bridger.gasPriceLimit()).to.be.equal(0)
      expect(await bridger.totalCostLimit()).to.be.equal(fp(100))
      expect(await bridger.payingGasToken()).to.be.equal(mimic.wrappedNativeToken.address)
    })

    it('allows the requested chains', async () => {
      expect(await bridger.isChainAllowed(1)).to.be.true
      expect(await bridger.isChainAllowed(10)).to.be.false
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

    it('allows the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await bridger.isRelayer(relayer.address)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await bridger.isRelayer(manager.address)).to.be.false
      }
    })
  })
})
