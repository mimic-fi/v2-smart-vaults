import {
  assertIndirectEvent,
  deploy,
  fp,
  getSigner,
  getSigners,
  instanceAt,
  MONTH,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { assertPermissions, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

describe('L1SmartVault', () => {
  let smartVault: Contract, manager: Contract, mimic: Mimic
  let claimer: Contract, oneInchSwapper: Contract, paraswapSwapper: Contract, withdrawer: Contract
  let other: SignerWithAddress,
    owner: SignerWithAddress,
    managers: SignerWithAddress[],
    relayers: SignerWithAddress[],
    protocolFeeWithdrawer: SignerWithAddress

  beforeEach('set up signers', async () => {
    other = await getSigner(1)
    owner = await getSigner(2)
    managers = await getSigners(3, 3)
    relayers = await getSigners(2, 6)
    protocolFeeWithdrawer = await getSigner(7)
  })

  beforeEach('setup mimic', async () => {
    mimic = await setupMimic(false)
  })

  beforeEach('deploy smart vault', async () => {
    const deployer = await deploy('L1SmartVaultDeployer', [owner.address], owner, { Deployer: mimic.deployer.address })
    manager = await deploy('PermissionsManager', [deployer.address])
    claimer = await deploy('Claimer', [manager.address, mimic.registry.address])
    oneInchSwapper = await deploy('OneInchSwapper', [manager.address, mimic.registry.address])
    paraswapSwapper = await deploy('ParaswapSwapper', [manager.address, mimic.registry.address])
    withdrawer = await deploy('Withdrawer', [manager.address, mimic.registry.address])

    const tx = await deployer.connect(owner).deploy({
      owners: [owner.address, mimic.admin.address],
      manager: manager.address,
      registry: mimic.registry.address,
      smartVaultParams: {
        salt: ethers.utils.solidityKeccak256(['string'], ['mimic-v2.dxdao-bridger']),
        factory: mimic.smartVaultsFactory.address,
        impl: mimic.smartVault.address,
        admin: owner.address,
        feeCollector: mimic.admin.address,
        feeCollectorAdmin: mimic.admin.address,
        strategies: [],
        priceFeedParams: [],
        priceOracle: mimic.priceOracle.address,
        swapConnector: mimic.swapConnector.address,
        bridgeConnector: mimic.bridgeConnector.address,
        bridgeFee: { pct: fp(0.005), cap: fp(1), token: mimic.wrappedNativeToken.address, period: 60 },
        swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      },
      claimerActionParams: {
        impl: claimer.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        oracleSigner: mimic.admin.address,
        payingGasToken: mimic.wrappedNativeToken.address,
        protocolFeeWithdrawer: protocolFeeWithdrawer.address,
        tokenThresholdActionParams: {
          token: mimic.wrappedNativeToken.address,
          amount: fp(1),
        },
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: 100e9,
          txCostLimit: 0,
        },
      },
      oneInchSwapperActionParams: {
        impl: oneInchSwapper.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        tokenOut: mimic.wrappedNativeToken.address,
        swapSigner: owner.address,
        deniedTokens: [mimic.wrappedNativeToken.address],
        defaultMaxSlippage: fp(0.1),
        customSlippageTokens: [],
        customSlippageValues: [],
        tokenThresholdActionParams: {
          token: mimic.wrappedNativeToken.address,
          amount: fp(1.5),
        },
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: 200e9,
          txCostLimit: 0,
        },
      },
      paraswapSwapperActionParams: {
        impl: paraswapSwapper.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        tokenOut: mimic.wrappedNativeToken.address,
        swapSigner: owner.address,
        deniedTokens: [],
        defaultMaxSlippage: fp(0.2),
        customSlippageTokens: [mimic.wrappedNativeToken.address],
        customSlippageValues: [fp(0.01)],
        tokenThresholdActionParams: {
          token: mimic.wrappedNativeToken.address,
          amount: fp(2),
        },
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: 300e9,
          txCostLimit: 0,
        },
      },
      withdrawerActionParams: {
        impl: withdrawer.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        withdrawalActionParams: {
          recipient: owner.address,
        },
        timeLockedActionParams: {
          period: MONTH,
        },
        tokenThresholdActionParams: {
          token: mimic.wrappedNativeToken.address,
          amount: fp(50),
        },
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: 400e9,
          txCostLimit: 0,
        },
      },
    })

    const { args } = await assertIndirectEvent(tx, mimic.smartVaultsFactory.interface, 'Created', {
      implementation: mimic.smartVault,
    })

    smartVault = await instanceAt('SmartVault', args.instance)
  })

  describe('permissions manager', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(manager, [
        { name: 'manager', account: manager, roles: ['authorize', 'unauthorize'] },
        { name: 'owner', account: owner, roles: ['execute'] },
        { name: 'mimic', account: mimic.admin, roles: ['execute'] },
        { name: 'claimer', account: claimer, roles: [] },
        { name: '1inch swapper', account: oneInchSwapper, roles: [] },
        { name: 'psp swapper', account: paraswapSwapper, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })
  })

  describe('smart vault', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(smartVault, [
        { name: 'manager', account: manager, roles: ['authorize', 'unauthorize'] },
        {
          name: 'owner',
          account: owner,
          roles: [
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
        { name: 'claimer', account: claimer, roles: ['call', 'withdraw'] },
        { name: '1inch swapper', account: oneInchSwapper, roles: ['swap', 'withdraw'] },
        { name: 'psp swapper', account: paraswapSwapper, roles: ['swap', 'withdraw'] },
        { name: 'withdrawer', account: withdrawer, roles: ['withdraw'] },
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

      expect(bridgeFee.pct).to.be.equal(fp(0.005))
      expect(bridgeFee.cap).to.be.equal(fp(1))
      expect(bridgeFee.token).to.be.equal(mimic.wrappedNativeToken.address)
      expect(bridgeFee.period).to.be.equal(60)
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

    it('can authorize smart vault methods', async () => {
      const who = mimic.admin.address
      const what = smartVault.interface.getSighash('wrap')
      expect(await smartVault.isAuthorized(who, what)).to.be.false

      const requests = [{ target: smartVault.address, changes: [{ grant: true, permission: { who, what } }] }]
      await manager.connect(owner).execute(requests)

      expect(await smartVault.isAuthorized(who, what)).to.be.true
    })
  })

  describe('claimer', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(claimer, [
        { name: 'manager', account: manager, roles: ['authorize', 'unauthorize'] },
        {
          name: 'owner',
          account: owner,
          roles: [
            'setSmartVault',
            'setLimits',
            'setPermissiveRelayedMode',
            'setRelayer',
            'setThreshold',
            'setOracleSigner',
            'setPayingGasToken',
            'setProtocolFeeWithdrawer',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'claimer', account: claimer, roles: [] },
        { name: '1inch swapper', account: oneInchSwapper, roles: [] },
        { name: 'psp swapper', account: paraswapSwapper, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await claimer.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the proper oracle signer', async () => {
      expect(await claimer.isOracleSigner(owner.address)).to.be.false
      expect(await claimer.isOracleSigner(mimic.admin.address)).to.be.true
    })

    it('sets the proper paying gas token', async () => {
      expect(await claimer.payingGasToken()).to.be.equal(mimic.wrappedNativeToken.address)
    })

    it('sets the proper protocol fee withdrawer', async () => {
      expect(await claimer.protocolFeeWithdrawer()).to.be.equal(protocolFeeWithdrawer.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await claimer.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await claimer.thresholdAmount()).to.be.equal(fp(1))
    })

    it('sets the expected limits', async () => {
      expect(await claimer.gasPriceLimit()).to.be.equal(100e9)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await claimer.isRelayer(relayer.address)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await claimer.isRelayer(manager.address)).to.be.false
      }
    })

    it('can authorize claimer methods', async () => {
      const who = mimic.admin.address
      const what = claimer.interface.getSighash('call')
      expect(await claimer.isAuthorized(who, what)).to.be.false

      const requests = [{ target: claimer.address, changes: [{ grant: true, permission: { who, what } }] }]
      await manager.connect(owner).execute(requests)

      expect(await claimer.isAuthorized(who, what)).to.be.true
    })
  })

  describe('1inch swapper', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(oneInchSwapper, [
        { name: 'manager', account: manager, roles: ['authorize', 'unauthorize'] },
        {
          name: 'owner',
          account: owner,
          roles: [
            'setSmartVault',
            'setLimits',
            'setPermissiveRelayedMode',
            'setRelayer',
            'setTokenOut',
            'setSwapSigner',
            'setDefaultMaxSlippage',
            'setTokenMaxSlippage',
            'setDeniedTokens',
            'setThreshold',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'claimer', account: claimer, roles: [] },
        { name: '1inch swapper', account: oneInchSwapper, roles: [] },
        { name: 'psp swapper', account: paraswapSwapper, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await oneInchSwapper.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected signer', async () => {
      expect(await oneInchSwapper.swapSigner()).to.be.equal(owner.address)
    })

    it('sets the expected slippages', async () => {
      expect(await oneInchSwapper.defaultMaxSlippage()).to.be.equal(fp(0.1))
      expect(await oneInchSwapper.getTokenSlippage(mimic.wrappedNativeToken.address)).to.be.equal(fp(0.1))
    })

    it('sets the expected denied tokens', async () => {
      expect(await oneInchSwapper.isTokenDenied(mimic.wrappedNativeToken.address)).to.be.true
    })

    it('sets the expected token threshold params', async () => {
      expect(await oneInchSwapper.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await oneInchSwapper.thresholdAmount()).to.be.equal(fp(1.5))
    })

    it('sets the expected gas limits', async () => {
      expect(await oneInchSwapper.gasPriceLimit()).to.be.equal(200e9)
      expect(await oneInchSwapper.txCostLimit()).to.be.equal(0)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await oneInchSwapper.isRelayer(relayer.address)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await oneInchSwapper.isRelayer(manager.address)).to.be.false
      }
    })

    it('can authorize 1inch swapper methods', async () => {
      const who = mimic.admin.address
      const what = oneInchSwapper.interface.getSighash('call')
      expect(await oneInchSwapper.isAuthorized(who, what)).to.be.false

      const requests = [{ target: oneInchSwapper.address, changes: [{ grant: true, permission: { who, what } }] }]
      await manager.connect(owner).execute(requests)

      expect(await oneInchSwapper.isAuthorized(who, what)).to.be.true
    })
  })

  describe('paraswap swapper', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(paraswapSwapper, [
        { name: 'manager', account: manager, roles: ['authorize', 'unauthorize'] },
        {
          name: 'owner',
          account: owner,
          roles: [
            'setSmartVault',
            'setLimits',
            'setPermissiveRelayedMode',
            'setRelayer',
            'setTokenOut',
            'setSwapSigner',
            'setDefaultMaxSlippage',
            'setTokenMaxSlippage',
            'setDeniedTokens',
            'setThreshold',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'claimer', account: claimer, roles: [] },
        { name: '1inch swapper', account: oneInchSwapper, roles: [] },
        { name: 'psp swapper', account: paraswapSwapper, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await paraswapSwapper.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected signer', async () => {
      expect(await paraswapSwapper.swapSigner()).to.be.equal(owner.address)
    })

    it('sets the expected slippages', async () => {
      expect(await paraswapSwapper.defaultMaxSlippage()).to.be.equal(fp(0.2))
      expect(await paraswapSwapper.getTokenSlippage(mimic.wrappedNativeToken.address)).to.be.equal(fp(0.01))
    })

    it('sets the expected denied tokens', async () => {
      expect(await paraswapSwapper.isTokenDenied(mimic.wrappedNativeToken.address)).to.be.false
    })

    it('sets the expected token threshold params', async () => {
      expect(await paraswapSwapper.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await paraswapSwapper.thresholdAmount()).to.be.equal(fp(2))
    })

    it('sets the expected gas limits', async () => {
      expect(await paraswapSwapper.gasPriceLimit()).to.be.equal(300e9)
      expect(await paraswapSwapper.txCostLimit()).to.be.equal(0)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await paraswapSwapper.isRelayer(relayer.address)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await paraswapSwapper.isRelayer(manager.address)).to.be.false
      }
    })

    it('can authorize paraswap swapper methods', async () => {
      const who = mimic.admin.address
      const what = paraswapSwapper.interface.getSighash('call')
      expect(await paraswapSwapper.isAuthorized(who, what)).to.be.false

      const requests = [{ target: paraswapSwapper.address, changes: [{ grant: true, permission: { who, what } }] }]
      await manager.connect(owner).execute(requests)

      expect(await paraswapSwapper.isAuthorized(who, what)).to.be.true
    })
  })

  describe('withdrawer', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(withdrawer, [
        { name: 'manager', account: manager, roles: ['authorize', 'unauthorize'] },
        {
          name: 'owner',
          account: owner,
          roles: [
            'setSmartVault',
            'setLimits',
            'setPermissiveRelayedMode',
            'setRelayer',
            'setThreshold',
            'setRecipient',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'claimer', account: claimer, roles: [] },
        { name: '1inch swapper', account: oneInchSwapper, roles: [] },
        { name: 'psp swapper', account: paraswapSwapper, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await withdrawer.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the owner as the recipient', async () => {
      expect(await withdrawer.recipient()).to.be.equal(owner.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await withdrawer.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await withdrawer.thresholdAmount()).to.be.equal(fp(50))
    })

    it('sets the expected limits', async () => {
      expect(await withdrawer.gasPriceLimit()).to.be.equal(400e9)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await withdrawer.isRelayer(relayer.address)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await withdrawer.isRelayer(manager.address)).to.be.false
      }
    })

    it('can authorize withdrawer methods', async () => {
      const who = mimic.admin.address
      const what = withdrawer.interface.getSighash('call')
      expect(await withdrawer.isAuthorized(who, what)).to.be.false

      const requests = [{ target: withdrawer.address, changes: [{ grant: true, permission: { who, what } }] }]
      await manager.connect(owner).execute(requests)

      expect(await withdrawer.isAuthorized(who, what)).to.be.true
    })
  })
})
