import {
  assertIndirectEvent,
  bn,
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

describe('SmartVault', () => {
  let smartVault: Contract, mimic: Mimic
  let withdrawer: Contract, erc20Claimer: Contract, nativeClaimer: Contract, swapFeeSetter: Contract
  let other: SignerWithAddress,
    owner: SignerWithAddress,
    managers: SignerWithAddress[],
    relayers: SignerWithAddress[],
    feeClaimer: SignerWithAddress

  before('setup mimic', async () => {
    mimic = await setupMimic(false)
  })

  before('set up signers', async () => {
    other = await getSigner(1)
    owner = await getSigner(2)
    managers = await getSigners(3, 3)
    relayers = await getSigners(2, 6)
    feeClaimer = await getSigner(7)
  })

  before('deploy smart vault', async () => {
    const deployer = await deploy('SmartVaultDeployer', [], owner, { Deployer: mimic.deployer.address })
    withdrawer = await deploy('Withdrawer', [deployer.address, mimic.registry.address])
    erc20Claimer = await deploy('ERC20Claimer', [deployer.address, mimic.registry.address])
    nativeClaimer = await deploy('NativeClaimer', [deployer.address, mimic.registry.address])
    swapFeeSetter = await deploy('SwapFeeSetter', [deployer.address, mimic.registry.address])

    const tx = await deployer.deploy({
      mimic: mimic.admin.address,
      registry: mimic.registry.address,
      smartVaultParams: {
        salt: ethers.utils.solidityKeccak256(['string'], ['mimic-v2.mimic-fee-collector']),
        factory: mimic.smartVaultsFactory.address,
        impl: mimic.smartVault.address,
        admin: owner.address,
        feeCollector: mimic.admin.address,
        strategies: [],
        priceFeedParams: [],
        priceOracle: mimic.priceOracle.address,
        swapConnector: mimic.swapConnector.address,
        bridgeConnector: mimic.bridgeConnector.address,
        swapFee: { pct: fp(0.1), cap: fp(1), token: mimic.wrappedNativeToken.address, period: 60 },
        bridgeFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      },
      withdrawerActionParams: {
        impl: withdrawer.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        withdrawalActionParams: {
          recipient: mimic.admin.address,
        },
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: 0,
          totalCostLimit: fp(100),
          payingGasToken: mimic.wrappedNativeToken.address,
          permissiveModeAdmin: mimic.admin.address,
          isPermissiveModeActive: false,
        },
        timeLockedActionParams: {
          period: MONTH,
        },
      },
      erc20ClaimerActionParams: {
        impl: erc20Claimer.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        maxSlippage: fp(0.1),
        swapSigner: owner.address,
        tokenSwapIgnores: [mimic.wrappedNativeToken.address],
        feeClaimerParams: {
          feeClaimer: feeClaimer.address,
          tokenThresholdActionParams: {
            token: mimic.wrappedNativeToken.address,
            amount: fp(1.5),
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
      },
      nativeClaimerActionParams: {
        impl: nativeClaimer.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        feeClaimerParams: {
          feeClaimer: feeClaimer.address,
          tokenThresholdActionParams: {
            token: mimic.wrappedNativeToken.address,
            amount: fp(1.5),
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
      },
      swapFeeSetterActionParams: {
        impl: swapFeeSetter.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        feeParams: [
          { pct: fp(0.05), cap: fp(100), token: mimic.wrappedNativeToken.address, period: MONTH },
          { pct: fp(0.1), cap: fp(200), token: mimic.wrappedNativeToken.address, period: MONTH * 2 },
        ],
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: bn(100e9),
          totalCostLimit: 0,
          payingGasToken: mimic.wrappedNativeToken.address,
          permissiveModeAdmin: mimic.admin.address,
          isPermissiveModeActive: false,
        },
        timeLockedActionParams: {
          period: MONTH,
        },
      },
    })

    const { args } = await assertIndirectEvent(tx, mimic.smartVaultsFactory.interface, 'Created', {
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
            'setBridgeFee',
            'setWithdrawFee',
            'setPerformanceFee',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: ['setFeeCollector', 'authorize', 'unauthorize'] },
        { name: 'withdrawer', account: withdrawer, roles: ['withdraw'] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: ['call', 'swap', 'withdraw'] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: ['call', 'wrap', 'withdraw'] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: ['setSwapFee', 'withdraw'] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })

    it('sets a fee collector', async () => {
      expect(await smartVault.feeCollector()).to.be.equal(mimic.admin.address)
    })

    it('sets a swap fee', async () => {
      const swapFee = await smartVault.swapFee()

      expect(swapFee.pct).to.be.equal(fp(0.1))
      expect(swapFee.cap).to.be.equal(fp(1))
      expect(swapFee.token).to.be.equal(mimic.wrappedNativeToken.address)
      expect(swapFee.period).to.be.equal(60)
    })

    it('sets no bridge fee', async () => {
      const bridgeFee = await smartVault.bridgeFee()

      expect(bridgeFee.pct).to.be.equal(0)
      expect(bridgeFee.cap).to.be.equal(0)
      expect(bridgeFee.token).to.be.equal(ZERO_ADDRESS)
      expect(bridgeFee.period).to.be.equal(0)
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

  describe('withdrawer', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(withdrawer, [
        {
          name: 'owner',
          account: owner,
          roles: [
            'authorize',
            'unauthorize',
            'setSmartVault',
            'setLimits',
            'setRelayer',
            'setTimeLock',
            'setRecipient',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: ['authorize', 'unauthorize', 'setPermissiveMode'] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await withdrawer.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the owner as the recipient', async () => {
      expect(await withdrawer.recipient()).to.be.equal(mimic.admin.address)
    })

    it('sets the expected time-lock', async () => {
      expect(await withdrawer.period()).to.be.equal(MONTH)
      expect(await withdrawer.nextResetTime()).not.to.be.eq(0)
    })

    it('sets the expected gas limits', async () => {
      expect(await withdrawer.gasPriceLimit()).to.be.equal(0)
      expect(await withdrawer.totalCostLimit()).to.be.equal(fp(100))
      expect(await withdrawer.payingGasToken()).to.be.equal(mimic.wrappedNativeToken.address)
    })

    it('does not allow relayed permissive mode', async () => {
      expect(await withdrawer.isPermissiveModeActive()).to.be.false
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
  })

  describe('erc20 claimer', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(erc20Claimer, [
        {
          name: 'owner',
          account: owner,
          roles: [
            'authorize',
            'unauthorize',
            'setSmartVault',
            'setLimits',
            'setRelayer',
            'setSwapSigner',
            'setMaxSlippage',
            'setIgnoreTokenSwaps',
            'setFeeClaimer',
            'setThreshold',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: ['authorize', 'unauthorize', 'setPermissiveMode'] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await erc20Claimer.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected fee claimer params', async () => {
      expect(await erc20Claimer.maxSlippage()).to.be.equal(fp(0.1))
      expect(await erc20Claimer.swapSigner()).to.be.equal(owner.address)
      expect(await erc20Claimer.feeClaimer()).to.be.equal(feeClaimer.address)
      expect(await erc20Claimer.isTokenSwapIgnored(mimic.wrappedNativeToken.address)).to.be.true
    })

    it('sets the expected token threshold params', async () => {
      expect(await erc20Claimer.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await erc20Claimer.thresholdAmount()).to.be.equal(fp(1.5))
    })

    it('sets the expected gas limits', async () => {
      expect(await erc20Claimer.gasPriceLimit()).to.be.equal(0)
      expect(await erc20Claimer.totalCostLimit()).to.be.equal(fp(100))
      expect(await erc20Claimer.payingGasToken()).to.be.equal(mimic.wrappedNativeToken.address)
    })

    it('does not allow relayed permissive mode', async () => {
      expect(await erc20Claimer.isPermissiveModeActive()).to.be.false
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await erc20Claimer.isRelayer(relayer.address)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await erc20Claimer.isRelayer(manager.address)).to.be.false
      }
    })
  })

  describe('native claimer', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(nativeClaimer, [
        {
          name: 'owner',
          account: owner,
          roles: [
            'authorize',
            'unauthorize',
            'setSmartVault',
            'setLimits',
            'setRelayer',
            'setFeeClaimer',
            'setThreshold',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: ['authorize', 'unauthorize', 'setPermissiveMode'] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await nativeClaimer.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected gas limits', async () => {
      expect(await nativeClaimer.gasPriceLimit()).to.be.equal(0)
      expect(await nativeClaimer.totalCostLimit()).to.be.equal(fp(100))
      expect(await nativeClaimer.payingGasToken()).to.be.equal(mimic.wrappedNativeToken.address)
    })

    it('sets the expected fee claimer params', async () => {
      expect(await nativeClaimer.feeClaimer()).to.be.equal(feeClaimer.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await nativeClaimer.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await nativeClaimer.thresholdAmount()).to.be.equal(fp(1.5))
    })

    it('does not allow relayed permissive mode', async () => {
      expect(await nativeClaimer.isPermissiveModeActive()).to.be.false
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await nativeClaimer.isRelayer(relayer.address)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await nativeClaimer.isRelayer(manager.address)).to.be.false
      }
    })
  })

  describe('swap fee setter', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(swapFeeSetter, [
        {
          name: 'owner',
          account: owner,
          roles: ['authorize', 'unauthorize', 'setSmartVault', 'setRelayer', 'setLimits', 'setTimeLock', 'call'],
        },
        { name: 'mimic', account: mimic.admin, roles: ['authorize', 'unauthorize', 'setPermissiveMode'] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await swapFeeSetter.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected time-lock', async () => {
      expect(await swapFeeSetter.period()).to.be.equal(MONTH)
      expect(await swapFeeSetter.nextResetTime()).not.to.be.eq(0)
    })

    it('sets the expected gas limits', async () => {
      expect(await swapFeeSetter.gasPriceLimit()).to.be.equal(bn(100e9))
      expect(await swapFeeSetter.totalCostLimit()).to.be.equal(0)
      expect(await swapFeeSetter.payingGasToken()).to.be.equal(mimic.wrappedNativeToken.address)
    })

    it('does not allow relayed permissive mode', async () => {
      expect(await swapFeeSetter.isPermissiveModeActive()).to.be.false
    })

    it('sets the expected fees', async () => {
      const fee0 = await swapFeeSetter.fees(0)
      expect(fee0.pct).to.be.equal(fp(0.05))
      expect(fee0.cap).to.be.equal(fp(100))
      expect(fee0.token).to.be.equal(mimic.wrappedNativeToken.address)
      expect(fee0.period).to.be.equal(MONTH)

      const fee1 = await swapFeeSetter.fees(1)
      expect(fee1.pct).to.be.equal(fp(0.1))
      expect(fee1.cap).to.be.equal(fp(200))
      expect(fee1.token).to.be.equal(mimic.wrappedNativeToken.address)
      expect(fee1.period).to.be.equal(MONTH * 2)
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
  })
})
