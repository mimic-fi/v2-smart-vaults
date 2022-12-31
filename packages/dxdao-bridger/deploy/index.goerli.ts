import { assertIndirectEvent, instanceAt } from '@mimic-fi/v2-helpers'
import { ARTIFACTS, deployment } from '@mimic-fi/v2-smart-vaults-base'
import { ethers } from 'hardhat'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-unused-vars */

export default async (input: any, writeOutput: (key: string, value: string) => void): Promise<void> => {
  const { params, mimic } = input
  params.smartVaultParams.salt = ethers.utils.solidityKeccak256(['string'], [input.namespace])

  const create3Factory = await instanceAt(ARTIFACTS.CREATE3_FACTORY, mimic.Create3Factory)
  const deployer = await deployment.create3(input.namespace, 'v4', create3Factory, 'L1SmartVaultDeployer', [], null, {
    Deployer: mimic.Deployer,
  })
  writeOutput('L1Deployer', deployer.address)

  const bridger = await deployment.create3(input.namespace, 'v4', create3Factory, 'L1HopBridger', [
    deployer.address,
    mimic.Registry,
  ])
  writeOutput('L1HopBridger', bridger.address)
  params.l1HopBridgerActionParams.impl = bridger.address

  const tx = await deployer.deploy(params)
  const factory = await instanceAt(ARTIFACTS.SMART_VAULTS_FACTORY, mimic.SmartVaultsFactory)
  const event = await assertIndirectEvent(tx, factory.interface, 'Created', { implementation: mimic.SmartVault })
  writeOutput('SmartVault', event.args.instance)
}
