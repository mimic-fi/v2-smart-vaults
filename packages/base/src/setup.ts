import { assertEvent, BigNumberish, deploy, getSigner, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

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
  SMART_VAULT: '@mimic-fi/v2-smart-vault/artifacts/contracts/SmartVault.sol/SmartVault',
  PRICE_ORACLE: '@mimic-fi/v2-price-oracle/artifacts/contracts/oracle/PriceOracle.sol/PriceOracle',
  SWAP_CONNECTOR: '@mimic-fi/v2-swap-connector/artifacts/contracts/SwapConnector.sol/SwapConnector',
  BRIDGE_CONNECTOR: '@mimic-fi/v2-bridge-connector/artifacts/contracts/BridgeConnector.sol/BridgeConnector',
  PERMISSIONS_MANAGER: '@mimic-fi/v2-permissions-manager/artifacts/contracts/PermissionsManager.sol/PermissionsManager',
  CREATE3_FACTORY: '@mimic-fi/v2-deployer/artifacts/contracts/Create3Factory.sol/Create3Factory',
  DEPLOYER: '@mimic-fi/v2-deployer/artifacts/contracts/Deployer.sol/Deployer',
}

export type Mimic = {
  deployer: Contract
  registry: Contract
  smartVault: Contract
  priceOracle: Contract
  swapConnector: Contract
  bridgeConnector: Contract
  permissionsManager: Contract
  wrappedNativeToken: Contract
  admin: SignerWithAddress
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function createTokenMock(symbol = 'TKN'): Promise<Contract> {
  return deploy(MOCKS.TOKEN, [symbol])
}

export async function createPriceFeedMock(price: BigNumberish): Promise<Contract> {
  return deploy(MOCKS.PRICE_FEED, [price])
}

export async function createSmartVault(mimic: Mimic, owner: SignerWithAddress, salt = ''): Promise<Contract> {
  const config = {
    name: 'SmartVault',
    impl: mimic.smartVault.address,
    feeCollector: owner.address,
    feeCollectorAdmin: owner.address,
    strategies: [],
    priceFeedParams: [],
    priceOracle: mimic.priceOracle.address,
    swapConnector: mimic.swapConnector.address,
    bridgeConnector: mimic.bridgeConnector.address,
    swapFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
    bridgeFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
    withdrawFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
    performanceFee: { pct: 0, cap: 0, token: ZERO_ADDRESS, period: 0 },
  }
  if (!salt) salt = ethers.utils.hexlify(ethers.utils.randomBytes(32))
  const tx = await mimic.deployer.deploySmartVault(salt, config, [owner.address])
  const smartVaultEvent = await assertEvent(tx, 'SmartVaultDeployed')
  return await instanceAt(ARTIFACTS.SMART_VAULT, smartVaultEvent.args[2])
}

export async function setupMimic(mocked: boolean): Promise<Mimic> {
  const admin = await getSigner()
  const registry = await deploy(ARTIFACTS.REGISTRY, [admin.address])
  const wrappedNativeToken = await deploy(MOCKS.WRAPPED_NATIVE_TOKEN)

  const deployer = await deploy(ARTIFACTS.DEPLOYER, [registry.address])
  await registry.connect(admin).register(await deployer.NAMESPACE(), deployer.address, true)

  const permissionsManager = await deploy(ARTIFACTS.PERMISSIONS_MANAGER, [registry.address])
  await registry.connect(admin).register(await permissionsManager.NAMESPACE(), permissionsManager.address, false)

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
    deployer,
    registry,
    smartVault,
    priceOracle,
    swapConnector,
    bridgeConnector,
    permissionsManager,
    wrappedNativeToken,
    admin,
  }
}

export function buildEmptyActionConfig(owner: SignerWithAddress, smartVault: Contract): any {
  return {
    baseConfig: {
      owner: owner.address,
      smartVault: smartVault.address,
    },
    oracleConfig: {
      signers: [],
    },
    relayConfig: {
      gasPriceLimit: 0,
      priorityFeeLimit: 0,
      txCostLimit: 0,
      gasToken: ZERO_ADDRESS,
      permissiveMode: false,
      relayers: [],
    },
    timeLockConfig: {
      delay: 0,
      nextExecutionTimestamp: 0,
    },
    tokenIndexConfig: {
      tokens: [],
      sources: [],
      acceptanceType: 0,
    },
    tokenThresholdConfig: {
      tokens: [],
      thresholds: [],
      defaultThreshold: {
        token: ZERO_ADDRESS,
        min: 0,
        max: 0,
      },
    },
  }
}
