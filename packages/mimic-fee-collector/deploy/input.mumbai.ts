import { fp, HOUR, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83'
const WETH = '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1'

const HOP_USDC_AMM = '0x76b22b8C1079A44F1211D867D68b1eda76a635A7'
const HOP_WETH_AMM = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'

const accounts = {
  owner: '0xB3AfB6DB38a8E72905165c1fBB96772e63560790', // mimic bot
  managers: [],
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
  namespace: 'mimic-v2.mimic-fee-collector',
  accounts,
  mimic,
  params: {
    registry: mimic.Registry,
    smartVaultParams: {
      impl: mimic.SmartVault,
      admin: accounts.owner,
      feeCollector: ZERO_ADDRESS,
      strategies: [],
      priceFeedParams: [],
      priceOracle: mimic.PriceOracle,
      swapConnector: mimic.SwapConnector,
      bridgeConnector: mimic.BridgeConnector,
      swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      bridgeFee: { pct: fp(0), cap: 0, token: ZERO_ADDRESS, period: 0 },
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
        amount: toUSDC(500),
        token: USDC,
      },
    },
  },
}
