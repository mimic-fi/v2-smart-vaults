import { assertEvent, deploy, instanceAt } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract } from 'ethers'

import { ARTIFACTS, Mimic, MOCKS } from './setup'

export async function createTokenMock(symbol = 'TKN'): Promise<Contract> {
  return deploy(MOCKS.TOKEN, [symbol])
}

export async function createWallet(mimic: Mimic, admin: SignerWithAddress): Promise<Contract> {
  const initializeData = mimic.wallet.interface.encodeFunctionData('initialize', [admin.address])
  const tx = await mimic.registry.clone(mimic.wallet.address, initializeData)
  const event = await assertEvent(tx, 'Cloned', { implementation: mimic.wallet })
  const wallet = await instanceAt(ARTIFACTS.WALLET, event.args.instance)

  const setPriceOracleRole = wallet.interface.getSighash('setPriceOracle')
  await wallet.connect(admin).authorize(admin.address, setPriceOracleRole)
  await wallet.connect(admin).setPriceOracle(mimic.priceOracle.address)

  const setSwapConnector = wallet.interface.getSighash('setSwapConnector')
  await wallet.connect(admin).authorize(admin.address, setSwapConnector)
  await wallet.connect(admin).setSwapConnector(mimic.swapConnector.address)

  return wallet
}

export async function createAction(
  contractName: string,
  mimic: Mimic,
  admin: SignerWithAddress,
  wallet: Contract
): Promise<Contract> {
  const action = await deploy(contractName, [admin.address, mimic.registry.address])
  const setWalletRole = action.interface.getSighash('setWallet')
  await action.connect(admin).authorize(admin.address, setWalletRole)
  await action.connect(admin).setWallet(wallet.address)
  return action
}
