import { fp, getForkedNetwork, HOUR, instanceAt, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { assertPermissions, deployment } from '@mimic-fi/v2-smart-vaults-base'
import { expect } from 'chai'
import { Contract } from 'ethers'
import hre from 'hardhat'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x6D4dd09982853F08d9966aC3cA4Eb5885F16f2b2'
const WETH = '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa'
const HOP_USDC_AMM = '0xa81D244A1814468C734E5b4101F7b9c0c577a8fC'
const HOP_WETH_AMM = '0x0e0E3d2C5c292161999474247956EF542caBF8dd'

describe.skip('L2SmartVault', () => {
  let smartVault: Contract, bridger: Contract, swapper: Contract, registry: Contract
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
    const { L2HopBridger, L2HopSwapper, SmartVault } = await deployment.deploy(getForkedNetwork(hre), 'test')
    bridger = await instanceAt('L2HopBridger', L2HopBridger)
    swapper = await instanceAt('L2HopSwapper', L2HopSwapper)
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
        { name: 'swapper', account: swapper, roles: ['swap', 'withdraw'] },
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
            'setMaxSlippage',
            'setTokenAmm',
            'call',
          ],
        },
        { name: 'mimic', account: feeCollector, roles: ['setPermissiveMode'] },
        { name: 'swapper', account: swapper, roles: [] },
        { name: 'bridger', account: bridger, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await swapper.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected gas limits', async () => {
      expect(await swapper.gasPriceLimit()).to.be.equal(100e9)
      expect(await swapper.totalCostLimit()).to.be.equal(0)
      expect(await swapper.payingGasToken()).to.be.equal(USDC)
    })

    it('sets the requested AMMs', async () => {
      expect(await swapper.getTokenAmm(owner)).to.be.equal(ZERO_ADDRESS)
      expect(await swapper.getTokenAmm(WETH)).to.be.equal(HOP_WETH_AMM)
      expect(await swapper.getTokenAmm(USDC)).to.be.equal(HOP_USDC_AMM)
    })

    it('sets the requested max slippage', async () => {
      expect(await swapper.maxSlippage()).to.be.equal(fp(0.002))
    })

    it('allows the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await swapper.isRelayer(relayer)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await swapper.isRelayer(manager)).to.be.false
      }
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
            'setDestinationChainId',
            'setTokenAmm',
            'withdraw',
            'call',
          ],
        },
        { name: 'mimic', account: feeCollector, roles: ['setPermissiveMode'] },
        { name: 'swapper', account: swapper, roles: [] },
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

    it('allows the requested destination chain ID', async () => {
      expect(await bridger.destinationChainId()).to.be.equal(5)
    })

    it('sets the requested AMMs', async () => {
      expect(await bridger.getTokenAmm(owner)).to.be.equal(ZERO_ADDRESS)
      expect(await bridger.getTokenAmm(WETH)).to.be.equal(HOP_WETH_AMM)
      expect(await bridger.getTokenAmm(USDC)).to.be.equal(HOP_USDC_AMM)
    })

    it('sets the requested maximums', async () => {
      expect(await bridger.maxDeadline()).to.be.equal(2 * HOUR)
      expect(await bridger.maxSlippage()).to.be.equal(fp(0.002))
      expect(await bridger.maxBonderFeePct()).to.be.equal(fp(0.03))
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
