import { fp, getForkedNetwork, HOUR, instanceAt, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { assertPermissions, deployment } from '@mimic-fi/v2-smart-vaults-base'
import { expect } from 'chai'
import { Contract } from 'ethers'
import hre from 'hardhat'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x98339D8C260052B7ad81c28c16C0b98420f2B46a'
const WETH = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'
const HOP_ETH_BRIDGE = '0xC8A4FB931e8D77df8497790381CA7d228E68a41b'
const HOP_USDC_BRIDGE = '0x7D269D3E0d61A05a0bA976b7DBF8805bF844AF3F'

describe('L1SmartVault', () => {
  let smartVault: Contract, bridger: Contract, registry: Contract
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
    const { L1HopBridger, SmartVault } = await deployment.deploy(getForkedNetwork(hre), 'test')
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
            'setSwapConnector',
            'setBridgeConnector',
            'setSwapFee',
            'setBridgeFee',
            'setPerformanceFee',
            'setWithdrawFee',
          ],
        },
        { name: 'mimic', account: feeCollector, roles: ['setFeeCollector'] },
        { name: 'bridger', account: bridger, roles: ['bridge', 'withdraw'] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })

    it('sets a fee collector', async () => {
      expect(await smartVault.feeCollector()).to.be.equal(feeCollector)
    })

    it('sets a bridge fee', async () => {
      const bridgeFee = await smartVault.bridgeFee()

      expect(bridgeFee.pct).to.be.equal(fp(0.002))
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
            'setMaxRelayerFeePct',
            'setDestinationChainId',
            'setTokenBridge',
            'withdraw',
            'call',
          ],
        },
        { name: 'mimic', account: feeCollector, roles: ['setPermissiveMode'] },
        { name: 'bridger', account: bridger, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await bridger.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await bridger.thresholdToken()).to.be.equal(USDC)
      expect(await bridger.thresholdAmount()).to.be.equal(toUSDC(0.5))
    })

    it('sets the expected gas limits', async () => {
      expect(await bridger.gasPriceLimit()).to.be.equal(100e9)
      expect(await bridger.totalCostLimit()).to.be.equal(0)
      expect(await bridger.payingGasToken()).to.be.equal(USDC)
    })

    it('allows the requested chain ID', async () => {
      expect(await bridger.destinationChainId()).to.be.equal(80001)
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

    it('allows the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await bridger.isRelayer(relayer)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await bridger.isRelayer(manager)).to.be.false
      }
    })
  })
})
