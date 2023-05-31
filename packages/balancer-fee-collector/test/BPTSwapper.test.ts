import { deploy, getSigners } from '@mimic-fi/v2-helpers'
import { buildEmptyActionConfig, createSmartVault, Mimic, setupMimic } from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('BPTSwapper', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, balancer: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, balancer] = await getSigners()
  })

  before('setup mimic', async () => {
    mimic = await setupMimic(true)
  })

  beforeEach('deploy action', async () => {
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('BPTSwapper', [
      {
        balancerVault: balancer.address,
        actionConfig: buildEmptyActionConfig(owner, smartVault),
      },
    ])
  })

  describe('initialize', () => {
    it('has a reference to the balancer vault', async () => {
      expect(await action.balancerVault()).to.be.equal(balancer.address)
    })
  })
})
