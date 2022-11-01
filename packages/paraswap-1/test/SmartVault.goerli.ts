import {
  advanceTime,
  bn,
  fp,
  getForkedNetwork,
  impersonate,
  instanceAt,
  MONTH,
  NATIVE_TOKEN_ADDRESS,
  YEAR,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { assertPermissions, deployment } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import hre, { ethers } from 'hardhat'

/* eslint-disable no-secrets/no-secrets */

const WETH = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'

describe('SmartVault', () => {
  let smartVault: Contract, wallet: Contract, feeClaimer: Contract, mimic: { [key: string]: string }
  let withdrawer: Contract, erc20Claimer: Contract, nativeClaimer: Contract, swapFeeSetter: Contract
  let owner: string, swapSigner: string, relayers: string[], managers: string[], feeCollector: string

  before('load accounts', async () => {
    const input = await deployment.readInput(getForkedNetwork(hre))
    mimic = input.mimic
    owner = input.accounts.owner
    relayers = input.accounts.relayers
    managers = input.accounts.managers
    swapSigner = input.accounts.swapSigner
    feeCollector = input.accounts.feeCollector
  })

  before('deploy smart vault', async () => {
    const output = await deployment.deploy(getForkedNetwork(hre), 'test')
    wallet = await instanceAt('Wallet', output.Wallet)
    smartVault = await instanceAt('SmartVault', output.SmartVault)
    withdrawer = await instanceAt('Withdrawer', output.Withdrawer)
    erc20Claimer = await instanceAt('ERC20Claimer', output.ERC20Claimer)
    nativeClaimer = await instanceAt('NativeClaimer', output.NativeClaimer)
    swapFeeSetter = await instanceAt('SwapFeeSetter', output.SwapFeeSetter)
    feeClaimer = await instanceAt('IFeeClaimer', await nativeClaimer.feeClaimer())
  })

  describe('smart vault', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(smartVault, [
        { name: 'owner', account: owner, roles: ['authorize', 'unauthorize', 'setWallet', 'setAction'] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })

    it('whitelists the actions', async () => {
      expect(await smartVault.isActionWhitelisted(withdrawer.address)).to.be.true
      expect(await smartVault.isActionWhitelisted(erc20Claimer.address)).to.be.true
      expect(await smartVault.isActionWhitelisted(nativeClaimer.address)).to.be.true
      expect(await smartVault.isActionWhitelisted(swapFeeSetter.address)).to.be.true
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
      expect(await wallet.feeCollector()).to.be.equal(feeCollector)
    })

    it('sets a swap fee', async () => {
      const swapFee = await wallet.swapFee()

      expect(swapFee.pct).to.be.equal(fp(0.02))
      expect(swapFee.cap).to.be.equal(fp(4))
      expect(swapFee.token).to.be.equal(WETH)
      expect(swapFee.period).to.be.equal(YEAR)
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
      expect(await wallet.priceOracle()).to.be.equal(mimic.PriceOracle)
    })

    it('sets a swap connector', async () => {
      expect(await wallet.swapConnector()).to.be.equal(mimic.SwapConnector)
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
            'setWallet',
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

    it('has the proper wallet set', async () => {
      expect(await withdrawer.wallet()).to.be.equal(wallet.address)
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
            'setWallet',
            'setLimits',
            'setRelayer',
            'setMaxSlippage',
            'setSwapSigner',
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

    it('has the proper wallet set', async () => {
      expect(await erc20Claimer.wallet()).to.be.equal(wallet.address)
    })

    it('sets the expected fee claimer params', async () => {
      expect(await erc20Claimer.maxSlippage()).to.be.equal(fp(0.05))
      expect(await erc20Claimer.swapSigner()).to.be.equal(swapSigner)
      expect(await erc20Claimer.feeClaimer()).to.be.equal(feeClaimer.address)
    })

    it('sets the expected token threshold params', async () => {
      expect(await erc20Claimer.thresholdToken()).to.be.equal(WETH)
      expect(await erc20Claimer.thresholdAmount()).to.be.equal(fp(0.3))
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
            'setWallet',
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

    it('has the proper wallet set', async () => {
      expect(await nativeClaimer.wallet()).to.be.equal(wallet.address)
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
      expect(await nativeClaimer.thresholdToken()).to.be.equal(WETH)
      expect(await nativeClaimer.thresholdAmount()).to.be.equal(fp(0.3))
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
      let bot: SignerWithAddress, weth: Contract

      before('load accounts', async () => {
        bot = await impersonate(relayers[0])
        weth = await instanceAt(
          '@mimic-fi/v2-wallet/artifacts/contracts/IWrappedNativeToken.sol/IWrappedNativeToken',
          WETH
        )
      })

      it('can claim ETH when passing the threshold', async () => {
        const previousWalletBalance = await weth.balanceOf(wallet.address)
        const previousFeeCollectorBalance = await weth.balanceOf(feeCollector)

        await bot.sendTransaction({ to: feeClaimer.address, value: fp(0.15) })
        await expect(nativeClaimer.connect(bot).call(NATIVE_TOKEN_ADDRESS)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')

        await bot.sendTransaction({ to: feeClaimer.address, value: fp(0.15) })
        await nativeClaimer.connect(bot).call(NATIVE_TOKEN_ADDRESS)

        expect(await ethers.provider.getBalance(feeClaimer.address)).to.be.equal(0)

        const currentFeeCollectorBalance = await weth.balanceOf(feeCollector)
        const relayedCost = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
        const currentWalletBalance = await weth.balanceOf(wallet.address)
        const expectedWrappedBalance = fp(0.3).sub(relayedCost)
        expect(currentWalletBalance).to.be.equal(previousWalletBalance.add(expectedWrappedBalance))
      })

      it('can claim WETH when passing the threshold', async () => {
        const previousWalletBalance = await weth.balanceOf(wallet.address)
        const previousFeeCollectorBalance = await weth.balanceOf(feeCollector)

        await weth.connect(bot).deposit({ value: fp(0.3) })
        await weth.connect(bot).transfer(feeClaimer.address, fp(0.15))
        await expect(nativeClaimer.connect(bot).call(WETH)).to.be.revertedWith('MIN_THRESHOLD_NOT_MET')

        await weth.connect(bot).transfer(feeClaimer.address, fp(0.15))
        await nativeClaimer.connect(bot).call(WETH)

        expect(await weth.balanceOf(feeClaimer.address)).to.be.equal(0)

        const currentFeeCollectorBalance = await weth.balanceOf(feeCollector)
        const relayedCost = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
        const currentWalletBalance = await weth.balanceOf(wallet.address)
        const expectedWrappedBalance = fp(0.3).sub(relayedCost)
        expect(currentWalletBalance).to.be.equal(previousWalletBalance.add(expectedWrappedBalance))
      })
    })
  })

  describe('swap fee setter', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(swapFeeSetter, [
        {
          name: 'owner',
          account: owner,
          roles: ['authorize', 'unauthorize', 'setWallet', 'setRelayer', 'setLimits', 'setTimeLock', 'call'],
        },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'erc20Claimer', account: erc20Claimer, roles: [] },
        { name: 'nativeClaimer', account: nativeClaimer, roles: [] },
        { name: 'swapFeeSetter', account: swapFeeSetter, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper wallet set', async () => {
      expect(await swapFeeSetter.wallet()).to.be.equal(wallet.address)
    })

    it('sets the expected gas limits', async () => {
      expect(await swapFeeSetter.gasPriceLimit()).to.be.equal(bn(100e9))
      expect(await swapFeeSetter.totalCostLimit()).to.be.equal(0)
      expect(await swapFeeSetter.payingGasToken()).to.be.equal(WETH)
    })

    it('sets the expected fees', async () => {
      const fee0 = await swapFeeSetter.fees(0)
      expect(fee0.pct).to.be.equal(fp(0.05))
      expect(fee0.cap).to.be.equal(fp(100))
      expect(fee0.token).to.be.equal(WETH)
      expect(fee0.period).to.be.equal(YEAR)

      const fee1 = await swapFeeSetter.fees(1)
      expect(fee1.pct).to.be.equal(fp(0.1))
      expect(fee1.cap).to.be.equal(fp(200))
      expect(fee1.token).to.be.equal(WETH)
      expect(fee1.period).to.be.equal(YEAR)

      const fee2 = await swapFeeSetter.fees(2)
      expect(fee2.pct).to.be.equal(fp(0.15))
      expect(fee2.cap).to.be.equal(fp(300))
      expect(fee2.token).to.be.equal(WETH)
      expect(fee2.period).to.be.equal(YEAR)
    })

    it('sets the expected time-lock', async () => {
      expect(await swapFeeSetter.period()).to.be.equal(MONTH)
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
        bot = await impersonate(relayers[0], fp(10))
        weth = await instanceAt(
          '@mimic-fi/v2-wallet/artifacts/contracts/IWrappedNativeToken.sol/IWrappedNativeToken',
          WETH
        )
      })

      it('can set multiple swap fees', async () => {
        await weth.connect(bot).deposit({ value: fp(1) })
        await weth.connect(bot).transfer(wallet.address, fp(1))

        await swapFeeSetter.connect(bot).call()
        const swapFee0 = await wallet.swapFee()
        expect(swapFee0.pct).to.be.equal(fp(0.05))
        expect(swapFee0.cap).to.be.equal(fp(100))
        expect(swapFee0.token).to.be.equal(WETH)
        expect(swapFee0.period).to.be.equal(YEAR)

        await expect(swapFeeSetter.connect(bot).call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
        await advanceTime(MONTH)

        await swapFeeSetter.connect(bot).call()
        const swapFee1 = await wallet.swapFee()
        expect(swapFee1.pct).to.be.equal(fp(0.1))
        expect(swapFee1.cap).to.be.equal(fp(200))
        expect(swapFee1.token).to.be.equal(WETH)
        expect(swapFee1.period).to.be.equal(YEAR)

        await expect(swapFeeSetter.connect(bot).call()).to.be.revertedWith('TIME_LOCK_NOT_EXPIRED')
        await advanceTime(MONTH)

        await swapFeeSetter.connect(bot).call()
        const swapFee2 = await wallet.swapFee()
        expect(swapFee2.pct).to.be.equal(fp(0.15))
        expect(swapFee2.cap).to.be.equal(fp(300))
        expect(swapFee2.token).to.be.equal(WETH)
        expect(swapFee2.period).to.be.equal(YEAR)

        await expect(swapFeeSetter.connect(bot).call()).to.be.revertedWith('FEE_CONFIGS_ALREADY_EXECUTED')
        await advanceTime(MONTH)
        await expect(swapFeeSetter.connect(bot).call()).to.be.revertedWith('FEE_CONFIGS_ALREADY_EXECUTED')
      })
    })
  })
})
