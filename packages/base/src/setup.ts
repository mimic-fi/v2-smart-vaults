import { deploy, getSigner, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract } from 'ethers'

export type Mimic = {
  registry: Contract
  smartVaultsFactory: Contract
  smartVault: Contract
  priceOracle: Contract
  swapConnector: Contract
  bridgeConnector: Contract
  wrappedNativeToken: Contract
  admin: SignerWithAddress
}

const SMART_VAULTS_BASE_PATH = '@mimic-fi/v2-smart-vaults-base/artifacts/contracts/test'

export const MOCKS = {
  TOKEN: `${SMART_VAULTS_BASE_PATH}/samples/TokenMock.sol/TokenMock`,
  PRICE_FEED: `${SMART_VAULTS_BASE_PATH}/samples/PriceFeedMock.sol/PriceFeedMock`,
  SWAP_CONNECTOR: `${SMART_VAULTS_BASE_PATH}/core/SwapConnectorMock.sol/SwapConnectorMock`,
  BRIDGE_CONNECTOR: `${SMART_VAULTS_BASE_PATH}/core/BridgeConnectorMock.sol/BridgeConnectorMock`,
  WRAPPED_NATIVE_TOKEN: `${SMART_VAULTS_BASE_PATH}/samples/WrappedNativeTokenMock.sol/WrappedNativeTokenMock`,
  HOP_L1_BRIDGE: `${SMART_VAULTS_BASE_PATH}/samples/HopL1BridgeMock.sol/HopL1BridgeMock`,
  HOP_L2_AMM: `${SMART_VAULTS_BASE_PATH}/samples/HopL2AmmMock.sol/HopL2AmmMock`,
}

export const ARTIFACTS = {
  REGISTRY: '@mimic-fi/v2-registry/artifacts/contracts/registry/Registry.sol/Registry',
  SMART_VAULTS_FACTORY: '@mimic-fi/v2-smart-vault/artifacts/contracts/SmartVaultsFactory.sol/SmartVaultsFactory',
  SMART_VAULT: '@mimic-fi/v2-smart-vault/artifacts/contracts/SmartVault.sol/SmartVault',
  PRICE_ORACLE: '@mimic-fi/v2-price-oracle/artifacts/contracts/oracle/PriceOracle.sol/PriceOracle',
  SWAP_CONNECTOR: '@mimic-fi/v2-swap-connector/artifacts/contracts/SwapConnector.sol/SwapConnector',
  BRIDGE_CONNECTOR: '@mimic-fi/v2-bridge-connector/artifacts/contracts/BridgeConnector.sol/BridgeConnector',
  CREATE3_FACTORY: '@mimic-fi/v2-smart-vaults-base/artifacts/contracts/deploy/Create3Factory.sol/Create3Factory',
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function setupMimic(mocked: boolean): Promise<Mimic> {
  const admin = await getSigner()

  const registry = await deploy(ARTIFACTS.REGISTRY, [admin.address])

  const wrappedNativeToken = await deploy(MOCKS.WRAPPED_NATIVE_TOKEN)

  const smartVaultsFactory = await deploy(ARTIFACTS.SMART_VAULTS_FACTORY, [registry.address])
  await registry.connect(admin).register(await smartVaultsFactory.NAMESPACE(), smartVaultsFactory.address, false)

  const smartVault = await deploy(ARTIFACTS.SMART_VAULT, [wrappedNativeToken.address, registry.address])
  await registry.connect(admin).register(await smartVault.NAMESPACE(), smartVault.address, false)

  const priceOracle = await deploy(ARTIFACTS.PRICE_ORACLE, [wrappedNativeToken.address, registry.address])
  await registry.connect(admin).register(await priceOracle.NAMESPACE(), priceOracle.address, true)

  const swapConnector = await (mocked
    ? deploy(MOCKS.SWAP_CONNECTOR, [registry.address])
    : deploy(ARTIFACTS.SWAP_CONNECTOR, [
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        registry.address,
      ]))
  await registry.connect(admin).register(await swapConnector.NAMESPACE(), swapConnector.address, true)

  const bridgeConnector = await (mocked
    ? deploy(MOCKS.BRIDGE_CONNECTOR, [registry.address])
    : deploy(ARTIFACTS.BRIDGE_CONNECTOR, [wrappedNativeToken.address, registry.address]))
  await registry.connect(admin).register(await bridgeConnector.NAMESPACE(), bridgeConnector.address, true)

  return {
    registry,
    smartVaultsFactory,
    smartVault,
    priceOracle,
    swapConnector,
    bridgeConnector,
    wrappedNativeToken,
    admin,
  }
}
