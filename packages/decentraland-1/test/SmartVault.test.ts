import { assertIndirectEvent, deploy, fp, getSigner, getSigners, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { assertPermissions, createTokenMock, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('SmartVault', () => {
  let smartVault: Contract, mimic: Mimic
  let swapper: Contract, withdrawer: Contract, tokenIn: Contract, tokenOut: Contract
  let other: SignerWithAddress, owner: SignerWithAddress, managers: SignerWithAddress[], relayers: SignerWithAddress[]

  before('setup mimic', async () => {
    mimic = await setupMimic(false)
  })

  before('set up signers', async () => {
    other = await getSigner(1)
    owner = await getSigner(2)
    managers = await getSigners(3, 3)
    relayers = await getSigners(2, 6)
  })

  before('deploy tokens', async () => {
    tokenIn = await createTokenMock()
    tokenOut = await createTokenMock()
  })

  before('deploy smart vault', async () => {
    const deployer = await deploy('SmartVaultDeployer', [], owner, { Deployer: mimic.deployer.address })
    swapper = await deploy('Swapper', [deployer.address, mimic.registry.address])
    withdrawer = await deploy('Withdrawer', [deployer.address, mimic.registry.address])

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
        swapFee: { pct: fp(0.01), cap: 0, token: ZERO_ADDRESS, period: 0 },
        withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      },
      swapperActionParams: {
        impl: swapper.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        maxSlippage: fp(0.1),
        tokenThresholdActionParams: {
          token: tokenIn.address,
          amount: fp(10),
        },
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: fp(100),
          totalCostLimit: 0,
          payingGasToken: tokenOut.address,
        },
      },
      withdrawerActionParams: {
        impl: withdrawer.address,
        admin: owner.address,
        managers: managers.map((m) => m.address),
        token: tokenOut.address,
        withdrawalActionParams: {
          recipient: owner.address,
        },
        tokenThresholdActionParams: {
          token: tokenOut.address,
          amount: fp(50),
        },
        relayedActionParams: {
          relayers: relayers.map((m) => m.address),
          gasPriceLimit: fp(100),
          totalCostLimit: 0,
          payingGasToken: tokenOut.address,
        },
      },
    })

    const { args } = await assertIndirectEvent(tx, mimic.registry.interface, 'Cloned', {
      implementation: mimic.smartVault.address,
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
            'setStrategy',
            'setPriceFeed',
            'setPriceFeeds',
            'setPriceOracle',
            'setSwapConnector',
            'setWithdrawFee',
            'setSwapFee',
            'setPerformanceFee',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: ['setFeeCollector'] },
        { name: 'swapper', account: swapper, roles: ['swap', 'withdraw'] },
        { name: 'withdrawer', account: withdrawer, roles: ['withdraw'] },
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

      expect(swapFee.pct).to.be.equal(fp(0.01))
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
  })

  describe('swapper', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(swapper, [
        {
          name: 'owner',
          account: owner,
          roles: [
            'authorize',
            'unauthorize',
            'setSmartVault',
            'setLimits',
            'setRelayer',
            'setTokenIn',
            'setTokenOut',
            'setMaxSlippage',
            'setThreshold',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'swapper', account: swapper, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'other', account: other, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await swapper.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected swapper params', async () => {
      expect(await swapper.tokenIn()).to.be.equal(tokenIn.address)
      expect(await swapper.tokenOut()).to.be.equal(tokenOut.address)
      expect(await swapper.maxSlippage()).to.be.equal(fp(0.1))
    })

    it('sets the expected token threshold params', async () => {
      expect(await swapper.thresholdToken()).to.be.equal(tokenIn.address)
      expect(await swapper.thresholdAmount()).to.be.equal(fp(10))
    })

    it('sets the expected gas limits', async () => {
      expect(await swapper.gasPriceLimit()).to.be.equal(fp(100))
      expect(await swapper.totalCostLimit()).to.be.equal(0)
      expect(await swapper.payingGasToken()).to.be.equal(tokenOut.address)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await swapper.isRelayer(relayer.address)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await swapper.isRelayer(manager.address)).to.be.false
      }
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
            'setThreshold',
            'setRecipient',
            'setToken',
            'call',
          ],
        },
        { name: 'mimic', account: mimic.admin, roles: [] },
        { name: 'swapper', account: swapper, roles: [] },
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

    it('sets the expected withdrawer params', async () => {
      expect(await withdrawer.token()).to.be.equal(tokenOut.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await withdrawer.thresholdToken()).to.be.equal(tokenOut.address)
      expect(await withdrawer.thresholdAmount()).to.be.equal(fp(50))
    })

    it('sets the expected gas limits', async () => {
      expect(await withdrawer.gasPriceLimit()).to.be.equal(fp(100))
      expect(await withdrawer.totalCostLimit()).to.be.equal(0)
      expect(await withdrawer.payingGasToken()).to.be.equal(tokenOut.address)
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
