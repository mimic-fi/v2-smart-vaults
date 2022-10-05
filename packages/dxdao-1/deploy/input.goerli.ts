import { bn, fp, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const WETH = '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'

const dxDAO = {
  owner: '0x519b70055af55a007110b4ff99b0ea33071c720a',
  managers: [],
}

const mimic = {
  bot: '0xB3AfB6DB38a8E72905165c1fBB96772e63560790',
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
  Deployer: '0x9d085d66dA25A4854Dd769b3780CeAB2cB7CfB94',
  Registry: '0x089849373fe735FDe9CAb7a7591cc2630919131b',
  Wallet: '0x24E4A0d5368a1844F621ee00AF9f56d5Bcfc15FF',
  SmartVault: '0xDe370a1a422d15E045B06E27B184BBd0Debad159',
  PriceOracle: '0x4c983EE7055048deAD3C3a44a369c5d7E1803467',
}

export default {
  mimic,
  params: {
    registry: mimic.Registry,
    smartVaultParams: {
      impl: mimic.SmartVault,
      admin: dxDAO.owner,
      walletParams: {
        impl: mimic.Wallet,
        admin: dxDAO.owner,
        feeCollector: mimic.feeCollector,
        strategies: [],
        priceFeedParams: [],
        priceOracle: mimic.PriceOracle,
        swapConnector: ZERO_ADDRESS,
        swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
        performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
      },
    },
    wrapperActionParams: {
      admin: dxDAO.owner,
      managers: dxDAO.managers,
      relayedActionParams: {
        relayers: [mimic.bot],
        gasPriceLimit: bn(100e9),
        totalCostLimit: 0,
        payingGasToken: WETH,
      },
      tokenThresholdActionParams: {
        amount: fp(0.5),
        token: WETH,
      },
      withdrawalActionParams: {
        recipient: dxDAO.owner,
      },
    },
  },
}
