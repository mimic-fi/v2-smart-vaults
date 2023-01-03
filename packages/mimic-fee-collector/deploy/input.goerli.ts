import { fp, HOUR, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const CHAINLINK_ORACLE_ETH_USD = '0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e'

const HOP_ETH_BRIDGE = '0xb8901acB165ed027E32754E0FFe830802919727f'
const HOP_USDC_BRIDGE = '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a'

const accounts = {
  bot: '0xB3AfB6DB38a8E72905165c1fBB96772e63560790', // mimic bot
  owner: '0xB3AfB6DB38a8E72905165c1fBB96772e63560790', // mimic bot
  managers: ['0xfA750bC41D438f8426E1951AE3529dd360eAE835'], // personal account
}

const mimic = {
  Deployer: '0x67ce4712c7F4d404FcD98666C9491d415904887F',
  Registry: '0x53D627B1a2993139b32d5dF209A94498d691f21A',
  SmartVaultsFactory: undefined,
  SmartVault: '0x4Ad219E160858C94b75Cea06378fD3Bb916BA40B',
  SwapConnector: '0xB4faF745759b5E1C8eBb84f825748Eeb12ae71d6',
  BridgeConnector: '0x6c68789bD9652779845F2bE0E1d878409c472bAd',
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
      factory: mimic.SmartVaultsFactory,
      impl: mimic.SmartVault,
      admin: accounts.owner,
      feeCollector: ZERO_ADDRESS,
      strategies: [],
      priceFeedParams: [{ base: WETH, quote: USDC, feed: CHAINLINK_ORACLE_ETH_USD }],
      priceOracle: mimic.PriceOracle,
      swapConnector: mimic.SwapConnector,
      bridgeConnector: mimic.BridgeConnector,
      swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      bridgeFee: { pct: fp(0), cap: 0, token: ZERO_ADDRESS, period: 0 },
      withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
    },
    funderActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      minBalance: fp(0.3),
      maxBalance: fp(2),
      maxSlippage: fp(0.001),
      withdrawalActionParams: {
        recipient: accounts.bot,
      },
    },
    holderActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      maxSlippage: fp(0.002),
      tokenOut: USDC,
      tokenThresholdActionParams: {
        amount: toUSDC(5),
        token: USDC,
      },
    },
    l1HopBridgerActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      maxDeadline: 2 * HOUR,
      maxSlippage: fp(0.002), // 0.2 %
      hopRelayerParams: [], // no relayer fees
      allowedChainIds: [80001], // mumbai
      hopBridgeParams: [
        { token: USDC, bridge: HOP_USDC_BRIDGE },
        { token: WETH, bridge: HOP_ETH_BRIDGE },
      ],
      tokenThresholdActionParams: {
        amount: toUSDC(5),
        token: USDC,
      },
    },
  },
}
