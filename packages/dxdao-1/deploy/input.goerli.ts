import { bn, fp, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

const WETH = '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'

const accounts = {
  owner: '0x519b70055af55A007110B4Ff99b0eA33071c720a',
  managers: [],
  relayers: ['0xB3AfB6DB38a8E72905165c1fBB96772e63560790'],
  feeCollector: '0x27751A0Fe3bd6EBfeB04B359D97B0cf199f20D22',
}

const mimic = {
  Deployer: '0x05A0805B9080EAe3859a7fa48F47BEE102a44EeD',
  Registry: '0x1f0C19E7ba1930A4b387013952D62386a9848942',
  SmartVault: '0x6AEe9153d4cf381804443Afa4D97BeAd72B9cB13',
  PriceOracle: '0xd1CD897e685CA37F316387E91dB1c741568A7293',
  Create3Factory: '0x8088f277542e05aE2A94a85268A555A66b69d357',
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
      priceFeedParams: [],
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
        gasPriceLimit: bn(100e9),
        totalCostLimit: 0,
        payingGasToken: WETH,
      },
      tokenThresholdActionParams: {
        amount: fp(0.5),
        token: WETH,
      },
      withdrawalActionParams: {
        recipient: accounts.owner,
      },
    },
  },
}
