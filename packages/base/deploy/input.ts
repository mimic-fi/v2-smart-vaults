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
    oneInchV5Router: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    wrappedNativeToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    priceOraclePivot: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  },
  polygon: {
    namespace: 'mimic-v2',
    admin: '0x82109Cc00922A515D5FA14eE05a6880c6FAB5E19',
    uniswapV2Router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    balancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    paraswapV5Augustus: '0xdef171fe48cf0115b1d80b88dc8eab59176fee57',
    oneInchV5Router: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    wrappedNativeToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // wMATIC
    priceOraclePivot: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
  },
  goerli: {
    namespace: 'mimic-v2',
    admin: '0x82109Cc00922A515D5FA14eE05a6880c6FAB5E19',
    uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    balancerV2Vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    paraswapV5Augustus: ZERO_ADDRESS,
    oneInchV5Router: ZERO_ADDRESS,
    wrappedNativeToken: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
    priceOraclePivot: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', // WETH
  },
  mumbai: {
    namespace: 'mimic-v2',
    admin: '0x82109Cc00922A515D5FA14eE05a6880c6FAB5E19',
    uniswapV2Router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    balancerV2Vault: ZERO_ADDRESS,
    paraswapV5Augustus: ZERO_ADDRESS,
    oneInchV5Router: ZERO_ADDRESS,
    wrappedNativeToken: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889', // wMATIC
    priceOraclePivot: '0xa6fa4fb5f76172d178d61b04b0ecd319c5d1c0aa', // WETH
  },
}
