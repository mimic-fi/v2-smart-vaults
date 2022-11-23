import { deploy, getSigner, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract } from 'ethers'

export type Mimic = {
  deployer: Contract
  registry: Contract
  smartVault: Contract
  priceOracle: Contract
  swapConnector: Contract
  wrappedNativeToken: Contract
  admin: SignerWithAddress
}

const SMART_VAULTS_BASE_PATH = '@mimic-fi/v2-smart-vaults-base/artifacts/contracts/test'

export const MOCKS = {
  TOKEN: `${SMART_VAULTS_BASE_PATH}/samples/TokenMock.sol/TokenMock`,
  PRICE_FEED: `${SMART_VAULTS_BASE_PATH}/samples/PriceFeedMock.sol/PriceFeedMock`,
  SWAP_CONNECTOR: `${SMART_VAULTS_BASE_PATH}/core/SwapConnectorMock.sol/SwapConnectorMock`,
  WRAPPED_NATIVE_TOKEN: `${SMART_VAULTS_BASE_PATH}/samples/WrappedNativeTokenMock.sol/WrappedNativeTokenMock`,
}

export const ARTIFACTS = {
  REGISTRY: '@mimic-fi/v2-registry/artifacts/contracts/registry/Registry.sol/Registry',
  SMART_VAULT: '@mimic-fi/v2-smart-vault/artifacts/contracts/SmartVault.sol/SmartVault',
  PRICE_ORACLE: '@mimic-fi/v2-price-oracle/artifacts/contracts/oracle/PriceOracle.sol/PriceOracle',
  SWAP_CONNECTOR: '@mimic-fi/v2-swap-connector/artifacts/contracts/SwapConnector.sol/SwapConnector',
  DEPLOYER: '@mimic-fi/v2-smart-vaults-base/artifacts/contracts/Deployer.sol/Deployer',
  CREATE3_FACTORY: '@mimic-fi/v2-smart-vaults-base/artifacts/contracts/Create3Factory.sol/Create3Factory',
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function setupMimic(mocked: boolean): Promise<Mimic> {
  const admin = await getSigner()

  const deployer = await deploy('Deployer')

  const registry = await deploy(ARTIFACTS.REGISTRY, [admin.address])

  const wrappedNativeToken = await deploy(MOCKS.WRAPPED_NATIVE_TOKEN)

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

  return { deployer, registry, smartVault, priceOracle, swapConnector, wrappedNativeToken, admin }
}
