import { assertEvent, BigNumberish, deploy, instanceAt, ONES_BYTES32 } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract } from 'ethers'

import { ARTIFACTS, Mimic, MOCKS } from './setup'

export async function createTokenMock(symbol = 'TKN'): Promise<Contract> {
  return deploy(MOCKS.TOKEN, [symbol])
}

export async function createPriceFeedMock(price: BigNumberish): Promise<Contract> {
  return deploy(MOCKS.PRICE_FEED, [price])
}

export async function createSmartVault(mimic: Mimic, admin: SignerWithAddress): Promise<Contract> {
  const initializeData = mimic.smartVault.interface.encodeFunctionData('initialize', [admin.address])
  const tx = await mimic.smartVaultsFactory.create(ONES_BYTES32, mimic.smartVault.address, initializeData)
  const event = await assertEvent(tx, 'Created', { implementation: mimic.smartVault })
  const smartVault = await instanceAt(ARTIFACTS.SMART_VAULT, event.args.instance)

  const setPriceOracleRole = smartVault.interface.getSighash('setPriceOracle')
  await smartVault.connect(admin).authorize(admin.address, setPriceOracleRole)
  await smartVault.connect(admin).setPriceOracle(mimic.priceOracle.address)

  const setSwapConnectorRole = smartVault.interface.getSighash('setSwapConnector')
  await smartVault.connect(admin).authorize(admin.address, setSwapConnectorRole)
  await smartVault.connect(admin).setSwapConnector(mimic.swapConnector.address)

  const setBridgeConnectorRole = smartVault.interface.getSighash('setBridgeConnector')
  await smartVault.connect(admin).authorize(admin.address, setBridgeConnectorRole)
  await smartVault.connect(admin).setBridgeConnector(mimic.bridgeConnector.address)

  return smartVault
}
