import { deploy, getSigner } from '@mimic-fi/v2-helpers'
import fs from 'fs'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import path from 'path'

import { ARTIFACTS } from '../src/setup'

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export default async (args: any, hre: HardhatRuntimeEnvironment): Promise<void> => {
  const network = hre.network.name
  const inputs = require('./input').default
  if (!inputs[network]) throw Error(`Missing config for network '${network}'`)
  const input = inputs[network]

  const deployer = await deploy('Deployer')
  saveOutput(network, 'Deployer', deployer.address)

  const admin = await getSigner()
  const registry = await deploy(ARTIFACTS.REGISTRY, [admin.address])
  saveOutput(network, 'Registry', registry.address)

  const wallet = await deploy(ARTIFACTS.WALLET, [input.wrappedNativeToken, registry.address])
  await registry.connect(admin).register(await wallet.NAMESPACE(), wallet.address, false)
  saveOutput(network, 'Wallet', wallet.address)

  const smartVault = await deploy(ARTIFACTS.SMART_VAULT, [registry.address])
  await registry.connect(admin).register(await smartVault.NAMESPACE(), smartVault.address, false)
  saveOutput(network, 'SmartVault', smartVault.address)

  const priceOracle = await deploy(ARTIFACTS.PRICE_ORACLE, [input.wrappedNativeToken, registry.address])
  await registry.connect(admin).register(await priceOracle.NAMESPACE(), priceOracle.address, true)
  saveOutput(network, 'PriceOracle', priceOracle.address)

  const swapConnector = await deploy(ARTIFACTS.SWAP_CONNECTOR, [
    input.uniswapV3Router,
    input.uniswapV2Router,
    input.balancerV2Vault,
    input.paraswapV5Augustus,
    registry.address,
  ])
  await registry.connect(admin).register(await swapConnector.NAMESPACE(), swapConnector.address, true)
  saveOutput(network, 'SwapConnector', swapConnector.address)
}

function saveOutput(network: string, key: string, value: string): void {
  console.log(`${key}: ${value}`)
  const outputPath = path.join(__dirname, 'output')
  if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath)

  const outputFile = path.join(outputPath, `${network}.json`)
  const previousOutput = fs.existsSync(outputFile) ? JSON.parse(fs.readFileSync(outputFile).toString()) : {}

  const finalOutput = { ...previousOutput, [key]: value }
  const finalOutputJSON = JSON.stringify(finalOutput, null, 2)
  fs.writeFileSync(outputFile, finalOutputJSON)
}
