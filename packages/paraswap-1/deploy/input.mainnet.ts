import { bn, MONTH, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const CHAINLINK_ORACLE_USDC_ETH = '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'

const accounts = {
  owner: '0x82109Cc00922A515D5FA14eE05a6880c6FAB5E19',
  managers: [],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'],
  swapSigner: '0x213ec49E59E6D219Db083C2833746b5dFCad646c',
  feeClaimer: '0xeF13101C5bbD737cFb2bF00Bbd38c626AD6952F7',
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
}

const mimic = {
  Deployer: undefined,
  Registry: undefined,
  Wallet: undefined,
  SmartVault: undefined,
  PriceOracle: undefined,
  SwapConnector: undefined,
}

export default {
  accounts,
  mimic,
  params: {
    registry: mimic.Registry,
    smartVaultParams: {
      impl: mimic.SmartVault,
      admin: accounts.owner,
      walletParams: {
        impl: mimic.Wallet,
        admin: accounts.owner,
        feeCollector: accounts.feeCollector,
        strategies: [],
        priceFeedParams: [{ base: USDC, quote: WETH, feed: CHAINLINK_ORACLE_USDC_ETH }],
        priceOracle: mimic.PriceOracle,
        swapConnector: mimic.SwapConnector,
        swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      },
    },
    withdrawerActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      withdrawalActionParams: {
        recipient: accounts.owner,
      },
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(100e9),
        totalCostLimit: 0,
        payingGasToken: WETH,
      },
      timeLockedActionParams: {
        period: MONTH,
      },
    },
    erc20ClaimerActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      swapSigner: accounts.swapSigner,
      feeClaimerParams: {
        feeClaimer: accounts.feeClaimer,
        tokenThresholdActionParams: {
          token: USDC,
          amount: bn(1000e6),
        },
        relayedActionParams: {
          relayers: accounts.relayers,
          gasPriceLimit: bn(100e9),
          totalCostLimit: 0,
          payingGasToken: WETH,
        },
      },
    },
    nativeClaimerActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      feeClaimerParams: {
        feeClaimer: accounts.feeClaimer,
        tokenThresholdActionParams: {
          token: USDC,
          amount: bn(1000e6),
        },
        relayedActionParams: {
          relayers: accounts.relayers,
          gasPriceLimit: bn(100e9),
          totalCostLimit: 0,
          payingGasToken: WETH,
        },
      },
    },
  },
}
