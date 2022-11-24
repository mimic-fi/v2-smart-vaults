import { bn, fp, getForkedNetwork, impersonate, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { assertPermissions, deployment } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { defaultAbiCoder } from 'ethers/lib/utils'
import hre from 'hardhat'

/* eslint-disable no-secrets/no-secrets */

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const MANA = '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const CHAINLINK_ORACLE_DAI_ETH = '0x773616E4d11A78F511299002da57A0a94577F1f4'
const CHAINLINK_ORACLE_MANA_ETH = '0x82A44D92D6c329826dc557c5E1Be6ebeC5D5FeB9'

const WHALE = '0x9A6ebE7E2a7722F8200d0ffB63a1F6406A0d7dce'

describe('SmartVault', () => {
  let smartVault: Contract, mimic: { [key: string]: string }
  let withdrawer: Contract, swapper: Contract
  let owner: string, relayers: string[], managers: string[], feeCollector: string

  before('load accounts', async () => {
    const input = await deployment.readInput(getForkedNetwork(hre))
    mimic = input.mimic
    owner = input.accounts.owner
    relayers = input.accounts.relayers
    managers = input.accounts.managers
    feeCollector = input.accounts.feeCollector
  })

  before('deploy smart vault', async () => {
    const output = await deployment.deploy(getForkedNetwork(hre), 'test')
    smartVault = await instanceAt('SmartVault', output.SmartVault)
    swapper = await instanceAt('Swapper', output.Swapper)
    withdrawer = await instanceAt('Withdrawer', output.Withdrawer)
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
        { name: 'feeCollector', account: feeCollector, roles: ['setFeeCollector'] },
        { name: 'swapper', account: swapper, roles: ['swap', 'withdraw'] },
        { name: 'withdrawer', account: withdrawer, roles: ['withdraw'] },
        { name: 'managers', account: managers, roles: [] },
        { name: 'relayers', account: relayers, roles: [] },
      ])
    })

    it('sets a fee collector', async () => {
      expect(await smartVault.feeCollector()).to.be.equal(feeCollector)
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
      expect(await smartVault.priceOracle()).to.be.equal(mimic.PriceOracle)
    })

    it('sets a swap connector', async () => {
      expect(await smartVault.swapConnector()).to.be.equal(mimic.SwapConnector)
    })

    it('sets a price feed for WETH-DAI', async () => {
      expect(await smartVault.getPriceFeed(DAI, WETH)).to.be.equal(CHAINLINK_ORACLE_DAI_ETH)
      expect(await smartVault.getPriceFeed(MANA, WETH)).to.be.equal(CHAINLINK_ORACLE_MANA_ETH)
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
        { name: 'swapper', account: swapper, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
        { name: 'managers', account: managers, roles: ['call'] },
        { name: 'relayers', account: relayers, roles: ['call'] },
      ])
    })

    it('has the proper smart vault set', async () => {
      expect(await swapper.smartVault()).to.be.equal(smartVault.address)
    })

    it('sets the expected swapper params', async () => {
      expect(await swapper.tokenIn()).to.be.equal(MANA)
      expect(await swapper.tokenOut()).to.be.equal(DAI)
      expect(await swapper.maxSlippage()).to.be.equal(fp(0.001))
    })

    it('sets the expected threshold', async () => {
      expect(await swapper.thresholdToken()).to.be.equal(MANA)
      expect(await swapper.thresholdAmount()).to.be.equal(fp(10))
    })

    it('sets the expected gas limits', async () => {
      expect(await swapper.gasPriceLimit()).to.be.equal(bn(50e9))
      expect(await swapper.totalCostLimit()).to.be.equal(0)
      expect(await swapper.payingGasToken()).to.be.equal(DAI)
    })

    it('whitelists the requested relayers', async () => {
      for (const relayer of relayers) {
        expect(await swapper.isRelayer(relayer)).to.be.true
      }
    })

    it('does not whitelist managers as relayers', async () => {
      for (const manager of managers) {
        expect(await swapper.isRelayer(manager)).to.be.false
      }
    })

    describe('call', async () => {
      let bot: SignerWithAddress, mana: Contract, dai: Contract, whale: SignerWithAddress

      const source = 1 // uniswap v3
      const amountIn = fp(20)
      const slippage = fp(0.02) // 2 %
      const data = defaultAbiCoder.encode(['address[]', 'uint24[]'], [[WETH], [3000, 500]])

      before('allow larger slippage', async () => {
        const signer = await impersonate(owner)
        await swapper.connect(signer).setMaxSlippage(slippage)
      })

      before('load accounts', async () => {
        bot = await impersonate(relayers[0], fp(10))
        dai = await instanceAt('IERC20Metadata', DAI)
        mana = await instanceAt('IERC20Metadata', MANA)
        whale = await impersonate(WHALE, fp(100))
      })

      it('can swap MANA when passing the threshold', async () => {
        const previousSmartVaultBalance = await dai.balanceOf(smartVault.address)
        const previousFeeCollectorBalance = await dai.balanceOf(feeCollector)

        await mana.connect(whale).transfer(smartVault.address, amountIn)
        await swapper.connect(bot).call(source, slippage, data)

        const currentFeeCollectorBalance = await dai.balanceOf(feeCollector)
        const relayedCost = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
        const price = await smartVault.getPrice(MANA, DAI)
        const expectedAmountOut = amountIn.mul(price).div(fp(1))
        const expectedMinAmountOut = expectedAmountOut.sub(expectedAmountOut.mul(slippage).div(fp(1)))
        const expectedReceivedAmount = expectedMinAmountOut.sub(relayedCost)

        const currentSmartVaultBalance = await dai.balanceOf(smartVault.address)
        expect(currentSmartVaultBalance).to.be.at.least(previousSmartVaultBalance.add(expectedReceivedAmount))
      })
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
        { name: 'swapper', account: swapper, roles: [] },
        { name: 'withdrawer', account: withdrawer, roles: [] },
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

    it('sets the expected token', async () => {
      expect(await withdrawer.token()).to.be.equal(DAI)
    })

    it('sets the expected threshold', async () => {
      expect(await withdrawer.thresholdToken()).to.be.equal(DAI)
      expect(await withdrawer.thresholdAmount()).to.be.equal(fp(100))
    })

    it('sets the expected gas limits', async () => {
      expect(await withdrawer.gasPriceLimit()).to.be.equal(bn(50e9))
      expect(await withdrawer.totalCostLimit()).to.be.equal(0)
      expect(await withdrawer.payingGasToken()).to.be.equal(DAI)
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

    describe('call', async () => {
      let bot: SignerWithAddress, dai: Contract, whale: SignerWithAddress

      const amount = fp(200)

      before('load accounts', async () => {
        bot = await impersonate(relayers[0], fp(10))
        dai = await instanceAt('IERC20Metadata', DAI)
        whale = await impersonate(WHALE, fp(100))
      })

      it('can withdraw DAI when passing the threshold', async () => {
        await dai.connect(whale).transfer(smartVault.address, amount)
        const previousRecipientBalance = await dai.balanceOf(owner)
        const previousSmartVaultBalance = await dai.balanceOf(smartVault.address)
        const previousFeeCollectorBalance = await dai.balanceOf(feeCollector)

        await withdrawer.connect(bot).call()

        const currentFeeCollectorBalance = await dai.balanceOf(feeCollector)
        const relayedCost = currentFeeCollectorBalance.sub(previousFeeCollectorBalance)
        const currentRecipientBalance = await dai.balanceOf(owner)
        const expectedRecipientBalance = previousRecipientBalance.add(previousSmartVaultBalance).sub(relayedCost)
        expect(currentRecipientBalance).to.be.equal(expectedRecipientBalance)

        const currentSmartVaultBalance = await dai.balanceOf(smartVault.address)
        expect(currentSmartVaultBalance).to.be.equal(0)
      })
    })
  })
})
