import { bn, fp, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const dxDAO = {
  owner: '0x519b70055af55a007110b4ff99b0ea33071c720a',
  managers: [],
}

const mimic = {
  bot: '0xB3AfB6DB38a8E72905165c1fBB96772e63560790',
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
  Deployer: '',
  Registry: '',
  Wallet: '',
  PriceOracle: '',
  SmartVault: '',
}

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const CHAIN_LINK_DAI_WETH = '0x773616E4d11A78F511299002da57A0a94577F1f4'

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
        priceFeedParams: [{ base: DAI, quote: WETH, feed: CHAIN_LINK_DAI_WETH }],
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
        amount: fp(200),
        token: DAI,
      },
      withdrawalActionParams: {
        recipient: dxDAO.owner,
      },
    },
  },
}
