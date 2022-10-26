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
  Deployer: '0x9d085d66dA25A4854Dd769b3780CeAB2cB7CfB94',
  Registry: '0x089849373fe735FDe9CAb7a7591cc2630919131b',
  Wallet: '0x24E4A0d5368a1844F621ee00AF9f56d5Bcfc15FF',
  SmartVault: '0xDe370a1a422d15E045B06E27B184BBd0Debad159',
  PriceOracle: '0x4c983EE7055048deAD3C3a44a369c5d7E1803467',
  SwapConnector: '0x710839e6Fc6F9c584BbD186Aa2733E0317c43415',
}

export default {
  accounts,
  mimic,
  params: {
    registry: mimic.Registry,
    smartVaultParams: {
      impl: mimic.SmartVault,
      admin: accounts.owner,
      walletParams: {
        impl: mimic.Wallet,
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
  },
}
