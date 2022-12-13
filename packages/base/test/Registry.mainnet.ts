import { fp, getForkedNetwork, impersonate, instanceAt } from '@mimic-fi/v2-helpers'
import { deployment } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import hre from 'hardhat'

/* eslint-disable no-secrets/no-secrets */

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

describe('Registry', () => {
  let registry: Contract, admin: SignerWithAddress
  let smartVault: Contract, priceOracle: Contract, swapConnector: Contract, bridgeConnector: Contract

  before('impersonate admin', async () => {
    const input = await deployment.readInput(getForkedNetwork(hre))
    admin = await impersonate(input.admin, fp(100))
  })

  before('deploy smart vault', async () => {
    const output = await deployment.deploy(getForkedNetwork(hre), 'test')
    registry = await instanceAt('IRegistry', output.Registry)
    smartVault = await instanceAt('ISmartVault', output.SmartVault)
    priceOracle = await instanceAt('IPriceOracle', output.PriceOracle)
    swapConnector = await instanceAt('ISwapConnector', output.SwapConnector)
    bridgeConnector = await instanceAt('IBridgeConnector', output.BridgeConnector)
  })

  it('sets the admin correctly', async () => {
    const registerRole = registry.interface.getSighash('register')
    expect(await registry.isAuthorized(admin.address, registerRole)).to.be.true

    const deprecateRole = registry.interface.getSighash('deprecate')
    expect(await registry.isAuthorized(admin.address, deprecateRole)).to.be.true

    const authorizeRole = registry.interface.getSighash('authorize')
    expect(await registry.isAuthorized(admin.address, authorizeRole)).to.be.true

    const unauthorizeRole = registry.interface.getSighash('unauthorize')
    expect(await registry.isAuthorized(admin.address, unauthorizeRole)).to.be.true
  })

  it('registers the smart vault correctly', async () => {
    const data = await registry.implementationData(smartVault.address)
    expect(data.stateless).to.be.false
    expect(data.deprecated).to.be.false
    expect(data.namespace).to.be.equal(await smartVault.NAMESPACE())

    expect(await smartVault.wrappedNativeToken()).to.be.equal(WETH)
    expect(await smartVault.registry()).to.be.equal(registry.address)
  })

  it('registers the price oracle correctly', async () => {
    const data = await registry.implementationData(priceOracle.address)
    expect(data.stateless).to.be.true
    expect(data.deprecated).to.be.false
    expect(data.namespace).to.be.equal(await priceOracle.NAMESPACE())

    expect(await priceOracle.registry()).to.be.equal(registry.address)
  })

  it('registers the swap connector correctly', async () => {
    const data = await registry.implementationData(swapConnector.address)
    expect(data.stateless).to.be.true
    expect(data.deprecated).to.be.false
    expect(data.namespace).to.be.equal(await swapConnector.NAMESPACE())

    expect(await swapConnector.registry()).to.be.equal(registry.address)
  })

  it('registers the bridge connector correctly', async () => {
    const data = await registry.implementationData(bridgeConnector.address)
    expect(data.stateless).to.be.true
    expect(data.deprecated).to.be.false
    expect(data.namespace).to.be.equal(await bridgeConnector.NAMESPACE())

    expect(await bridgeConnector.registry()).to.be.equal(registry.address)
  })
})
