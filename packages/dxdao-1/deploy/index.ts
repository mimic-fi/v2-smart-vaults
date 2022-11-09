import { assertIndirectEvent, instanceAt } from '@mimic-fi/v2-helpers'
import { ARTIFACTS, deployment } from '@mimic-fi/v2-smart-vaults-base'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-unused-vars */

export default async (input: any, writeOutput: (key: string, value: string) => void): Promise<void> => {
  const { params, mimic } = input

  const create3Factory = await instanceAt(ARTIFACTS.CREATE3_FACTORY, mimic.Create3Factory)
  const deployer = await deployment.create3(input.namespace, create3Factory, 'SmartVaultDeployer', [], undefined, {
    Deployer: mimic.Deployer,
  })
  writeOutput('Deployer', deployer.address)

  const wrapper = await deployment.create3(input.namespace, create3Factory, 'Wrapper', [
    deployer.address,
    mimic.Registry,
  ])
  writeOutput('Wrapper', wrapper.address)
  params.wrapperActionParams.impl = wrapper.address

  const tx = await deployer.deploy(params)
  const registry = await instanceAt('IRegistry', mimic.Registry)
  const event = await assertIndirectEvent(tx, registry.interface, 'Cloned', { implementation: mimic.SmartVault })
  writeOutput('SmartVault', event.args.instance)
}
