import { assertIndirectEvent, deploy, instanceAt } from '@mimic-fi/v2-helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-unused-vars */

export default async (input: any, writeOutput: (key: string, value: string) => void): Promise<void> => {
  const { params, mimic } = input

  const deployer = await deploy('SmartVaultDeployer', [], undefined, { Deployer: mimic.Deployer })
  writeOutput('Deployer', deployer.address)

  const feeClaimer = await deploy('FeeClaimerMock')
  writeOutput('FeeClaimer', feeClaimer.address)

  const erc20Claimer = await deploy('ERC20Claimer', [deployer.address, mimic.Registry])
  writeOutput('ERC20Claimer', erc20Claimer.address)
  params.erc20ClaimerActionParams.impl = erc20Claimer.address
  params.erc20ClaimerActionParams.feeClaimerParams.feeClaimer = feeClaimer.address

  const nativeClaimer = await deploy('NativeClaimer', [deployer.address, mimic.Registry])
  writeOutput('NativeClaimer', nativeClaimer.address)
  params.nativeClaimerActionParams.impl = nativeClaimer.address
  params.nativeClaimerActionParams.feeClaimerParams.feeClaimer = feeClaimer.address

  const withdrawer = await deploy('Withdrawer', [deployer.address, mimic.Registry])
  writeOutput('Withdrawer', withdrawer.address)
  params.withdrawerActionParams.impl = withdrawer.address

  const tx = await deployer.deploy(params)
  const registry = await instanceAt('IRegistry', mimic.Registry)
  const event = await assertIndirectEvent(tx, registry.interface, 'Cloned', { implementation: mimic.SmartVault })
  const smartVault = await instanceAt('SmartVault', event.args.instance)
  writeOutput('SmartVault', smartVault.address)

  const wallet = await smartVault.wallet()
  writeOutput('Wallet', wallet)
}
