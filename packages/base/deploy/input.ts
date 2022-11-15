import { ZERO_ADDRESS } from '@mimic-fi/v2-helpers'

/* eslint-disable no-secrets/no-secrets */

export default {
  mainnet: {
    namespace: 'mimic-v2',
    admin: '0x82109Cc00922A515D5FA14eE05a6880c6FAB5E19',
    uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    balancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    paraswapV5Augustus: '0xdef171fe48cf0115b1d80b88dc8eab59176fee57',
    wrappedNativeToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  goerli: {
    namespace: 'mimic-v2',
    admin: '0x82109Cc00922A515D5FA14eE05a6880c6FAB5E19',
    uniswapV2Router: ZERO_ADDRESS,
    uniswapV3Router: ZERO_ADDRESS,
    balancerV2Vault: ZERO_ADDRESS,
    paraswapV5Augustus: ZERO_ADDRESS,
    wrappedNativeToken: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
  },
}
