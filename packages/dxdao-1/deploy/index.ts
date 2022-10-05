import { assertIndirectEvent, deploy, instanceAt } from '@mimic-fi/v2-helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-unused-vars */

export default async (input: any, writeOutput: (key: string, value: string) => void): Promise<void> => {
  const { params, mimic } = input

  const deployer = await deploy('SmartVaultDeployer', [], undefined, { Deployer: mimic.Deployer })
  writeOutput('Deployer', deployer.address)

  const wrapper = await deploy('Wrapper', [deployer.address, mimic.Registry])
  writeOutput('Wrapper', wrapper.address)
  params.wrapperActionParams.impl = wrapper.address

  const tx = await deployer.deploy(params)
  const registry = await instanceAt('IRegistry', mimic.Registry)
  const event = await assertIndirectEvent(tx, registry.interface, 'Cloned', { implementation: mimic.SmartVault })
  const smartVault = await instanceAt('SmartVault', event.args.instance)
  writeOutput('SmartVault', smartVault.address)

  const wallet = await smartVault.wallet()
  writeOutput('Wallet', wallet)
}
