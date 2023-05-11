import { assertEvent, deploy, fp, getSigner, getSigners, instanceAt, ONES_BYTES32 } from '@mimic-fi/v2-helpers'
import { assertPermissions, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

const randomAddress = (): string => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.randomBytes(20)))

describe('Deployer', () => {
  let mimic: Mimic
  let owners: string[]
  let smartVault: Contract, permissionsManager: Contract

  const smartVaultParams = {
    salt: ONES_BYTES32,
    impl: undefined,
    factory: undefined,
    admin: randomAddress(),
    feeCollector: randomAddress(),
    feeCollectorAdmin: randomAddress(),
    strategies: [],
    priceFeedParams: [
      { base: randomAddress(), quote: randomAddress(), feed: randomAddress() },
      { base: randomAddress(), quote: randomAddress(), feed: randomAddress() },
    ],
    priceOracle: undefined,
    swapConnector: undefined,
    bridgeConnector: undefined,
    swapFee: { pct: fp(0.1), cap: fp(1), token: randomAddress(), period: 120 },
    bridgeFee: { pct: fp(0.2), cap: fp(2), token: randomAddress(), period: 180 },
    withdrawFee: { pct: fp(0.3), cap: fp(3), token: randomAddress(), period: 240 },
    performanceFee: { pct: fp(0.4), cap: fp(4), token: randomAddress(), period: 300 },
  }

  before('deploy smart vault', async () => {
    mimic = await setupMimic(false)
    owners = (await getSigners(4)).map((owner) => owner.address)

    smartVaultParams.impl = mimic.smartVault.address
    smartVaultParams.factory = mimic.smartVaultsFactory.address
    smartVaultParams.priceOracle = mimic.priceOracle.address
    smartVaultParams.swapConnector = mimic.swapConnector.address
    smartVaultParams.bridgeConnector = mimic.bridgeConnector.address

    const deployer = await deploy('Deployer', [owners[0]], undefined, { DeployerLib: mimic.deployerLib.address })
    const tx = await deployer.deploy({ registry: mimic.registry.address, owners, smartVaultParams })

    const smartVaultEvent = await assertEvent(tx, 'SmartVaultDeployed')
    smartVault = await instanceAt('SmartVault', smartVaultEvent.args.smartVault)

    const permissionsManagerEvent = await assertEvent(tx, 'PermissionsManagerDeployed')
    permissionsManager = await instanceAt('PermissionsManager', permissionsManagerEvent.args.permissionsManager)
  })

  describe('permissions manager', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(permissionsManager, [
        { name: 'owners', account: owners, roles: ['execute'] },
        { name: 'permissions manager', account: permissionsManager, roles: ['authorize', 'unauthorize'] },
        { name: 'fee collector admin', account: smartVaultParams.feeCollectorAdmin, roles: [] },
      ])
    })
  })

  describe('smart vault', () => {
    it('has set its permissions correctly', async () => {
      await assertPermissions(smartVault, [
        { name: 'owner', account: owners, roles: [] },
        { name: 'permissions manager', account: permissionsManager, roles: ['authorize', 'unauthorize'] },
        { name: 'fee collector admin', account: smartVaultParams.feeCollectorAdmin, roles: ['setFeeCollector'] },
      ])
    })

    it('sets a fee collector', async () => {
      expect(await smartVault.feeCollector()).to.be.equal(smartVaultParams.feeCollector)
    })

    it('sets a bridge fee', async () => {
      const bridgeFee = await smartVault.bridgeFee()

      expect(bridgeFee.pct).to.be.equal(smartVaultParams.bridgeFee.pct)
      expect(bridgeFee.cap).to.be.equal(smartVaultParams.bridgeFee.cap)
      expect(bridgeFee.token).to.be.equal(smartVaultParams.bridgeFee.token)
      expect(bridgeFee.period).to.be.equal(smartVaultParams.bridgeFee.period)
    })

    it('sets no swap fee', async () => {
      const swapFee = await smartVault.swapFee()

      expect(swapFee.pct).to.be.equal(smartVaultParams.swapFee.pct)
      expect(swapFee.cap).to.be.equal(smartVaultParams.swapFee.cap)
      expect(swapFee.token).to.be.equal(smartVaultParams.swapFee.token)
      expect(swapFee.period).to.be.equal(smartVaultParams.swapFee.period)
    })

    it('sets no withdraw fee', async () => {
      const withdrawFee = await smartVault.withdrawFee()

      expect(withdrawFee.pct).to.be.equal(smartVaultParams.withdrawFee.pct)
      expect(withdrawFee.cap).to.be.equal(smartVaultParams.withdrawFee.cap)
      expect(withdrawFee.token).to.be.equal(smartVaultParams.withdrawFee.token)
      expect(withdrawFee.period).to.be.equal(smartVaultParams.withdrawFee.period)
    })

    it('sets no performance fee', async () => {
      const performanceFee = await smartVault.performanceFee()

      expect(performanceFee.pct).to.be.equal(smartVaultParams.performanceFee.pct)
      expect(performanceFee.cap).to.be.equal(smartVaultParams.performanceFee.cap)
      expect(performanceFee.token).to.be.equal(smartVaultParams.performanceFee.token)
      expect(performanceFee.period).to.be.equal(smartVaultParams.performanceFee.period)
    })

    it('sets a price oracle', async () => {
      expect(await smartVault.priceOracle()).to.be.equal(smartVaultParams.priceOracle)
    })

    it('sets a swap connector', async () => {
      expect(await smartVault.swapConnector()).to.be.equal(smartVaultParams.swapConnector)
    })

    it('sets a bridge connector', async () => {
      expect(await smartVault.bridgeConnector()).to.be.equal(smartVaultParams.bridgeConnector)
    })

    it('can authorize smart vault methods', async () => {
      const who = mimic.admin.address
      const what = smartVault.interface.getSighash('wrap')
      expect(await smartVault.isAuthorized(who, what)).to.be.false

      const owner = await getSigner(owners[0])
      const requests = [{ target: smartVault.address, changes: [{ grant: true, permission: { who, what } }] }]
      await permissionsManager.connect(owner).execute(requests)

      expect(await smartVault.isAuthorized(who, what)).to.be.true
    })
  })
})
