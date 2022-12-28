import { fp, getForkedNetwork, HOUR, instanceAt, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { assertPermissions, deployment } from '@mimic-fi/v2-smart-vaults-base'
import { expect } from 'chai'
import { Contract } from 'ethers'
import hre from 'hardhat'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const HOP_ETH_BRIDGE = '0xb8901acB165ed027E32754E0FFe830802919727f'
const HOP_USDC_BRIDGE = '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a'
const CHAINLINK_ORACLE_ETH_USD = '0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e'

describe.skip('L1SmartVault', () => {
  let smartVault: Contract, bridger: Contract, funder: Contract, holder: Contract, registry: Contract
  let bot: string, owner: string, managers: string[], mimic: { [key: string]: string }

  before('load accounts', async () => {
    const input = await deployment.readInput(getForkedNetwork(hre))
    mimic = input.mimic
    bot = input.accounts.bot
    owner = input.accounts.owner
    managers = input.accounts.managers
    registry = await instanceAt('IRegistry', mimic.Registry)
  })

  before('deploy smart vault', async () => {
    const { Funder, Holder, L1HopBridger, SmartVault } = await deployment.deploy(getForkedNetwork(hre), 'test')
    funder = await instanceAt('Funder', Funder)
    holder = await instanceAt('Holder', Holder)
    bridger = await instanceAt('L1HopBridger', L1HopBridger)
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
        { name: 'funder', account: funder, roles: ['swap', 'unwrap', 'withdraw'] },
        { name: 'holder', account: holder, roles: ['wrap', 'swap'] },
        { name: 'bridger', account: bridger, roles: ['bridge'] },
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
      expect(await smartVault.priceOracle()).to.be.equal(mimic.PriceOracle)
    })

    it('sets a swap connector', async () => {
      expect(await smartVault.swapConnector()).to.be.equal(mimic.SwapConnector)
    })

    it('sets a bridge connector', async () => {
      expect(await smartVault.bridgeConnector()).to.be.equal(mimic.BridgeConnector)
    })

    it('sets a price feed for WETH-USDC', async () => {
      expect(await smartVault.getPriceFeed(WETH, USDC)).to.be.equal(CHAINLINK_ORACLE_ETH_USD)
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
        { name: 'funder', account: funder, roles: [] },
        { name: 'holder', account: holder, roles: [] },
        { name: 'bridger', account: bridger, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await funder.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected token balance limits', async () => {
      expect(await funder.minBalance()).to.be.equal(fp(0.3))
      expect(await funder.maxBalance()).to.be.equal(fp(2))
    })

    it('sets the requested max slippage', async () => {
      expect(await funder.maxSlippage()).to.be.equal(fp(0.001))
    })

    it('sets the requested recipient', async () => {
      expect(await funder.recipient()).to.be.equal(bot)
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
        { name: 'funder', account: funder, roles: [] },
        { name: 'holder', account: holder, roles: [] },
        { name: 'bridger', account: bridger, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await holder.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await holder.thresholdToken()).to.be.equal(USDC)
      expect(await holder.thresholdAmount()).to.be.equal(toUSDC(5))
    })

    it('sets the requested token out', async () => {
      expect(await holder.tokenOut()).to.be.equal(USDC)
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
            'setAllowedChain',
            'setTokenBridge',
            'call',
          ],
        },
        { name: 'funder', account: funder, roles: [] },
        { name: 'holder', account: holder, roles: [] },
        { name: 'bridger', account: bridger, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await bridger.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await bridger.thresholdToken()).to.be.equal(USDC)
      expect(await bridger.thresholdAmount()).to.be.equal(toUSDC(5))
    })

    it('allows the requested chains', async () => {
      expect(await bridger.isChainAllowed(100)).to.be.false
      expect(await bridger.isChainAllowed(80001)).to.be.true
    })

    it('sets the requested bridges', async () => {
      expect(await bridger.getTokenBridge(owner)).to.be.equal(ZERO_ADDRESS)
      expect(await bridger.getTokenBridge(WETH)).to.be.equal(HOP_ETH_BRIDGE)
      expect(await bridger.getTokenBridge(USDC)).to.be.equal(HOP_USDC_BRIDGE)
    })

    it('sets the requested maximums', async () => {
      expect(await bridger.maxDeadline()).to.be.equal(2 * HOUR)
      expect(await bridger.maxSlippage()).to.be.equal(fp(0.002))
      expect(await bridger.getMaxRelayerFeePct(ZERO_ADDRESS)).to.be.equal(0)
    })
  })
})
