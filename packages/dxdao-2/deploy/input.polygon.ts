import { bn, fp, HOUR, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const WETH = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
const WMATIC = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
const CHAINLINK_ORACLE_USDC_ETH = '0xefb7e6be8356ccc6827799b6a7348ee674a80eae'
const CHAINLINK_ORACLE_MATIC_ETH = '0x327e23a4855b6f663a28c5161541d69af8973302'

const HOP_USDC_AMM = '0x76b22b8C1079A44F1211D867D68b1eda76a635A7'
const HOP_WETH_AMM = '0xc315239cFb05F1E130E7E28E603CEa4C014c57f0'

const accounts = {
  owner: '0xB3AfB6DB38a8E72905165c1fBB96772e63560790', // mimic bot
  managers: [],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'], // mimic bot
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
}

const mimic = {
  Deployer: undefined,
  Registry: undefined,
  SmartVault: undefined,
  PriceOracle: undefined,
  SwapConnector: undefined,
  BridgeConnector: undefined,
  Create3Factory: undefined,
}

export default {
  namespace: 'mimic-v2.dxdao-sv2-beta',
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
        { base: USDC, quote: WETH, feed: CHAINLINK_ORACLE_USDC_ETH },
        { base: WMATIC, quote: WETH, feed: CHAINLINK_ORACLE_MATIC_ETH },
      ],
      priceOracle: mimic.PriceOracle,
      swapConnector: mimic.SwapConnector,
      bridgeConnector: mimic.BridgeConnector,
      swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      bridgeFee: { pct: fp(0.005), cap: 0, token: ZERO_ADDRESS, period: 0 },
      withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
    },
    l2HopBridgerActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      maxDeadline: 2 * HOUR,
      maxSlippage: fp(0.002), // 0.2 %
      maxBonderFeePct: fp(0.03), // 3 %
      allowedChainIds: [1], // ethereum mainnet
      hopAmmParams: [
        { token: USDC, amm: HOP_USDC_AMM },
        { token: WETH, amm: HOP_WETH_AMM },
      ],
      tokenThresholdActionParams: {
        amount: bn(5e6),
        token: USDC,
      },
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(100e9),
        totalCostLimit: 0,
        payingGasToken: WMATIC,
        permissiveModeAdmin: accounts.feeCollector,
        setPermissiveMode: false,
      },
    },
  },
}
