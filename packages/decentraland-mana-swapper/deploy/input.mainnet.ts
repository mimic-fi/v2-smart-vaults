import { bn, fp, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const MANA = '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const CHAINLINK_ORACLE_DAI_ETH = '0x773616E4d11A78F511299002da57A0a94577F1f4'
const CHAINLINK_ORACLE_MANA_ETH = '0x82A44D92D6c329826dc557c5E1Be6ebeC5D5FeB9'

const accounts = {
  owner: '0x89214c8Ca9A49E60a3bfa8e00544F384C93719b1',
  managers: [],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'],
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
}

const mimic = {
  Deployer: '0xc744f93c24BbA10080C7cF3C23eE6D50ef6DA37A',
  Registry: '0x53D627B1a2993139b32d5dF209A94498d691f21A',
  SmartVault: '0x9830218Cd5191BD66CC81d3edcCeEC1B31375AcC',
  PriceOracle: '0x80d62Efd16386582422391bd7eFDb8398a5B7996',
  SwapConnector: '0x14DBba98CB43348497cC9526848955313cb4808a',
  Create3Factory: '0x440c0e5F3bed5D9eB2e7Ba620225d86548c29D08',
}

export default {
  namespace: 'mimic-v2.decentraland-mana-swapper',
  accounts,
  mimic,
  params: {
    registry: mimic.Registry,
    smartVaultParams: {
      impl: mimic.SmartVault,
      admin: accounts.owner,
      feeCollector: accounts.feeCollector,
      strategies: [],
      priceFeedParams: [
        { base: DAI, quote: WETH, feed: CHAINLINK_ORACLE_DAI_ETH },
        { base: MANA, quote: WETH, feed: CHAINLINK_ORACLE_MANA_ETH },
      ],
      priceOracle: mimic.PriceOracle,
      swapConnector: mimic.SwapConnector,
      swapFee: { pct: fp(0.01), cap: 0, token: ZERO_ADDRESS, period: 0 },
      withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
    },
    dexSwapperActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      tokenIn: MANA,
      tokenOut: DAI,
      maxSlippage: fp(0.001), // 0.1 %
      tokenThresholdActionParams: {
        token: MANA,
        amount: fp(10),
      },
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(50e9),
        totalCostLimit: 0,
        payingGasToken: DAI,
      },
    },
    otcSwapperActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      tokenIn: DAI,
      tokenOut: MANA,
      maxSlippage: fp(0.001), // 0.1 %
      tokenThresholdActionParams: {
        token: MANA,
        amount: fp(10),
      },
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(50e9),
        totalCostLimit: 0,
        payingGasToken: DAI,
      },
    },
    withdrawerActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      token: DAI,
      withdrawalActionParams: {
        recipient: accounts.owner,
      },
      tokenThresholdActionParams: {
        token: DAI,
        amount: fp(100),
      },
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(50e9),
        totalCostLimit: 0,
        payingGasToken: DAI,
      },
    },
  },
}
