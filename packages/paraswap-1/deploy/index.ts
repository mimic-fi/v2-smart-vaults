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

  const feeClaimer = input.accounts.feeClaimer
    ? await instanceAt('IFeeClaimer', input.accounts.feeClaimer)
    : await deployment.create3(input.namespace, create3Factory, 'FeeClaimerMock')

  const erc20Claimer = await deployment.create3(input.namespace, create3Factory, 'ERC20Claimer', [
    deployer.address,
    mimic.Registry,
  ])
  writeOutput('ERC20Claimer', erc20Claimer.address)
  params.erc20ClaimerActionParams.impl = erc20Claimer.address
  params.erc20ClaimerActionParams.feeClaimerParams.feeClaimer = feeClaimer.address

  const nativeClaimer = await deployment.create3(input.namespace, create3Factory, 'NativeClaimer', [
    deployer.address,
    mimic.Registry,
  ])
  writeOutput('NativeClaimer', nativeClaimer.address)
  params.nativeClaimerActionParams.impl = nativeClaimer.address
  params.nativeClaimerActionParams.feeClaimerParams.feeClaimer = feeClaimer.address

  const withdrawer = await deployment.create3(input.namespace, create3Factory, 'Withdrawer', [
    deployer.address,
    mimic.Registry,
  ])
  writeOutput('Withdrawer', withdrawer.address)
  params.withdrawerActionParams.impl = withdrawer.address

  const swapFeeSetter = await deployment.create3(input.namespace, create3Factory, 'SwapFeeSetter', [
    deployer.address,
    mimic.Registry,
  ])
  writeOutput('SwapFeeSetter', swapFeeSetter.address)
  params.swapFeeSetterActionParams.impl = swapFeeSetter.address

  const tx = await deployer.deploy(params)
  const registry = await instanceAt('IRegistry', mimic.Registry)
  const event = await assertIndirectEvent(tx, registry.interface, 'Cloned', { implementation: mimic.SmartVault })
  writeOutput('SmartVault', event.args.instance)
}
