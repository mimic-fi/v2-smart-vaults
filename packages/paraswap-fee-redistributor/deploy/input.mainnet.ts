import { bn, fp, MONTH, YEAR, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const CHAINLINK_ORACLE_USDC_ETH = '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4'

const accounts = {
  mimic: '0x495dD9E4784C207Ec9f4f426F204C73916d5b7A9',
  owner: '0x82109Cc00922A515D5FA14eE05a6880c6FAB5E19',
  managers: [],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'],
  swapSigner: '0x6278c27CF5534F07fA8f1Ab6188a155cb8750FFA',
  feeClaimer: '0xeF13101C5bbD737cFb2bF00Bbd38c626AD6952F7',
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
}

const mimic = {
  Deployer: '0xc744f93c24BbA10080C7cF3C23eE6D50ef6DA37A',
  Registry: '0x53D627B1a2993139b32d5dF209A94498d691f21A',
  SmartVault: '0xee9ed4171C011eAaA2C17051081e3ce62E9e8D7e',
  PriceOracle: '0x80d62Efd16386582422391bd7eFDb8398a5B7996',
  SwapConnector: '0x4625C584b18dEA937985f8f3BAe8DDeAA476836e',
  Create3Factory: '0x440c0e5F3bed5D9eB2e7Ba620225d86548c29D08',
}

export default {
  namespace: 'mimic-v2.paraswap-fee-redistributor',
  accounts,
  mimic,
  params: {
    mimic: accounts.mimic,
    registry: mimic.Registry,
    smartVaultParams: {
      impl: mimic.SmartVault,
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
    withdrawerActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      withdrawalActionParams: {
        recipient: accounts.mimic,
      },
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(50e9),
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
      maxSlippage: fp(0.03),
      tokenSwapIgnores: ['0xcafe001067cdef266afb7eb5a286dcfd277f3de5'], // PSP
      feeClaimerParams: {
        feeClaimer: accounts.feeClaimer,
        tokenThresholdActionParams: {
          token: USDC,
          amount: bn(1000e6),
        },
        relayedActionParams: {
          relayers: accounts.relayers,
          gasPriceLimit: bn(50e9),
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
          gasPriceLimit: bn(50e9),
          totalCostLimit: 0,
          payingGasToken: WETH,
        },
      },
    },
    swapFeeSetterActionParams: {
      impl: undefined,
      admin: accounts.owner,
      managers: accounts.managers,
      feeParams: [
        { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        { pct: fp(0.05), cap: bn(5000e6), token: USDC, period: YEAR },
        { pct: fp(0.1), cap: bn(5000e6), token: USDC, period: YEAR },
        { pct: fp(0.2), cap: bn(5000e6), token: USDC, period: YEAR },
      ],
      relayedActionParams: {
        relayers: accounts.relayers,
        gasPriceLimit: bn(50e9),
        totalCostLimit: 0,
        payingGasToken: WETH,
      },
      timeLockedActionParams: {
        period: 3 * MONTH,
      },
    },
  },
}
