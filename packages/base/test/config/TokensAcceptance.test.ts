import { deploy } from '@mimic-fi/v2-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const TYPE: { [key: string]: number } = {
  ALLOW_LIST: 0,
  DENY_LIST: 1,
}

describe('TokensAcceptance', () => {
  let config: Contract

  const tokenA = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const tokenB = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  const tokenC = '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621'

  beforeEach('deploy acceptance list', async () => {
    config = await deploy('TokensAcceptanceMock')
  })

  const itAddsAndRemovesTokensProperly = () => {
    it('can adds tokens', async () => {
      await config.add(tokenA)

      expect(await config.length()).to.be.eq(1)
      expect(await config.getTokens()).to.be.have.members([tokenA])
      expect(await config.includes(tokenA)).to.be.true
      expect(await config.excludes(tokenB)).to.be.true

      await config.add(tokenB)

      expect(await config.length()).to.be.eq(2)
      expect(await config.getTokens()).to.be.have.members([tokenA, tokenB])
      expect(await config.includes(tokenA)).to.be.true
      expect(await config.excludes(tokenB)).to.be.false
    })

    it('adds multiple tokens at once', async () => {
      await config.addMany([tokenA, tokenC])

      expect(await config.includes(tokenA)).to.be.true
      expect(await config.includes(tokenC)).to.be.true
      expect(await config.excludes(tokenB)).to.be.true

      expect(await config.length()).to.be.eq(2)
      expect(await config.getTokens()).to.be.have.members([tokenA, tokenC])
    })

    it('removes tokens', async () => {
      await config.add(tokenA)
      await config.add(tokenB)
      await config.add(tokenC)
      await config.remove(tokenB)

      expect(await config.includes(tokenA)).to.be.true
      expect(await config.includes(tokenC)).to.be.true
      expect(await config.excludes(tokenB)).to.be.true

      expect(await config.length()).to.be.eq(2)
      expect(await config.getTokens()).to.be.have.members([tokenA, tokenC])
    })

    it('cleans list', async () => {
      await config.addMany([tokenA, tokenB, tokenC])
      await config.clean()

      expect(await config.length()).to.be.eq(0)
      expect(await config.getTokens()).to.be.have.members([])
    })

    it('can overrides the list of tokens', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      expect(await config.length()).to.be.eq(3)
      expect(await config.getTokens()).to.be.have.members([tokenA, tokenB, tokenC])

      await config.setTokens([tokenC, tokenA])

      expect(await config.length()).to.be.eq(2)
      expect(await config.getTokens()).to.be.have.members([tokenC, tokenA])

      expect(await config.includes(tokenA)).to.be.true
      expect(await config.includes(tokenC)).to.be.true
      expect(await config.excludes(tokenB)).to.be.true
    })
  }

  describe('init', () => {
    it('starts empty', async () => {
      expect(await config.length()).to.be.eq(0)
      expect(await config.getTokens()).to.be.empty
    })

    it('is an allow list', async () => {
      expect(await config.isAllowList()).to.be.true
      expect(await config.isDenyList()).to.be.false
    })
  })

  describe('allow list', () => {
    itAddsAndRemovesTokensProperly()

    it('can be changed to a deny list', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      await config.setType(TYPE.DENY_LIST)

      expect(await config.isDenyList()).to.be.true
      expect(await config.isAllowList()).to.be.false

      expect(await config.length()).to.be.eq(3)
      expect(await config.getTokens()).to.be.have.members([tokenA, tokenB, tokenC])
    })

    it('can overrides the tokens list and type at once', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      expect(await config.length()).to.be.eq(3)
      expect(await config.getTokens()).to.be.have.members([tokenA, tokenB, tokenC])

      await config.set(TYPE.DENY_LIST, [tokenC, tokenA])

      expect(await config.isDenyList()).to.be.true
      expect(await config.isAllowList()).to.be.false

      expect(await config.length()).to.be.eq(2)
      expect(await config.getTokens()).to.be.have.members([tokenC, tokenA])
    })

    it('can validates correctly', async () => {
      await config.add(tokenA)

      expect(await config.isValid(tokenA)).to.be.true
      expect(await config.isValid(tokenB)).to.be.false
      expect(await config.isValid(tokenC)).to.be.false
      await expect(config.validate(tokenA)).not.to.be.reverted
      await expect(config.validate(tokenB)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenC)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')

      await config.add(tokenC)

      expect(await config.isValid(tokenA)).to.be.true
      expect(await config.isValid(tokenB)).to.be.false
      expect(await config.isValid(tokenC)).to.be.true
      await expect(config.validate(tokenA)).not.to.be.reverted
      await expect(config.validate(tokenB)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenC)).not.to.be.reverted

      await config.add(tokenB)

      expect(await config.isValid(tokenA)).to.be.true
      expect(await config.isValid(tokenB)).to.be.true
      expect(await config.isValid(tokenC)).to.be.true
      await expect(config.validate(tokenA)).not.to.be.reverted
      await expect(config.validate(tokenB)).not.to.be.reverted
      await expect(config.validate(tokenC)).not.to.be.reverted

      await config.remove(tokenA)
      await config.remove(tokenB)

      expect(await config.isValid(tokenA)).to.be.false
      expect(await config.isValid(tokenB)).to.be.false
      expect(await config.isValid(tokenC)).to.be.true
      await expect(config.validate(tokenA)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenB)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenC)).not.to.be.reverted

      await config.set(TYPE.DENY_LIST, [tokenC, tokenA])

      expect(await config.isValid(tokenA)).to.be.false
      expect(await config.isValid(tokenB)).to.be.true
      expect(await config.isValid(tokenC)).to.be.false
      await expect(config.validate(tokenA)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenB)).not.to.be.reverted
      await expect(config.validate(tokenC)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
    })
  })

  describe('deny list', () => {
    beforeEach('set to deny list', async () => {
      await config.setType(TYPE.DENY_LIST)
    })

    itAddsAndRemovesTokensProperly()

    it('can be changed to an allow list', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      await config.setType(TYPE.ALLOW_LIST)

      expect(await config.isDenyList()).to.be.false
      expect(await config.isAllowList()).to.be.true

      expect(await config.length()).to.be.eq(3)
      expect(await config.getTokens()).to.be.have.members([tokenA, tokenB, tokenC])
    })

    it('can overrides the tokens list and type at once', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      expect(await config.length()).to.be.eq(3)
      expect(await config.getTokens()).to.be.have.members([tokenA, tokenB, tokenC])

      await config.set(TYPE.ALLOW_LIST, [tokenC, tokenA])

      expect(await config.isDenyList()).to.be.false
      expect(await config.isAllowList()).to.be.true

      expect(await config.length()).to.be.eq(2)
      expect(await config.getTokens()).to.be.have.members([tokenC, tokenA])
    })

    it('can validates correctly', async () => {
      await config.add(tokenA)

      expect(await config.isValid(tokenA)).to.be.false
      expect(await config.isValid(tokenB)).to.be.true
      expect(await config.isValid(tokenC)).to.be.true
      await expect(config.validate(tokenA)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenB)).not.to.be.reverted
      await expect(config.validate(tokenC)).not.to.be.reverted

      await config.add(tokenC)

      expect(await config.isValid(tokenA)).to.be.false
      expect(await config.isValid(tokenB)).to.be.true
      expect(await config.isValid(tokenC)).to.be.false
      await expect(config.validate(tokenA)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenB)).not.to.be.reverted
      await expect(config.validate(tokenC)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')

      await config.add(tokenB)

      expect(await config.isValid(tokenA)).to.be.false
      expect(await config.isValid(tokenB)).to.be.false
      expect(await config.isValid(tokenC)).to.be.false
      await expect(config.validate(tokenA)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenB)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenC)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')

      await config.remove(tokenA)
      await config.remove(tokenB)

      expect(await config.isValid(tokenA)).to.be.true
      expect(await config.isValid(tokenB)).to.be.true
      expect(await config.isValid(tokenC)).to.be.false
      await expect(config.validate(tokenA)).not.to.be.reverted
      await expect(config.validate(tokenB)).not.to.be.reverted
      await expect(config.validate(tokenC)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')

      await config.set(TYPE.ALLOW_LIST, [tokenC, tokenA])

      expect(await config.isValid(tokenA)).to.be.true
      expect(await config.isValid(tokenB)).to.be.false
      expect(await config.isValid(tokenC)).to.be.true
      await expect(config.validate(tokenA)).not.to.be.reverted
      await expect(config.validate(tokenB)).to.be.revertedWith('TOKEN_ACCEPTANCE_FORBIDDEN')
      await expect(config.validate(tokenC)).not.to.be.reverted
    })
  })
})
