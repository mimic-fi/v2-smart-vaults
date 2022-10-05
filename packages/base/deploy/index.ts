import { deploy, getSigner } from '@mimic-fi/v2-helpers'

import { ARTIFACTS } from '../src/setup'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-unused-vars */

export default async (input: any, writeOutput: (key: string, value: string) => void): Promise<void> => {
  const deployer = await deploy('Deployer')
  writeOutput('Deployer', deployer.address)

  const admin = await getSigner()
  const registry = await deploy(ARTIFACTS.REGISTRY, [admin.address])
  writeOutput('Registry', registry.address)

  const wallet = await deploy(ARTIFACTS.WALLET, [input.wrappedNativeToken, registry.address])
  await registry.connect(admin).register(await wallet.NAMESPACE(), wallet.address, false)
  writeOutput('Wallet', wallet.address)

  const smartVault = await deploy(ARTIFACTS.SMART_VAULT, [registry.address])
  await registry.connect(admin).register(await smartVault.NAMESPACE(), smartVault.address, false)
  writeOutput('SmartVault', smartVault.address)

  const priceOracle = await deploy(ARTIFACTS.PRICE_ORACLE, [input.wrappedNativeToken, registry.address])
  await registry.connect(admin).register(await priceOracle.NAMESPACE(), priceOracle.address, true)
  writeOutput('PriceOracle', priceOracle.address)

  const swapConnector = await deploy(ARTIFACTS.SWAP_CONNECTOR, [
    input.uniswapV3Router,
    input.uniswapV2Router,
    input.balancerV2Vault,
    input.paraswapV5Augustus,
    registry.address,
  ])
  await registry.connect(admin).register(await swapConnector.NAMESPACE(), swapConnector.address, true)
  writeOutput('SwapConnector', swapConnector.address)
}
