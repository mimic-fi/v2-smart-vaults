import { deploy, getSigner } from '@mimic-fi/v2-helpers'

import { create3 } from '../src/deployment'
import { ARTIFACTS } from '../src/setup'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-unused-vars */

export default async (input: any, writeOutput: (key: string, value: string) => void): Promise<void> => {
  const admin = await getSigner(input.admin)
  const create3Factory = await deploy(ARTIFACTS.CREATE3_FACTORY)
  writeOutput('Create3Factory', create3Factory.address)

  const deployer = await create3(input.namespace, 'v1', create3Factory, ARTIFACTS.DEPLOYER)
  writeOutput('Deployer', deployer.address)

  const registry = await create3(input.namespace, 'v1', create3Factory, ARTIFACTS.REGISTRY, [admin.address])
  writeOutput('Registry', registry.address)

  // TODO: Smart Vault implementation does not fit due to block gas limit
  const smartVault = await deploy(ARTIFACTS.SMART_VAULT, [input.wrappedNativeToken, registry.address])
  await registry.connect(admin).register(await smartVault.NAMESPACE(), smartVault.address, false)
  writeOutput('SmartVault', smartVault.address)

  const priceOracle = await create3(input.namespace, 'v1', create3Factory, ARTIFACTS.PRICE_ORACLE, [
    input.wrappedNativeToken,
    registry.address,
  ])
  await registry.connect(admin).register(await priceOracle.NAMESPACE(), priceOracle.address, true)
  writeOutput('PriceOracle', priceOracle.address)

  const swapConnector = await create3(input.namespace, 'v4', create3Factory, ARTIFACTS.SWAP_CONNECTOR, [
    input.uniswapV2Router,
    input.uniswapV3Router,
    input.balancerV2Vault,
    input.paraswapV5Augustus,
    input.oneInchV5Router,
    registry.address,
  ])
  await registry.connect(admin).register(await swapConnector.NAMESPACE(), swapConnector.address, true)
  writeOutput('SwapConnector', swapConnector.address)
}
