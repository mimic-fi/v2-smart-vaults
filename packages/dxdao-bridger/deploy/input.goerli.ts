import { bn, fp, HOUR, toUSDC, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0x98339D8C260052B7ad81c28c16C0b98420f2B46a'
const WETH = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'
const CHAINLINK_ORACLE_ETH_USD = '0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e'

const HOP_ETH_BRIDGE = '0xC8A4FB931e8D77df8497790381CA7d228E68a41b'
const HOP_USDC_BRIDGE = '0x7D269D3E0d61A05a0bA976b7DBF8805bF844AF3F'

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
  SmartVault: '0x4Ad219E160858C94b75Cea06378fD3Bb916BA40B',
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
      priceFeedParams: [{ base: WETH, quote: USDC, feed: CHAINLINK_ORACLE_ETH_USD }],
      priceOracle: mimic.PriceOracle,
      swapConnector: mimic.SwapConnector,
      bridgeConnector: mimic.BridgeConnector,
      swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      bridgeFee: { pct: fp(0.002), cap: 0, token: ZERO_ADDRESS, period: 0 },
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
      destinationChainId: 80001, // mumbai
      hopBridgeParams: [
        { token: USDC, bridge: HOP_USDC_BRIDGE },
        { token: WETH, bridge: HOP_ETH_BRIDGE },
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
