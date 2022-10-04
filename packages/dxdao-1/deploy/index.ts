import { assertIndirectEvent, deploy, instanceAt } from '@mimic-fi/v2-helpers'
import fs from 'fs'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import path from 'path'

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export default async (args: any, hre: HardhatRuntimeEnvironment): Promise<void> => {
  const network = hre.network.name
  const { params, mimic } = require(`./input.${network}`).default

  const deployer = await deploy('SmartVaultDeployer', [], undefined, { Deployer: mimic.Deployer })
  saveOutput(network, 'Deployer', deployer.address)

  const wrapper = await deploy('Wrapper', [deployer.address, mimic.Registry])
  saveOutput(network, 'Wrapper', wrapper.address)
  params.wrapperActionParams.impl = wrapper.address

  const tx = await deployer.deploy(params)
  const registry = await instanceAt('IRegistry', mimic.Registry)
  const event = await assertIndirectEvent(tx, registry.interface, 'Cloned', { implementation: mimic.SmartVault })
  const smartVault = await instanceAt('SmartVault', event.args.instance)
  saveOutput(network, 'SmartVault', smartVault.address)

  const wallet = await smartVault.wallet()
  saveOutput(network, 'Wallet', wallet)
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
