import { bn, fp, HOUR, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83'
const WETH = '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1'
const WXDAI = '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d'
const CHAINLINK_ORACLE_ETH_USD = '0xa767f745331D267c7751297D982b050c93985627'

const HOP_USDC_AMM = '0x76b22b8C1079A44F1211D867D68b1eda76a635A7'
const HOP_WETH_AMM = '0x03D7f750777eC48d39D080b020D83Eb2CB4e3547'

const accounts = {
  owner: '0x519b70055af55A007110B4Ff99b0eA33071c720a', // DXdao
  managers: [],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'], // mimic bot
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
}

const mimic = {
  Deployer: undefined,
  Registry: undefined,
  SmartVaultsFactory: undefined,
  SmartVault: undefined,
  PriceOracle: undefined,
  SwapConnector: undefined,
  BridgeConnector: undefined,
  Create3Factory: undefined,
}

export default {
  namespace: 'mimic-v2.dxdao-bridger',
  accounts,
  mimic,
  params: {
    registry: mimic.Registry,
    smartVaultParams: {
      factory: mimic.SmartVaultsFactory,
      impl: mimic.SmartVault,
      admin: accounts.owner,
      feeCollector: accounts.feeCollector,
      strategies: [],
      priceFeedParams: [
        { base: WETH, quote: USDC, feed: CHAINLINK_ORACLE_ETH_USD },
        { base: WETH, quote: WXDAI, feed: CHAINLINK_ORACLE_ETH_USD },
      ],
      priceOracle: mimic.PriceOracle,
      swapConnector: mimic.SwapConnector,
      bridgeConnector: mimic.BridgeConnector,
      swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      bridgeFee: { pct: fp(0.005), cap: 0, token: ZERO_ADDRESS, period: 0 },
      withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
    },
    l2HopSwapperActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      maxSlippage: fp(0.002), // 0.2 %
      hopAmmParams: [
        { token: USDC, amm: HOP_USDC_AMM },
        { token: WETH, amm: HOP_WETH_AMM },
      ],
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(100e9),
        totalCostLimit: 0,
        payingGasToken: WETH,
        permissiveModeAdmin: accounts.feeCollector,
        setPermissiveMode: false,
      },
    },
    l2HopBridgerActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      maxDeadline: 2 * HOUR,
      maxSlippage: fp(0.002), // 0.2 %
      maxBonderFeePct: fp(0.03), // 3 %
      destinationChainId: 1, // ethereum mainnet
      hopAmmParams: [
        { token: USDC, amm: HOP_USDC_AMM },
        { token: WETH, amm: HOP_WETH_AMM },
      ],
      tokenThresholdActionParams: {
        amount: toUSDC(500),
        token: USDC,
      },
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(100e9),
        totalCostLimit: 0,
        payingGasToken: WETH,
        permissiveModeAdmin: accounts.feeCollector,
        setPermissiveMode: false,
      },
    },
  },
}
