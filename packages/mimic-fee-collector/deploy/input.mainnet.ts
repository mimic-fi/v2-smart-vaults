import { fp, HOUR, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const CHAINLINK_ORACLE_USDC_ETH = '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'

const HOP_ETH_BRIDGE = '0xb8901acB165ed027E32754E0FFe830802919727f'
const HOP_USDC_BRIDGE = '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a'

const accounts = {
  owner: '0xB3AfB6DB38a8E72905165c1fBB96772e63560790', // mimic bot
  managers: [],
}

const mimic = {
  Deployer: undefined,
  Registry: '0x53D627B1a2993139b32d5dF209A94498d691f21A',
  SmartVault: undefined,
  SwapConnector: '0x14DBba98CB43348497cC9526848955313cb4808a',
  BridgeConnector: undefined,
  PriceOracle: '0x80d62Efd16386582422391bd7eFDb8398a5B7996',
  Create3Factory: '0x440c0e5F3bed5D9eB2e7Ba620225d86548c29D08',
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
      priceFeedParams: [{ base: USDC, quote: WETH, feed: CHAINLINK_ORACLE_USDC_ETH }],
      priceOracle: mimic.PriceOracle,
      swapConnector: mimic.SwapConnector,
      bridgeConnector: mimic.BridgeConnector,
      swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      bridgeFee: { pct: fp(0), cap: 0, token: ZERO_ADDRESS, period: 0 },
      withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
    },
    l1HopBridgerActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      maxDeadline: 2 * HOUR,
      maxSlippage: fp(0.002), // 0.2 %
      hopRelayerParams: [], // no relayer fees
      allowedChainIds: [100], // gnosis chain
      hopAmmParams: [
        { token: USDC, amm: HOP_USDC_BRIDGE },
        { token: WETH, amm: HOP_ETH_BRIDGE },
      ],
      tokenThresholdActionParams: {
        amount: toUSDC(500),
        token: USDC,
      },
    },
  },
}
