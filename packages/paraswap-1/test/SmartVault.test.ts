import { assertIndirectEvent, deploy, fp, getSigner, getSigners, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { assertPermissions, getActions } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('SmartVault', () => {
  let smartVault: Contract, wallet: Contract, withdrawer: Contract, erc20Claimer: Contract, nativeClaimer: Contract
  let registry: Contract, wrappedNativeToken: Contract
  let priceOracleImpl: Contract, walletImpl: Contract, smartVaultImpl: Contract, swapConnector: Contract
  let other: SignerWithAddress,
    mimic: SignerWithAddress,
    owner: SignerWithAddress,
    managers: SignerWithAddress[],
    relayers: SignerWithAddress[],
    feeClaimer: SignerWithAddress

  before('set up signers', async () => {
    other = await getSigner(0)
    mimic = await getSigner(1)
    owner = await getSigner(2)
    managers = await getSigners(3, 3)
    relayers = await getSigners(2, 6)
    feeClaimer = await getSigner(7)
  })

  before('deploy registry and dependencies', async () => {
    registry = await deploy('@mimic-fi/v2-registry/artifacts/contracts/registry/Registry.sol/Registry', [mimic.address])

    wrappedNativeToken = await deploy('WrappedNativeTokenMock')
    walletImpl = await deploy('Wallet', [wrappedNativeToken.address, registry.address])
    await registry.connect(mimic).register(await walletImpl.NAMESPACE(), walletImpl.address)

    swapConnector = await deploy('@mimic-fi/v2-swap-connector/artifacts/contracts/SwapConnector.sol/SwapConnector', [
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
    ])
    await registry.connect(mimic).register(await swapConnector.NAMESPACE(), swapConnector.address)

    priceOracleImpl = await deploy('PriceOracle', [wrappedNativeToken.address, registry.address])
    await registry.connect(mimic).register(await priceOracleImpl.NAMESPACE(), priceOracleImpl.address)

    smartVaultImpl = await deploy('SmartVault', [registry.address])
    await registry.connect(mimic).register(await smartVaultImpl.NAMESPACE(), smartVaultImpl.address)
  })

  before('deploy smart vault', async () => {
    const deployer = await deploy('SmartVaultDeployer')
    const tx = await deployer.deploy({
      owner: owner.address,
      managers: managers.map((m) => m.address),
      registry: registry.address,
      walletParams: {
        impl: walletImpl.address,
        admin: owner.address,
        feeCollector: mimic.address,
        strategy: ZERO_ADDRESS,
        swapConnector: swapConnector.address,
        swapFee: 0,
        withdrawFee: 0,
        performanceFee: 0,
      },
      priceOracleParams: {
        impl: priceOracleImpl.address,
        admin: owner.address,
        bases: [],
        quotes: [],
        feeds: [],
      },
      feeClaimerParams: {
        swapSigner: owner.address,
        feeClaimer: feeClaimer.address,
        tokenThresholdActionParams: {
          token: wrappedNativeToken.address,
          amount: fp(1.5),
        },
      },
      relayedActionParams: {
        relayers: relayers.map((m) => m.address),
        gasPriceLimit: 0,
        totalCostLimit: fp(100),
        payingGasToken: wrappedNativeToken.address,
      },
      smartVaultParams: {
        impl: smartVaultImpl.address,
        admin: owner.address,
      },
    })

    const { args } = await assertIndirectEvent(tx, registry.interface, 'Cloned', { implementation: smartVaultImpl })
    smartVault = await instanceAt('SmartVault', args.instance)
    wallet = await instanceAt('Wallet', await smartVault.wallet())

    const actions = await getActions(tx, smartVault)
    expect(actions.length).to.be.equal(3)
    withdrawer = await instanceAt('Withdrawer', actions[0])
    erc20Claimer = await instanceAt('ERC20Claimer', actions[1])
    nativeClaimer = await instanceAt('NativeClaimer', actions[2])
  })

  describe('smart vault', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(smartVault, [
        { name: 'owner', account: owner, roles: ['authorize', 'unauthorize', 'setWallet', 'setAction'] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'mimic', account: mimic, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })

    it('whitelists the actions', async () => {
      expect(await smartVault.isActionWhitelisted(erc20Claimer.address)).to.be.true
      expect(await smartVault.isActionWhitelisted(nativeClaimer.address)).to.be.true
    })
  })

  describe('wallet', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(wallet, [
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
            'setStrategy',
            'setPriceOracle',
            'setSwapConnector',
            'setSwapFee',
            'setPerformanceFee',
            'setWithdrawFee',
          ],
        },
        { name: 'mimic', account: mimic, roles: ['setFeeCollector'] },
        { name: 'withdrawer', account: withdrawer, roles: ['withdraw'] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: ['call', 'swap', 'withdraw'] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: ['call', 'wrap', 'withdraw'] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })

    it('sets a fee collector without fees', async () => {
      expect(await wallet.feeCollector()).to.be.equal(mimic.address)
      expect(await wallet.swapFee()).to.be.equal(0)
      expect(await wallet.withdrawFee()).to.be.equal(0)
      expect(await wallet.performanceFee()).to.be.equal(0)
    })

    it('sets a price oracle', async () => {
      const priceOracle = await wallet.priceOracle()
      expect(await registry.getImplementation(priceOracle)).to.be.equal(priceOracleImpl.address)
    })

    it('sets a swap connector', async () => {
      expect(await wallet.swapConnector()).to.be.equal(swapConnector.address)
    })

    it('does not set a strategy', async () => {
      expect(await wallet.strategy()).to.be.equal(ZERO_ADDRESS)
    })
  })

  describe('price oracle', () => {
    it('has set its permissions correctly', async () => {
      const priceOracle = await instanceAt('PriceOracle', await wallet.priceOracle())
      await assertPermissions(priceOracle, [
        { name: 'owner', account: owner, roles: ['authorize', 'unauthorize', 'setFeeds'] },
        { name: 'mimic', account: mimic, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })
  })

  describe('withdrawer', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(withdrawer, [
        {
          name: 'owner',
          account: owner,
          roles: ['authorize', 'unauthorize', 'setLimits', 'setRelayer', 'setRecipient', 'call'],
        },
        { name: 'mimic', account: mimic, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('sets the owner as the recipient', async () => {
      expect(await withdrawer.recipient()).to.be.equal(owner.address)
    })

    it('sets the expected gas limits', async () => {
      expect(await withdrawer.gasPriceLimit()).to.be.equal(0)
      expect(await withdrawer.totalCostLimit()).to.be.equal(fp(100))
      expect(await withdrawer.payingGasToken()).to.be.equal(wrappedNativeToken.address)
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
            'setLimits',
            'setRelayer',
            'setSwapSigner',
            'setFeeClaimer',
            'setThreshold',
            'call',
          ],
        },
        { name: 'mimic', account: mimic, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('sets the expected fee claimer params', async () => {
      expect(await erc20Claimer.swapSigner()).to.be.equal(owner.address)
      expect(await erc20Claimer.feeClaimer()).to.be.equal(feeClaimer.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await erc20Claimer.thresholdToken()).to.be.equal(wrappedNativeToken.address)
      expect(await erc20Claimer.thresholdAmount()).to.be.equal(fp(1.5))
    })

    it('sets the expected gas limits', async () => {
      expect(await erc20Claimer.gasPriceLimit()).to.be.equal(0)
      expect(await erc20Claimer.totalCostLimit()).to.be.equal(fp(100))
      expect(await erc20Claimer.payingGasToken()).to.be.equal(wrappedNativeToken.address)
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
          roles: ['authorize', 'unauthorize', 'setLimits', 'setRelayer', 'setFeeClaimer', 'setThreshold', 'call'],
        },
        { name: 'mimic', account: mimic, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('sets the expected gas limits', async () => {
      expect(await nativeClaimer.gasPriceLimit()).to.be.equal(0)
      expect(await nativeClaimer.totalCostLimit()).to.be.equal(fp(100))
      expect(await nativeClaimer.payingGasToken()).to.be.equal(wrappedNativeToken.address)
    })

    it('sets the expected fee claimer params', async () => {
      expect(await nativeClaimer.feeClaimer()).to.be.equal(feeClaimer.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await nativeClaimer.thresholdToken()).to.be.equal(wrappedNativeToken.address)
      expect(await nativeClaimer.thresholdAmount()).to.be.equal(fp(1.5))
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
})
