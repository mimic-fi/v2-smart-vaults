import { assertIndirectEvent, deploy, fp, getSigner, getSigners, instanceAt, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('SmartVault', () => {
  let wallet: Contract, registry: Contract
  let swapConnector: Contract, priceOracleImpl: Contract, walletImpl: Contract, wrappedNativeToken: Contract
  let mimic: SignerWithAddress, owner: SignerWithAddress, managers: SignerWithAddress[], relayers: SignerWithAddress[]

  before('setup signers', async () => {
    mimic = await getSigner(1)
    owner = await getSigner(2)
    managers = await getSigners(3, 3)
    relayers = await getSigners(2, 6)
  })

  beforeEach('deploy registry and dependencies', async () => {
    wrappedNativeToken = await deploy('WrappedNativeTokenMock')
    registry = await deploy('@mimic-fi/v2-registry/artifacts/contracts/registry/Registry.sol/Registry', [mimic.address])

    walletImpl = await deploy('@mimic-fi/v2-wallet/artifacts/contracts/Wallet.sol/Wallet', [
      registry.address,
      wrappedNativeToken.address,
    ])

    priceOracleImpl = await deploy('@mimic-fi/v2-price-oracle/artifacts/contracts/PriceOracle.sol/PriceOracle', [
      wrappedNativeToken.address,
      registry.address,
    ])

    swapConnector = await deploy('@mimic-fi/v2-swap-connector/artifacts/contracts/SwapConnector.sol/SwapConnector', [
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
    ])

    await registry.connect(mimic).register(await walletImpl.NAMESPACE(), walletImpl.address)
    await registry.connect(mimic).register(await swapConnector.NAMESPACE(), swapConnector.address)
    await registry.connect(mimic).register(await priceOracleImpl.NAMESPACE(), priceOracleImpl.address)
  })

  beforeEach('deploy smart vault', async () => {
    const deployer = await deploy('SmartVaultDeployer')
    const tx = await deployer.deploy({
      owner: owner.address,
      managers: managers.map((m) => m.address),
      registry: registry.address,
      walletParams: {
        impl: walletImpl.address,
        admin: owner.address,
        feeCollector: mimic.address,
        strategy: ZERO_ADDRESS,
        swapConnector: ZERO_ADDRESS,
        swapFee: 0,
        withdrawFee: 0,
        performanceFee: 0,
      },
      priceOracleParams: {
        impl: priceOracleImpl.address,
        admin: owner.address,
        bases: [],
        quotes: [],
        feeds: [],
      },
      relayedActionParams: {
        relayers: relayers.map((m) => m.address),
        gasPriceLimit: 0,
        totalCostLimit: fp(100),
        totalCostToken: wrappedNativeToken.address,
      },
    })

    const { args } = await assertIndirectEvent(tx, registry.interface, 'Cloned', { implementation: walletImpl.address })
    wallet = await instanceAt('Wallet', args.instance)
  })

  describe('wallet', () => {
    it('authorizes the owner to authorize on the wallet', async () => {
      const authorizeRole = wallet.interface.getSighash('authorize')
      expect(await wallet.isAuthorized(owner.address, authorizeRole)).to.be.true
    })

    it('authorizes the owner to unauthorize on the wallet', async () => {
      const unauthorizeRole = wallet.interface.getSighash('unauthorize')
      expect(await wallet.isAuthorized(owner.address, unauthorizeRole)).to.be.true
    })
  })
})
