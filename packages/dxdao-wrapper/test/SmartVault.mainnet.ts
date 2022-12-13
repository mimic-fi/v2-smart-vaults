import { bn, fp, getForkedNetwork, impersonate, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { assertPermissions, assertRelayedBaseCost, deployment } from '@mimic-fi/v2-smart-vaults-base'
import { expect } from 'chai'
import { Contract } from 'ethers'
import hre, { ethers } from 'hardhat'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

describe('SmartVault', () => {
  let smartVault: Contract, wrapper: Contract, receiver: Contract, registry: Contract
  let owner: string, relayers: string[], managers: string[], feeCollector: string, mimic: { [key: string]: string }

  before('load accounts', async () => {
    const input = await deployment.readInput(getForkedNetwork(hre))
    mimic = input.mimic
    owner = input.accounts.owner
    relayers = input.accounts.relayers
    managers = input.accounts.managers
    feeCollector = input.accounts.feeCollector
    registry = await instanceAt('IRegistry', mimic.Registry)
  })

  before('deploy smart vault', async () => {
    const { Wrapper, Receiver, SmartVault } = await deployment.deploy(getForkedNetwork(hre), 'test')
    wrapper = await instanceAt('Wrapper', Wrapper)
    receiver = await instanceAt('Receiver', Receiver)
    smartVault = await instanceAt('SmartVault', SmartVault)
  })

  describe('smart vault', () => {
    it('uses the correct implementation', async () => {
      expect(await registry.implementationOf(smartVault.address)).to.be.equal(mimic.SmartVault)
    })

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
            'setSwapFee',
            'setPerformanceFee',
            'setWithdrawFee',
          ],
        },
        { name: 'wrapper', account: wrapper, roles: ['wrap', 'withdraw'] },
        { name: 'receiver', account: receiver, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
        { name: 'feeCollector', account: feeCollector, roles: ['setFeeCollector'] },
      ])
    })

    it('sets a fee collector', async () => {
      expect(await smartVault.feeCollector()).to.be.equal(feeCollector)
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
      expect(await smartVault.priceOracle()).to.be.equal(mimic.PriceOracle)
    })

    it('does not set a swap connector', async () => {
      expect(await smartVault.swapConnector()).to.be.equal(ZERO_ADDRESS)
    })

    it('sets a price feed for WETH-USDC', async () => {
      expect(await smartVault.getPriceFeed(USDC, WETH)).not.to.be.equal(ZERO_ADDRESS)
      expect(await smartVault.getPrice(WETH, USDC)).to.be.gt(bn(1200e6))
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
            'setSmartVault',
            'setLimits',
            'setRelayer',
            'setThreshold',
            'setRecipient',
            'call',
          ],
        },
        { name: 'wrapper', account: wrapper, roles: [] },
        { name: 'receiver', account: receiver, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
        { name: 'feeCollector', account: feeCollector, roles: [] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await wrapper.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the owner as the recipient', async () => {
      expect(await wrapper.recipient()).to.be.equal(owner)
    })

    it('sets the expected token threshold params', async () => {
      expect(await wrapper.thresholdToken()).to.be.equal(USDC)
      expect(await wrapper.thresholdAmount()).to.be.equal(bn(200e6))
    })

    it('sets the expected gas limits', async () => {
      expect(await wrapper.gasPriceLimit()).to.be.equal(bn(50e9))
      expect(await wrapper.totalCostLimit()).to.be.equal(0)
      expect(await wrapper.payingGasToken()).to.be.equal(WETH)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await wrapper.isRelayer(relayer)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await wrapper.isRelayer(manager)).to.be.false
      }
    })

    it('can wrap WETH when passing the threshold', async () => {
      const bot = await impersonate(relayers[0], fp(100))
      const weth = await instanceAt('IERC20', WETH)
      const previousOwnerBalance = await weth.balanceOf(owner)
      const previousFeeCollectorBalance = await weth.balanceOf(feeCollector)

      await bot.sendTransaction({ to: smartVault.address, value: fp(0.1) })
      await expect(wrapper.connect(bot).call()).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')

      await bot.sendTransaction({ to: smartVault.address, value: fp(0.5) })
      const tx = await wrapper.connect(bot).call()

      expect(await ethers.provider.getBalance(smartVault.address)).to.be.equal(0)

      const currentFeeCollectorBalance = await weth.balanceOf(feeCollector)
      const relayedCost = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
      const currentOwnerBalance = await weth.balanceOf(owner)
      const expectedWrappedBalance = fp(0.6).sub(relayedCost)
      expect(currentOwnerBalance).to.be.equal(previousOwnerBalance.add(expectedWrappedBalance))

      const redeemedCost = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
      await assertRelayedBaseCost(tx, redeemedCost, 0.1)
    })
  })

  describe('receiver', () => {
    it('has the proper smart vault set', async () => {
      expect(await receiver.smartVault()).to.be.equal(smartVault.address)
    })

    it('forwards ETH to the smart vault', async () => {
      const amount = fp(10)
      const bot = await impersonate(relayers[0], amount.mul(2))
      await bot.sendTransaction({ to: receiver.address, value: amount })

      const previousActionBalance = await ethers.provider.getBalance(receiver.address)
      const previousSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)

      await receiver.call()

      const currentActionBalance = await ethers.provider.getBalance(receiver.address)
      expect(currentActionBalance).to.be.equal(previousActionBalance.sub(amount))

      const currentSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
      expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(amount))
    })
  })
})
