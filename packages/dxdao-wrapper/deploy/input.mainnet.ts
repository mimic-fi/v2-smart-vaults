import { bn, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const CHAINLINK_ORACLE_USDC_ETH = '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'

const accounts = {
  owner: '0x519b70055af55A007110B4Ff99b0eA33071c720a',
  managers: ['0x8E900Cf9BD655e34bb610f0Ef365D8d476fD7337', '0x91628ddc3A6ff9B48A2f34fC315D243eB07a9501'],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'],
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
}

const mimic = {
  Deployer: '0xc744f93c24BbA10080C7cF3C23eE6D50ef6DA37A',
  Registry: '0x53D627B1a2993139b32d5dF209A94498d691f21A',
  SmartVault: '0xee9ed4171C011eAaA2C17051081e3ce62E9e8D7e',
  PriceOracle: '0x80d62Efd16386582422391bd7eFDb8398a5B7996',
  Create3Factory: '0x440c0e5F3bed5D9eB2e7Ba620225d86548c29D08',
}

export default {
  namespace: 'mimic-v2.dxdao-sv1',
  accounts,
  mimic,
  params: {
    registry: mimic.Registry,
    smartVaultParams: {
      impl: mimic.SmartVault,
      admin: accounts.owner,
      feeCollector: accounts.feeCollector,
      strategies: [],
      priceFeedParams: [{ base: USDC, quote: WETH, feed: CHAINLINK_ORACLE_USDC_ETH }],
      priceOracle: mimic.PriceOracle,
      swapConnector: ZERO_ADDRESS,
      swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
    },
    wrapperActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(50e9),
        totalCostLimit: 0,
        payingGasToken: WETH,
      },
      tokenThresholdActionParams: {
        amount: bn(200e6),
        token: USDC,
      },
      withdrawalActionParams: {
        recipient: accounts.owner,
      },
    },
  },
}
