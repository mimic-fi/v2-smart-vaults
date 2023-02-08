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

  beforeEach('deploy map', async () => {
    config = await deploy('TokensAcceptanceMock')
  })

  describe('init', () => {
    it('starts empty', async () => {
      expect(await config.length()).to.be.eq(0)
      expect(await config.values()).to.be.empty
    })

    it('is an allow list by default', async () => {
      expect(await config.isAllowList()).to.be.true
      expect(await config.isDenyList()).to.be.false
    })
  })

  describe('allow list', () => {
    it('can adds tokens', async () => {
      await config.add(tokenA)
      await config.add(tokenB)

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenA, tokenB])
    })

    it('adds multiple tokens at once', async () => {
      await config.addMany([tokenA, tokenC])

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenA, tokenC])
    })

    it('removes tokens', async () => {
      await config.add(tokenA)
      await config.add(tokenB)
      await config.add(tokenC)
      await config.remove(tokenB)

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenA, tokenC])
    })

    it('removes many tokens at once', async () => {
      await config.addMany([tokenA, tokenB, tokenC])
      await config.removeMany([tokenA, tokenC])

      expect(await config.length()).to.be.eq(1)
      expect(await config.values()).to.be.have.members([tokenB])
    })

    it('can overrides the list of tokens', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      expect(await config.length()).to.be.eq(3)
      expect(await config.values()).to.be.have.members([tokenA, tokenB, tokenC])

      await config.setTokens([tokenC, tokenA])

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenC, tokenA])
    })

    it('can be changed to a deny list', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      await config.setType(TYPE.DENY_LIST)

      expect(await config.isDenyList()).to.be.true
      expect(await config.isAllowList()).to.be.false

      expect(await config.length()).to.be.eq(3)
      expect(await config.values()).to.be.have.members([tokenA, tokenB, tokenC])
    })

    it('can overrides the tokens list and type at once', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      expect(await config.length()).to.be.eq(3)
      expect(await config.values()).to.be.have.members([tokenA, tokenB, tokenC])

      await config.set(TYPE.DENY_LIST, [tokenC, tokenA])

      expect(await config.isDenyList()).to.be.true
      expect(await config.isAllowList()).to.be.false

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenC, tokenA])
    })
  })

  describe('deny list', () => {
    before('set to deny list', async () => {
      await config.setType(TYPE.DENY_LIST)
    })

    it('can adds tokens', async () => {
      await config.add(tokenA)
      await config.add(tokenB)

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenA, tokenB])
    })

    it('adds multiple tokens at once', async () => {
      await config.addMany([tokenA, tokenC])

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenA, tokenC])
    })

    it('removes tokens', async () => {
      await config.add(tokenA)
      await config.add(tokenB)
      await config.add(tokenC)
      await config.remove(tokenB)

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenA, tokenC])
    })

    it('removes many tokens at once', async () => {
      await config.addMany([tokenA, tokenB, tokenC])
      await config.removeMany([tokenA, tokenC])

      expect(await config.length()).to.be.eq(1)
      expect(await config.values()).to.be.have.members([tokenB])
    })

    it('can overrides the list of tokens', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      expect(await config.length()).to.be.eq(3)
      expect(await config.values()).to.be.have.members([tokenA, tokenB, tokenC])

      await config.setTokens([tokenC, tokenA])

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenC, tokenA])
    })

    it('can be changed to an allow list', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      await config.setType(TYPE.ALLOW_LIST)

      expect(await config.isDenyList()).to.be.false
      expect(await config.isAllowList()).to.be.true

      expect(await config.length()).to.be.eq(3)
      expect(await config.values()).to.be.have.members([tokenA, tokenB, tokenC])
    })

    it('can overrides the tokens list and type at once', async () => {
      await config.addMany([tokenA, tokenB, tokenC])

      expect(await config.length()).to.be.eq(3)
      expect(await config.values()).to.be.have.members([tokenA, tokenB, tokenC])

      await config.set(TYPE.ALLOW_LIST, [tokenC, tokenA])

      expect(await config.isDenyList()).to.be.false
      expect(await config.isAllowList()).to.be.true

      expect(await config.length()).to.be.eq(2)
      expect(await config.values()).to.be.have.members([tokenC, tokenA])
    })
  })
})
