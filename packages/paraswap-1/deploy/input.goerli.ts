import { bn, fp, MONTH, YEAR, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const WETH = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'

const accounts = {
  owner: '0x82109Cc00922A515D5FA14eE05a6880c6FAB5E19',
  managers: [],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'],
  swapSigner: '0x6278c27CF5534F07fA8f1Ab6188a155cb8750FFA',
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
}

const mimic = {
  Deployer: '0xB772E8820aa23DdBABB445380BFD67a10A6047bA',
  Registry: '0x578D1B18433650a2c0CA5aea6456AE0F5aD465dc',
  SmartVault: '0xcAAD3df06e9Ccb30e5dD07A79336A50dE1561FB5',
  PriceOracle: '0x62dcBAf369B3c5371cFDAf169479Aee6B458a6a3',
  SwapConnector: '0x3a0dd8D2495bCFF8130aAA00A952A7E1D2e86F39',
}

export default {
  accounts,
  mimic,
  params: {
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
        recipient: accounts.owner,
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
