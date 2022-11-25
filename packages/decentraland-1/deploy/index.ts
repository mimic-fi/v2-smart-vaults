import { assertIndirectEvent, instanceAt } from '@mimic-fi/v2-helpers'
import { ARTIFACTS, deployment } from '@mimic-fi/v2-smart-vaults-base'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-unused-vars */

const VERSION = 'v1'

export default async (input: any, writeOutput: (key: string, value: string) => void): Promise<void> => {
  const { params, mimic } = input

  const create3Factory = await instanceAt(ARTIFACTS.CREATE3_FACTORY, mimic.Create3Factory)
  const deployer = await deployment.create3(
    input.namespace,
    VERSION,
    create3Factory,
    'SmartVaultDeployer',
    [],
    undefined,
    {
      Deployer: mimic.Deployer,
    }
  )
  writeOutput('Deployer', deployer.address)

  const dexSwapper = await deployment.create3(input.namespace, VERSION, create3Factory, 'DEXSwapper', [
    deployer.address,
    mimic.Registry,
  ])
  writeOutput('DEXSwapper', dexSwapper.address)
  params.dexSwapperActionParams.impl = dexSwapper.address

  const otcSwapper = await deployment.create3(input.namespace, VERSION, create3Factory, 'OTCSwapper', [
    deployer.address,
    mimic.Registry,
  ])
  writeOutput('OTCSwapper', otcSwapper.address)
  params.otcSwapperActionParams.impl = otcSwapper.address

  const withdrawer = await deployment.create3(input.namespace, VERSION, create3Factory, 'Withdrawer', [
    deployer.address,
    mimic.Registry,
  ])
  writeOutput('Withdrawer', withdrawer.address)
  params.withdrawerActionParams.impl = withdrawer.address

  const tx = await deployer.deploy(params)
  const registry = await instanceAt('IRegistry', mimic.Registry)
  const event = await assertIndirectEvent(tx, registry.interface, 'Cloned', { implementation: mimic.SmartVault })
  writeOutput('SmartVault', event.args.instance)
}
