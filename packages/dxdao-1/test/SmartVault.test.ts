import { assertIndirectEvent, deploy, fp, getSigner, getSigners, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { assertPermissions, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('SmartVault', () => {
  let smartVault: Contract, wallet: Contract, wrapper: Contract, mimic: Mimic
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

  beforeEach('deploy smart vault', async () => {
    const deployer = await deploy('SmartVaultDeployer', [], owner, { Deployer: mimic.deployer.address })
    wrapper = await deploy('Wrapper', [deployer.address, mimic.registry.address])

    const tx = await deployer.deploy({
      registry: mimic.registry.address,
      smartVaultParams: {
        impl: mimic.smartVault.address,
        admin: owner.address,
        walletParams: {
          impl: mimic.wallet.address,
          admin: owner.address,
          feeCollector: mimic.admin.address,
          strategies: [],
          priceFeedParams: [],
          priceOracle: mimic.priceOracle.address,
          swapConnector: mimic.swapConnector.address,
          swapFee: { pct: fp(0.1), cap: fp(1), token: mimic.wrappedNativeToken.address, period: 60 },
          withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
          performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        },
      },
      wrapperActionParams: {
        impl: wrapper.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: 0,
          totalCostLimit: fp(100),
          payingGasToken: mimic.wrappedNativeToken.address,
        },
        tokenThresholdActionParams: {
          amount: fp(10),
          token: mimic.wrappedNativeToken.address,
        },
        withdrawalActionParams: {
          recipient: owner.address,
        },
      },
    })

    const { args } = await assertIndirectEvent(tx, mimic.registry.interface, 'Cloned', {
      implementation: mimic.smartVault,
    })

    smartVault = await instanceAt('SmartVault', args.instance)
    wallet = await instanceAt('Wallet', await smartVault.wallet())
  })

  describe('smart vault', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(smartVault, [
        { name: 'owner', account: owner, roles: ['authorize', 'unauthorize', 'setWallet', 'setAction'] },
        { name: 'wrapper', account: wrapper, roles: [] },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })

    it('whitelists the actions', async () => {
      expect(await smartVault.isActionWhitelisted(wrapper.address)).to.be.true
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
            'setPriceFeed',
            'setPriceFeeds',
            'setPriceOracle',
            'setSwapConnector',
            'setSwapFee',
            'setPerformanceFee',
            'setWithdrawFee',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: ['setFeeCollector'] },
        { name: 'wrapper', account: wrapper, roles: ['wrap', 'withdraw'] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })

    it('sets a fee collector', async () => {
      expect(await wallet.feeCollector()).to.be.equal(mimic.admin.address)
    })

    it('sets a swap fee', async () => {
      const swapFee = await wallet.swapFee()

      expect(swapFee.pct).to.be.equal(fp(0.1))
      expect(swapFee.cap).to.be.equal(fp(1))
      expect(swapFee.token).to.be.equal(mimic.wrappedNativeToken.address)
      expect(swapFee.period).to.be.equal(60)
    })

    it('sets no withdraw fee', async () => {
      const withdrawFee = await wallet.withdrawFee()

      expect(withdrawFee.pct).to.be.equal(0)
      expect(withdrawFee.cap).to.be.equal(0)
      expect(withdrawFee.token).to.be.equal(ZERO_ADDRESS)
      expect(withdrawFee.period).to.be.equal(0)
    })

    it('sets no performance fee', async () => {
      const performanceFee = await wallet.performanceFee()

      expect(performanceFee.pct).to.be.equal(0)
      expect(performanceFee.cap).to.be.equal(0)
      expect(performanceFee.token).to.be.equal(ZERO_ADDRESS)
      expect(performanceFee.period).to.be.equal(0)
    })

    it('sets a price oracle', async () => {
      expect(await wallet.priceOracle()).to.be.equal(mimic.priceOracle.address)
    })

    it('does not set a swap connector', async () => {
      expect(await wallet.swapConnector()).to.be.equal(mimic.swapConnector.address)
    })
  })

  describe('wrapper', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(wrapper, [
        {
          name: 'owner',
          account: owner,
          roles: [
            'authorize',
            'unauthorize',
            'setWallet',
            'setLimits',
            'setRelayer',
            'setThreshold',
            'setRecipient',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'wrapper', account: wrapper, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper wallet set', async () => {
      expect(await wrapper.wallet()).to.be.equal(wallet.address)
    })

    it('sets the owner as the recipient', async () => {
      expect(await wrapper.recipient()).to.be.equal(owner.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await wrapper.thresholdToken()).to.be.equal(mimic.wrappedNativeToken.address)
      expect(await wrapper.thresholdAmount()).to.be.equal(fp(10))
    })

    it('sets the expected gas limits', async () => {
      expect(await wrapper.gasPriceLimit()).to.be.equal(0)
      expect(await wrapper.totalCostLimit()).to.be.equal(fp(100))
      expect(await wrapper.payingGasToken()).to.be.equal(mimic.wrappedNativeToken.address)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await wrapper.isRelayer(relayer.address)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await wrapper.isRelayer(manager.address)).to.be.false
      }
    })
  })
})
