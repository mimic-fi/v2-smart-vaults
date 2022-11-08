import {
  advanceTime,
  assertAlmostEqual,
  bn,
  currentTimestamp,
  fp,
  getForkedNetwork,
  impersonate,
  instanceAt,
  MINUTE,
  MONTH,
  NATIVE_TOKEN_ADDRESS,
  YEAR,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { assertPermissions, deployment } from '@mimic-fi/v2-smart-vaults-base'
import { getSwapData } from '@mimic-fi/v2-swap-connector'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import hre from 'hardhat'
import path from 'path'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const WHALE = '0x075e72a5edf65f0a5f44699c7654c1a76941ddc8'

describe('SmartVault', () => {
  let smartVault: Contract, feeClaimer: Contract, mimic: { [key: string]: string }
  let withdrawer: Contract, erc20Claimer: Contract, nativeClaimer: Contract, swapFeeSetter: Contract
  let owner: string, swapSigner: string, relayers: string[], managers: string[], feeCollector: string

  before('deploy mimic', async () => {
    // TODO: this should be read from input once Mimic is deployed
    const baseDir = path.join(process.cwd(), '../base')
    const input = await deployment.readInput(getForkedNetwork(hre), baseDir)
    await impersonate(input.admin, fp(100))
    mimic = await deployment.deploy(getForkedNetwork(hre), 'test', baseDir)
  })

  before('load accounts', async () => {
    const input = await deployment.readInput(getForkedNetwork(hre))
    owner = input.accounts.owner
    relayers = input.accounts.relayers
    managers = input.accounts.managers
    swapSigner = input.accounts.swapSigner
    feeCollector = input.accounts.feeCollector
    feeClaimer = await instanceAt('IFeeClaimer', input.accounts.feeClaimer)
  })

  before('deploy smart vault', async () => {
    // TODO: this should be executed directly using the deployment script once Mimic is deployed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const script = require('../deploy/index.ts').default
    const input = deployment.readInput(getForkedNetwork(hre))
    input.mimic = mimic
    input.params.registry = mimic.Registry
    input.params.smartVaultParams.impl = mimic.SmartVault
    input.params.smartVaultParams.priceOracle = mimic.PriceOracle
    input.params.smartVaultParams.swapConnector = mimic.SwapConnector
    await script(input, deployment.writeOutput('test'))
    const output = deployment.readOutput('test')

    smartVault = await instanceAt('SmartVault', output.SmartVault)
    withdrawer = await instanceAt('Withdrawer', output.Withdrawer)
    erc20Claimer = await instanceAt('ERC20Claimer', output.ERC20Claimer)
    nativeClaimer = await instanceAt('NativeClaimer', output.NativeClaimer)
    swapFeeSetter = await instanceAt('SwapFeeSetter', output.SwapFeeSetter)
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
            'setPerformanceFee',
          ],
        },
        { name: 'feeCollector', account: feeCollector, roles: ['setFeeCollector'] },
        { name: 'withdrawer', account: withdrawer, roles: ['withdraw'] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: ['call', 'swap', 'withdraw'] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: ['call', 'wrap', 'withdraw'] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: ['setSwapFee', 'withdraw'] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
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

    it('sets a swap connector', async () => {
      expect(await smartVault.swapConnector()).to.be.equal(mimic.SwapConnector)
    })

    it('sets a price feed for WETH-USDC', async () => {
      expect(await smartVault.getPriceFeed(USDC, WETH)).not.to.be.equal(ZERO_ADDRESS)

      const usdc = await instanceAt('IERC20Metadata', USDC)
      const weth = await instanceAt('IERC20Metadata', WETH)
      const { minAmountOut: price } = await getSwapData(smartVault, weth, usdc, fp(1), 0.001)
      assertAlmostEqual(await smartVault.getPrice(WETH, USDC), price, 0.1)
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
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await withdrawer.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the owner as the recipient', async () => {
      expect(await withdrawer.recipient()).to.be.equal(owner)
    })

    it('sets the expected time-lock', async () => {
      expect(await withdrawer.period()).to.be.equal(MONTH)
      expect(await withdrawer.nextResetTime()).not.to.be.eq(0)
    })

    it('sets the expected gas limits', async () => {
      expect(await withdrawer.gasPriceLimit()).to.be.equal(bn(100e9))
      expect(await withdrawer.totalCostLimit()).to.be.equal(0)
      expect(await withdrawer.payingGasToken()).to.be.equal(WETH)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await withdrawer.isRelayer(relayer)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await withdrawer.isRelayer(manager)).to.be.false
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
            'setMaxSlippage',
            'setSwapSigner',
            'setIgnoreTokenSwaps',
            'setFeeClaimer',
            'setThreshold',
            'call',
          ],
        },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await erc20Claimer.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected fee claimer params', async () => {
      expect(await erc20Claimer.maxSlippage()).to.be.equal(fp(0.03))
      expect(await erc20Claimer.swapSigner()).to.be.equal(swapSigner)
      expect(await erc20Claimer.feeClaimer()).to.be.equal(feeClaimer.address)
      expect(await erc20Claimer.isTokenSwapIgnored('0xcafe001067cdef266afb7eb5a286dcfd277f3de5')).to.be.true
    })

    it('sets the expected token threshold params', async () => {
      expect(await erc20Claimer.thresholdToken()).to.be.equal(USDC)
      expect(await erc20Claimer.thresholdAmount()).to.be.equal(bn(1000e6))
    })

    it('sets the expected gas limits', async () => {
      expect(await erc20Claimer.gasPriceLimit()).to.be.equal(bn(100e9))
      expect(await erc20Claimer.totalCostLimit()).to.be.equal(0)
      expect(await erc20Claimer.payingGasToken()).to.be.equal(WETH)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await erc20Claimer.isRelayer(relayer)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await erc20Claimer.isRelayer(manager)).to.be.false
      }
    })

    describe('call', async () => {
      let bot: SignerWithAddress, usdc: Contract, weth: Contract

      before('load accounts', async () => {
        bot = await impersonate(relayers[0], fp(10))
        usdc = await instanceAt('IERC20Metadata', USDC)
        weth = await instanceAt('IERC20Metadata', WETH)
      })

      it('can claim a token amount when passing the threshold', async () => {
        const previousSmartVaultBalance = await weth.balanceOf(smartVault.address)
        const previousFeeCollectorBalance = await weth.balanceOf(feeCollector)

        const slippage = 0.01
        const amountIn = bn(1500e6)
        const deadline = (await currentTimestamp()).add(MINUTE)
        const { data, sig, expectedAmountOut, minAmountOut } = await getSwapData(
          smartVault,
          usdc,
          weth,
          amountIn,
          slippage
        )

        const whale = await impersonate(WHALE, fp(100))
        await usdc.connect(whale).transfer(feeClaimer.address, amountIn)
        const augustusSwapper = await impersonate(await feeClaimer.augustusSwapper(), fp(10))
        await feeClaimer.connect(augustusSwapper).registerFee(smartVault.address, USDC, fp(0.5))
        await erc20Claimer.connect(bot).call(USDC, amountIn, minAmountOut, expectedAmountOut, deadline, data, sig)

        expect(await feeClaimer.getBalance(USDC, smartVault.address)).to.be.equal(0)

        const currentFeeCollectorBalance = await weth.balanceOf(feeCollector)
        const relayedCost = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
        const currentSmartVaultBalance = await weth.balanceOf(smartVault.address)
        const expectedClaimedBalance = minAmountOut.sub(relayedCost)
        expect(currentSmartVaultBalance).to.be.at.least(previousSmartVaultBalance.add(expectedClaimedBalance))
      })
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
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await nativeClaimer.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected gas limits', async () => {
      expect(await nativeClaimer.gasPriceLimit()).to.be.equal(bn(100e9))
      expect(await nativeClaimer.totalCostLimit()).to.be.equal(0)
      expect(await nativeClaimer.payingGasToken()).to.be.equal(WETH)
    })

    it('sets the expected fee claimer params', async () => {
      expect(await nativeClaimer.feeClaimer()).to.be.equal(feeClaimer.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await nativeClaimer.thresholdToken()).to.be.equal(USDC)
      expect(await nativeClaimer.thresholdAmount()).to.be.equal(bn(1000e6))
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await nativeClaimer.isRelayer(relayer)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await nativeClaimer.isRelayer(manager)).to.be.false
      }
    })

    describe('call', async () => {
      let weth: Contract
      let bot: SignerWithAddress, augustusSwapper: SignerWithAddress

      before('load accounts', async () => {
        bot = await impersonate(relayers[0], fp(100))
        augustusSwapper = await impersonate(await feeClaimer.augustusSwapper(), fp(10))
      })

      before('load weth', async () => {
        weth = await instanceAt(
          '@mimic-fi/v2-smart-vault/artifacts/contracts/IWrappedNativeToken.sol/IWrappedNativeToken',
          WETH
        )
      })

      it('can claim ETH when passing the threshold', async () => {
        const previousSmartVaultBalance = await weth.balanceOf(smartVault.address)
        const previousFeeCollectorBalance = await weth.balanceOf(feeCollector)

        await bot.sendTransaction({ to: feeClaimer.address, value: fp(0.5) })
        await feeClaimer.connect(augustusSwapper).registerFee(smartVault.address, NATIVE_TOKEN_ADDRESS, fp(0.5))
        await expect(nativeClaimer.connect(bot).call(NATIVE_TOKEN_ADDRESS)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')

        await bot.sendTransaction({ to: feeClaimer.address, value: fp(0.5) })
        await feeClaimer.connect(augustusSwapper).registerFee(smartVault.address, NATIVE_TOKEN_ADDRESS, fp(0.5))
        await nativeClaimer.connect(bot).call(NATIVE_TOKEN_ADDRESS)

        expect(await feeClaimer.getBalance(NATIVE_TOKEN_ADDRESS, smartVault.address)).to.be.equal(0)

        const currentFeeCollectorBalance = await weth.balanceOf(feeCollector)
        const relayedCost = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
        const currentSmartVaultBalance = await weth.balanceOf(smartVault.address)
        const expectedWrappedBalance = fp(1).sub(relayedCost)
        expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(expectedWrappedBalance))
      })

      it('can claim WETH when passing the threshold', async () => {
        const previousSmartVaultBalance = await weth.balanceOf(smartVault.address)
        const previousFeeCollectorBalance = await weth.balanceOf(feeCollector)

        await weth.connect(bot).deposit({ value: fp(0.5) })
        await weth.connect(bot).transfer(feeClaimer.address, fp(0.5))
        await feeClaimer.connect(augustusSwapper).registerFee(smartVault.address, WETH, fp(0.5))
        await expect(nativeClaimer.connect(bot).call(WETH)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')

        await weth.connect(bot).deposit({ value: fp(0.5) })
        await weth.connect(bot).transfer(feeClaimer.address, fp(0.5))
        await feeClaimer.connect(augustusSwapper).registerFee(smartVault.address, WETH, fp(0.5))
        await nativeClaimer.connect(bot).call(WETH)

        expect(await feeClaimer.getBalance(WETH, smartVault.address)).to.be.equal(0)

        const currentFeeCollectorBalance = await weth.balanceOf(feeCollector)
        const relayedCost = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
        const currentSmartVaultBalance = await weth.balanceOf(smartVault.address)
        const expectedWrappedBalance = fp(1).sub(relayedCost)
        expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(expectedWrappedBalance))
      })
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
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await swapFeeSetter.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected gas limits', async () => {
      expect(await swapFeeSetter.gasPriceLimit()).to.be.equal(bn(100e9))
      expect(await swapFeeSetter.totalCostLimit()).to.be.equal(0)
      expect(await swapFeeSetter.payingGasToken()).to.be.equal(WETH)
    })

    it('sets the expected fees', async () => {
      const fee0 = await swapFeeSetter.fees(0)
      expect(fee0.pct).to.be.equal(fp(0))
      expect(fee0.cap).to.be.equal(fp(0))
      expect(fee0.token).to.be.equal(ZERO_ADDRESS)
      expect(fee0.period).to.be.equal(0)

      const fee1 = await swapFeeSetter.fees(1)
      expect(fee1.pct).to.be.equal(fp(0.05))
      expect(fee1.cap).to.be.equal(bn(5000e6))
      expect(fee1.token).to.be.equal(USDC)
      expect(fee1.period).to.be.equal(YEAR)

      const fee2 = await swapFeeSetter.fees(2)
      expect(fee2.pct).to.be.equal(fp(0.1))
      expect(fee2.cap).to.be.equal(bn(5000e6))
      expect(fee2.token).to.be.equal(USDC)
      expect(fee2.period).to.be.equal(YEAR)

      const fee3 = await swapFeeSetter.fees(3)
      expect(fee3.pct).to.be.equal(fp(0.2))
      expect(fee3.cap).to.be.equal(bn(5000e6))
      expect(fee3.token).to.be.equal(USDC)
      expect(fee3.period).to.be.equal(YEAR)
    })

    it('sets the expected time-lock', async () => {
      expect(await swapFeeSetter.period()).to.be.equal(MONTH * 3)
      expect(await swapFeeSetter.nextResetTime()).not.to.be.eq(0)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await swapFeeSetter.isRelayer(relayer)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await swapFeeSetter.isRelayer(manager)).to.be.false
      }
    })

    describe('call', async () => {
      let bot: SignerWithAddress, weth: Contract

      before('load accounts', async () => {
        bot = await impersonate(relayers[0])
        weth = await instanceAt(
          '@mimic-fi/v2-smart-vault/artifacts/contracts/IWrappedNativeToken.sol/IWrappedNativeToken',
          WETH
        )
      })

      it('can set multiple swap fees', async () => {
        await weth.connect(bot).deposit({ value: fp(1) })
        await weth.connect(bot).transfer(smartVault.address, fp(1))

        await swapFeeSetter.connect(bot).call()
        const swapFee0 = await smartVault.swapFee()
        expect(swapFee0.pct).to.be.equal(fp(0))
        expect(swapFee0.cap).to.be.equal(fp(0))
        expect(swapFee0.token).to.be.equal(ZERO_ADDRESS)
        expect(swapFee0.period).to.be.equal(0)

        await expect(swapFeeSetter.connect(bot).call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
        await advanceTime(MONTH * 3)

        await swapFeeSetter.connect(bot).call()
        const swapFee1 = await smartVault.swapFee()
        expect(swapFee1.pct).to.be.equal(fp(0.05))
        expect(swapFee1.cap).to.be.equal(bn(5000e6))
        expect(swapFee1.token).to.be.equal(USDC)
        expect(swapFee1.period).to.be.equal(YEAR)

        await expect(swapFeeSetter.connect(bot).call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
        await advanceTime(MONTH * 3)

        await swapFeeSetter.connect(bot).call()
        const swapFee2 = await smartVault.swapFee()
        expect(swapFee2.pct).to.be.equal(fp(0.1))
        expect(swapFee2.cap).to.be.equal(bn(5000e6))
        expect(swapFee2.token).to.be.equal(USDC)
        expect(swapFee2.period).to.be.equal(YEAR)

        await expect(swapFeeSetter.connect(bot).call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
        await advanceTime(MONTH * 3)

        await swapFeeSetter.connect(bot).call()
        const swapFee3 = await smartVault.swapFee()
        expect(swapFee3.pct).to.be.equal(fp(0.2))
        expect(swapFee3.cap).to.be.equal(bn(5000e6))
        expect(swapFee3.token).to.be.equal(USDC)
        expect(swapFee3.period).to.be.equal(YEAR)

        await expect(swapFeeSetter.connect(bot).call()).to.be.revertedWith('FEE_CONFIGS_ALREADY_EXECUTED')
        await advanceTime(MONTH * 3)
        await expect(swapFeeSetter.connect(bot).call()).to.be.revertedWith('FEE_CONFIGS_ALREADY_EXECUTED')
      })
    })
  })
})
