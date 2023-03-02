import { assertEvent, deploy, getSigner, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract } from 'ethers'

/* eslint-disable no-secrets/no-secrets */

const TYPE: { [key: string]: number } = {
  DENY_LIST: 0,
  ALLOW_LIST: 1,
}

describe('TokenConfig', () => {
  let action: Contract, admin: SignerWithAddress

  const tokenA = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  const tokenB = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  const tokenC = '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621'

  before('load signer', async () => {
    admin = await getSigner(2)
  })

  describe('setTokensAcceptanceType', () => {
    beforeEach('deploy action', async () => {
      action = await deploy('TokenConfigMock', [TYPE.DENY_LIST, []])
    })

    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setTokensAcceptanceTypeRole = action.interface.getSighash('setTokensAcceptanceType')
        await action.authorize(admin.address, setTokensAcceptanceTypeRole)
        action = action.connect(admin)
      })

      const itCanBeUpdatedProperly = (type: number) => {
        it('can be updated', async () => {
          const tx = await action.setTokensAcceptanceType(type)

          expect(await action.getTokensAcceptanceType()).to.be.equal(type)
          await assertEvent(tx, 'TokensAcceptanceTypeSet', { acceptanceType: type })
        })
      }

      context('when it was an allow list', () => {
        beforeEach('set allow list', async () => {
          await action.setTokensAcceptanceType(TYPE.ALLOW_LIST)
        })

        context('when updating it to an allow list', () => {
          itCanBeUpdatedProperly(TYPE.ALLOW_LIST)
        })

        context('when updating it to a deny list', () => {
          itCanBeUpdatedProperly(TYPE.DENY_LIST)
        })
      })

      context('when it was a deny list', () => {
        beforeEach('set deny list', async () => {
          await action.setTokensAcceptanceType(TYPE.DENY_LIST)
        })

        context('when updating it to an allow list', () => {
          itCanBeUpdatedProperly(TYPE.ALLOW_LIST)
        })

        context('when updating it to a deny list', () => {
          itCanBeUpdatedProperly(TYPE.DENY_LIST)
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(action.setTokensAcceptanceType(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setTokensAcceptanceList', () => {
    beforeEach('deploy action', async () => {
      action = await deploy('TokenConfigMock', [TYPE.ALLOW_LIST, []])
    })

    context('when the sender is allowed', () => {
      beforeEach('authorize sender', async () => {
        const setTokensAcceptanceListRole = action.interface.getSighash('setTokensAcceptanceList')
        await action.authorize(admin.address, setTokensAcceptanceListRole)
        action = action.connect(admin)
      })

      context('when no address zero is given', () => {
        it('updates the list of allowed tokens', async () => {
          await action.setTokensAcceptanceList([tokenA], [])

          expect(await action.isTokenAllowed(tokenA)).to.be.true
          expect(await action.isTokenAllowed(tokenB)).to.be.false
          expect(await action.isTokenAllowed(tokenC)).to.be.false

          await action.setTokensAcceptanceList([tokenB, tokenC], [tokenA])

          expect(await action.isTokenAllowed(tokenA)).to.be.false
          expect(await action.isTokenAllowed(tokenB)).to.be.true
          expect(await action.isTokenAllowed(tokenC)).to.be.true

          await action.setTokensAcceptanceList([tokenA], [tokenA])

          expect(await action.isTokenAllowed(tokenA)).to.be.false
          expect(await action.isTokenAllowed(tokenB)).to.be.true
          expect(await action.isTokenAllowed(tokenC)).to.be.true

          await action.setTokensAcceptanceList([tokenA, tokenB], [tokenC])

          expect(await action.isTokenAllowed(tokenA)).to.be.true
          expect(await action.isTokenAllowed(tokenB)).to.be.true
          expect(await action.isTokenAllowed(tokenC)).to.be.false
        })

        it('emits events only when the allow list is modified', async () => {
          const tx1 = await action.setTokensAcceptanceList([tokenA], [])

          await assertEvent(tx1, 'TokensAcceptanceAdded', { token: tokenA })

          expect(await action.isTokenAllowed(tokenA)).to.be.true
          expect(await action.isTokenAllowed(tokenB)).to.be.false
          expect(await action.isTokenAllowed(tokenC)).to.be.false

          const tx2 = await action.setTokensAcceptanceList([tokenB, tokenC], [tokenA])

          await assertEvent(tx2, 'TokensAcceptanceAdded', { token: tokenB })
          await assertEvent(tx2, 'TokensAcceptanceAdded', { token: tokenC })
          await assertEvent(tx2, 'TokensAcceptanceRemoved', { token: tokenA })

          const tx3 = await action.setTokensAcceptanceList([tokenA], [tokenA])

          await assertEvent(tx3, 'TokensAcceptanceAdded', { token: tokenA })
          await assertEvent(tx3, 'TokensAcceptanceRemoved', { token: tokenA })

          const tx4 = await action.setTokensAcceptanceList([tokenA, tokenB], [tokenC])

          await assertEvent(tx4, 'TokensAcceptanceAdded', { token: tokenA })
          await assertEvent(tx4, 'TokensAcceptanceRemoved', { token: tokenC })
        })
      })

      context('when no address zero is given', () => {
        it('reverts', async () => {
          await expect(action.setTokensAcceptanceList([ZERO_ADDRESS], [])).to.be.revertedWith('TOKEN_ADDRESS_ZERO')
        })
      })
    })

    context('when the sender is not allowed', () => {
      it('reverts', async () => {
        await expect(action.setTokensAcceptanceList([], [])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  context('validate', () => {
    describe('when validating an allow list', () => {
      beforeEach('deploy action', async () => {
        action = await deploy('TokenConfigMock', [TYPE.ALLOW_LIST, []])
        const setTokensAcceptanceTypeRole = action.interface.getSighash('setTokensAcceptanceType')
        await action.authorize(admin.address, setTokensAcceptanceTypeRole)
        const setTokensAcceptanceListRole = action.interface.getSighash('setTokensAcceptanceList')
        await action.authorize(admin.address, setTokensAcceptanceListRole)
      })

      it('calls tokens correctly', async () => {
        await action.connect(admin).setTokensAcceptanceList([tokenA], [])

        expect(await action.isTokenAllowed(tokenA)).to.be.true
        expect(await action.isTokenAllowed(tokenB)).to.be.false
        expect(await action.isTokenAllowed(tokenC)).to.be.false
        await expect(action.call(tokenA)).not.to.be.reverted
        await expect(action.call(tokenB)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenC)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')

        await action.connect(admin).setTokensAcceptanceList([tokenC], [])

        expect(await action.isTokenAllowed(tokenA)).to.be.true
        expect(await action.isTokenAllowed(tokenB)).to.be.false
        expect(await action.isTokenAllowed(tokenC)).to.be.true
        await expect(action.call(tokenA)).not.to.be.reverted
        await expect(action.call(tokenB)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenC)).not.to.be.reverted

        await action.connect(admin).setTokensAcceptanceList([tokenB], [])

        expect(await action.isTokenAllowed(tokenA)).to.be.true
        expect(await action.isTokenAllowed(tokenB)).to.be.true
        expect(await action.isTokenAllowed(tokenC)).to.be.true
        await expect(action.call(tokenA)).not.to.be.reverted
        await expect(action.call(tokenB)).not.to.be.reverted
        await expect(action.call(tokenC)).not.to.be.reverted

        await action.connect(admin).setTokensAcceptanceList([], [tokenA])
        await action.connect(admin).setTokensAcceptanceList([], [tokenB])

        expect(await action.isTokenAllowed(tokenA)).to.be.false
        expect(await action.isTokenAllowed(tokenB)).to.be.false
        expect(await action.isTokenAllowed(tokenC)).to.be.true
        await expect(action.call(tokenA)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenB)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenC)).not.to.be.reverted

        await action.connect(admin).setTokensAcceptanceType(TYPE.DENY_LIST)
        await action.connect(admin).setTokensAcceptanceList([tokenA], [tokenB])

        expect(await action.isTokenAllowed(tokenA)).to.be.false
        expect(await action.isTokenAllowed(tokenB)).to.be.true
        expect(await action.isTokenAllowed(tokenC)).to.be.false
        await expect(action.call(tokenA)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenB)).not.to.be.reverted
        await expect(action.call(tokenC)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
      })
    })

    describe('when validating a deny list', () => {
      beforeEach('deploy action', async () => {
        action = await deploy('TokenConfigMock', [TYPE.DENY_LIST, []])
        const setTokensAcceptanceTypeRole = action.interface.getSighash('setTokensAcceptanceType')
        await action.authorize(admin.address, setTokensAcceptanceTypeRole)
        const setTokensAcceptanceListRole = action.interface.getSighash('setTokensAcceptanceList')
        await action.authorize(admin.address, setTokensAcceptanceListRole)
      })

      it('calls tokens correctly', async () => {
        await action.connect(admin).setTokensAcceptanceList([tokenA], [])

        expect(await action.isTokenAllowed(tokenA)).to.be.false
        expect(await action.isTokenAllowed(tokenB)).to.be.true
        expect(await action.isTokenAllowed(tokenC)).to.be.true
        await expect(action.call(tokenA)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenB)).not.to.be.reverted
        await expect(action.call(tokenC)).not.to.be.reverted

        await action.connect(admin).setTokensAcceptanceList([tokenC], [])

        expect(await action.isTokenAllowed(tokenA)).to.be.false
        expect(await action.isTokenAllowed(tokenB)).to.be.true
        expect(await action.isTokenAllowed(tokenC)).to.be.false
        await expect(action.call(tokenA)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenB)).not.to.be.reverted
        await expect(action.call(tokenC)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')

        await action.connect(admin).setTokensAcceptanceList([tokenB], [])

        expect(await action.isTokenAllowed(tokenA)).to.be.false
        expect(await action.isTokenAllowed(tokenB)).to.be.false
        expect(await action.isTokenAllowed(tokenC)).to.be.false
        await expect(action.call(tokenA)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenB)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenC)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')

        await action.connect(admin).setTokensAcceptanceList([], [tokenA])
        await action.connect(admin).setTokensAcceptanceList([], [tokenB])

        expect(await action.isTokenAllowed(tokenA)).to.be.true
        expect(await action.isTokenAllowed(tokenB)).to.be.true
        expect(await action.isTokenAllowed(tokenC)).to.be.false
        await expect(action.call(tokenA)).not.to.be.reverted
        await expect(action.call(tokenB)).not.to.be.reverted
        await expect(action.call(tokenC)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')

        await action.connect(admin).setTokensAcceptanceType(TYPE.ALLOW_LIST)
        await action.connect(admin).setTokensAcceptanceList([tokenA], [tokenB])

        expect(await action.isTokenAllowed(tokenA)).to.be.true
        expect(await action.isTokenAllowed(tokenB)).to.be.false
        expect(await action.isTokenAllowed(tokenC)).to.be.true
        await expect(action.call(tokenA)).not.to.be.reverted
        await expect(action.call(tokenB)).to.be.revertedWith('ACTION_TOKEN_NOT_ALLOWED')
        await expect(action.call(tokenC)).not.to.be.reverted
      })
    })
  })
})
