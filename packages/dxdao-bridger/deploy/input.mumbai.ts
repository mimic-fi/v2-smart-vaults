import { bn, fp, HOUR, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x6D4dd09982853F08d9966aC3cA4Eb5885F16f2b2'
const WETH = '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa'
const WMATIC = '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889'
const FEED_MOCK_ORACLE_MATIC_USD = '0x1ECC4534D0296F7C35971534B3Ea2b6D5DDc2E26' // custom price feed mock

const HOP_USDC_AMM = '0xa81D244A1814468C734E5b4101F7b9c0c577a8fC'
const HOP_WETH_AMM = '0x0e0E3d2C5c292161999474247956EF542caBF8dd'

const accounts = {
  owner: '0xfA750bC41D438f8426E1951AE3529dd360eAE835', // personal account
  managers: [],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'], // mimic bot
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
}

const mimic = {
  Deployer: '0x67ce4712c7F4d404FcD98666C9491d415904887F',
  Registry: '0x53D627B1a2993139b32d5dF209A94498d691f21A',
  SmartVaultsFactory: undefined,
  SmartVault: '0xC9BcD31d993dA02b1907Bd9B9cfB2BC3C9387CD6',
  SwapConnector: '0xB4faF745759b5E1C8eBb84f825748Eeb12ae71d6',
  BridgeConnector: '0x6c68789bD9652779845F2bE0E1d878409c472bAd',
  PriceOracle: '0x80d62Efd16386582422391bd7eFDb8398a5B7996',
  Create3Factory: '0x440c0e5F3bed5D9eB2e7Ba620225d86548c29D08',
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
      priceFeedParams: [{ base: WMATIC, quote: USDC, feed: FEED_MOCK_ORACLE_MATIC_USD }],
      priceOracle: mimic.PriceOracle,
      swapConnector: mimic.SwapConnector,
      bridgeConnector: mimic.BridgeConnector,
      swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      bridgeFee: { pct: fp(0.002), cap: 0, token: ZERO_ADDRESS, period: 0 },
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
        payingGasToken: USDC,
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
      destinationChainId: 5, // ethereum goerli
      hopAmmParams: [
        { token: USDC, amm: HOP_USDC_AMM },
        { token: WETH, amm: HOP_WETH_AMM },
      ],
      tokenThresholdActionParams: {
        amount: toUSDC(0.5),
        token: USDC,
      },
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(100e9),
        totalCostLimit: 0,
        payingGasToken: USDC,
        permissiveModeAdmin: accounts.feeCollector,
        setPermissiveMode: false,
      },
    },
  },
}
