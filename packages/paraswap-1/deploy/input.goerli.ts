import { bn, fp, MONTH, YEAR, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const WETH = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'

const accounts = {
  mimic: '0x495dD9E4784C207Ec9f4f426F204C73916d5b7A9',
  owner: '0x82109Cc00922A515D5FA14eE05a6880c6FAB5E19',
  managers: [],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'],
  swapSigner: '0x6278c27CF5534F07fA8f1Ab6188a155cb8750FFA',
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
      priceFeedParams: [],
      priceOracle: mimic.PriceOracle,
      swapConnector: mimic.SwapConnector,
      swapFee: { pct: fp(0.02), cap: fp(4), token: WETH, period: YEAR },
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
      maxSlippage: fp(0.05),
      tokenSwapIgnores: ['0xcafe001067cdef266afb7eb5a286dcfd277f3de5'], // PSP
      feeClaimerParams: {
        feeClaimer: undefined,
        tokenThresholdActionParams: {
          token: WETH,
          amount: fp(0.3),
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
        feeClaimer: undefined,
        tokenThresholdActionParams: {
          token: WETH,
          amount: fp(0.3),
        },
        relayedActionParams: {
          relayers: accounts.relayers,
          gasPriceLimit: bn(100e9),
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
        { pct: fp(0.05), cap: fp(100), token: WETH, period: YEAR },
        { pct: fp(0.1), cap: fp(200), token: WETH, period: YEAR },
        { pct: fp(0.15), cap: fp(300), token: WETH, period: YEAR },
      ],
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
  },
}
