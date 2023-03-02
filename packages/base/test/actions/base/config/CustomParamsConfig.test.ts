import { assertEvent, assertNoEvent, deploy, getSigner } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract } from 'ethers'

describe('CustomParamsConfig', () => {
  let action: Contract, admin: SignerWithAddress

  const key1 = '0x0000000000000000000000000000000000000000000000000000000000000001'
  const key2 = '0x0000000000000000000000000000000000000000000000000000000000000002'
  const key3 = '0x0000000000000000000000000000000000000000000000000000000000000003'

  const value1 = '0x1000000000000000000000000000000000000000000000000000000000000000'
  const value2 = '0x2000000000000000000000000000000000000000000000000000000000000000'
  const value3 = '0x3000000000000000000000000000000000000000000000000000000000000000'

  before('load signer', async () => {
    admin = await getSigner(2)
  })

  beforeEach('deploy action', async () => {
    action = await deploy('CustomParamsConfigMock')
  })

  describe('setCustomParams', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setCustomParamsRole = action.interface.getSighash('setCustomParams')
        await action.authorize(admin.address, setCustomParamsRole)
        action = action.connect(admin)
      })

      context('when the input length is valid', () => {
        context('when there were no params set yet', () => {
          it('sets all the given param values', async () => {
            await action.setCustomParams([key1, key2, key3], [value1, value2, value3])

            const param1 = await action.getCustomParam(key1)
            expect(param1.exists).to.be.true
            expect(param1.value).to.be.equal(value1)

            const param2 = await action.getCustomParam(key2)
            expect(param2.exists).to.be.true
            expect(param2.value).to.be.equal(value2)

            const param3 = await action.getCustomParam(key3)
            expect(param3.exists).to.be.true
            expect(param3.value).to.be.equal(value3)

            const [keys, values] = await action.getCustomParams()
            expect(keys).to.have.members([key1, key2, key3])
            expect(values).to.have.members([value1, value2, value3])
          })

          it('emits an event', async () => {
            const tx = await action.setCustomParams([key1, key2, key3], [value1, value2, value3])

            await assertEvent(tx, 'CustomParamSet', { key: key1, value: value1 })
            await assertEvent(tx, 'CustomParamSet', { key: key2, value: value2 })
            await assertEvent(tx, 'CustomParamSet', { key: key3, value: value3 })
          })
        })

        context('when there were some params set already', () => {
          beforeEach('set params', async () => {
            await action.setCustomParams([key1], [value3])
          })

          it('overrides any pre-existent values', async () => {
            await action.setCustomParams([key1, key2, key3], [value1, value2, value3])

            const param1 = await action.getCustomParam(key1)
            expect(param1.exists).to.be.true
            expect(param1.value).to.be.equal(value1)

            const param2 = await action.getCustomParam(key2)
            expect(param2.exists).to.be.true
            expect(param2.value).to.be.equal(value2)

            const param3 = await action.getCustomParam(key3)
            expect(param3.exists).to.be.true
            expect(param3.value).to.be.equal(value3)

            const [keys, values] = await action.getCustomParams()
            expect(keys).to.have.members([key1, key2, key3])
            expect(values).to.have.members([value1, value2, value3])
          })

          it('emits an event', async () => {
            const tx = await action.setCustomParams([key1, key2, key3], [value1, value2, value3])

            await assertEvent(tx, 'CustomParamSet', { key: key1, value: value1 })
            await assertEvent(tx, 'CustomParamSet', { key: key2, value: value2 })
            await assertEvent(tx, 'CustomParamSet', { key: key3, value: value3 })
          })
        })
      })

      context('when the input length is valid', () => {
        it('reverts', async () => {
          await expect(action.setCustomParams([key1], [])).to.be.revertedWith('CUSTOM_PARAMS_INPUT_INVALID_LEN')
          await expect(action.setCustomParams([], [value1])).to.be.revertedWith('CUSTOM_PARAMS_INPUT_INVALID_LEN')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setCustomParams([], [])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('unsetCustomParams', () => {
    beforeEach('authorize sender', async () => {
      const setCustomParamsRole = action.interface.getSighash('setCustomParams')
      await action.authorize(admin.address, setCustomParamsRole)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const unsetCustomParamsRole = action.interface.getSighash('unsetCustomParams')
        await action.authorize(admin.address, unsetCustomParamsRole)
        action = action.connect(admin)
      })

      context('when there were no params set yet', () => {
        it('ignores the request', async () => {
          await action.unsetCustomParams([key1, key2, key3])

          expect(await action.hasCustomParam(key1)).to.be.false
          expect(await action.hasCustomParam(key2)).to.be.false
          expect(await action.hasCustomParam(key3)).to.be.false
        })

        it('does not emit an event', async () => {
          const tx = await action.unsetCustomParams([key1, key2, key3])

          await assertNoEvent(tx, 'CustomParamUnset')
        })
      })

      context('when there were some params set already', () => {
        beforeEach('set params', async () => {
          await action.setCustomParams([key1], [value3])
        })

        it('overrides any pre-existent values', async () => {
          await action.unsetCustomParams([key1, key2, key3])

          expect(await action.hasCustomParam(key1)).to.be.false
          expect(await action.hasCustomParam(key2)).to.be.false
          expect(await action.hasCustomParam(key3)).to.be.false
        })

        it('emits an event', async () => {
          const tx = await action.unsetCustomParams([key1, key2, key3])

          await assertEvent(tx, 'CustomParamUnset', { key: key1 })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.unsetCustomParams([])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
