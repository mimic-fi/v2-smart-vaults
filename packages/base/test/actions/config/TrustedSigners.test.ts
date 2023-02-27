import { deploy, getSigners } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, utils } from 'ethers'

describe('TrustedSigners', () => {
  let config: Contract
  let signer: SignerWithAddress, anotherSigner: SignerWithAddress

  before('load signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, signer, anotherSigner] = await getSigners()
  })

  beforeEach('deploy acceptance list', async () => {
    config = await deploy('TrustedSignersMock')
  })

  describe('setRequired', () => {
    it('it is not required', async () => {
      expect(await config.isRequired()).to.be.false
    })

    it('it can be changed to required', async () => {
      await config.setRequired(true)
      expect(await config.isRequired()).to.be.true

      await config.setRequired(false)
      expect(await config.isRequired()).to.be.false
    })
  })

  describe('setSigners', () => {
    it('starts empty', async () => {
      expect(await config.getSigners()).to.be.empty
    })

    it('can add signers', async () => {
      await config.addSigner(signer.address)

      expect(await config.getSigners()).to.be.have.members([signer.address])
      expect(await config.isSigner(signer.address)).to.be.true
      expect(await config.isSigner(anotherSigner.address)).to.be.false

      await config.addSigner(anotherSigner.address)

      expect(await config.getSigners()).to.be.have.members([signer.address, anotherSigner.address])
      expect(await config.isSigner(signer.address)).to.be.true
      expect(await config.isSigner(anotherSigner.address)).to.be.true
    })

    it('adds multiple signers at once', async () => {
      await config.addSigners([signer.address, anotherSigner.address])

      expect(await config.isSigner(signer.address)).to.be.true
      expect(await config.isSigner(anotherSigner.address)).to.be.true

      expect(await config.getSigners()).to.be.have.members([signer.address, anotherSigner.address])
    })

    it('removes signers', async () => {
      await config.addSigners([signer.address, anotherSigner.address])
      await config.removeSigner(signer.address)

      expect(await config.isSigner(signer.address)).to.be.false
      expect(await config.isSigner(anotherSigner.address)).to.be.true

      expect(await config.getSigners()).to.be.have.members([anotherSigner.address])
    })

    it('cleans list', async () => {
      await config.addSigners([signer.address, anotherSigner.address])
      await config.cleanSigners()

      expect(await config.getSigners()).to.be.have.members([])
    })

    it('can override the list of signers', async () => {
      await config.addSigners([signer.address, anotherSigner.address])

      expect(await config.getSigners()).to.be.have.members([signer.address, anotherSigner.address])

      await config.setSigners([])

      expect(await config.getSigners()).to.be.have.members([])

      await config.setSigners([anotherSigner.address])

      expect(await config.getSigners()).to.be.have.members([anotherSigner.address])
    })
  })

  describe('validate', () => {
    const MESSAGE = 'hello world!'

    const sign = async (account: SignerWithAddress, message?: string): Promise<string> => {
      const hashedMessage = utils.solidityKeccak256(['string'], [message || MESSAGE])
      return account.signMessage(utils.arrayify(hashedMessage))
    }

    const assertValid = async (signature: string, message?: string): Promise<void> => {
      const hashedMessage = utils.solidityKeccak256(['string'], [message || MESSAGE])
      expect(await config.isValid(hashedMessage, signature)).to.be.true
      await expect(config.validate(hashedMessage, signature)).not.to.be.reverted
    }

    const assertInvalid = async (signature: string, message?: string): Promise<void> => {
      const hashedMessage = utils.solidityKeccak256(['string'], [message || MESSAGE])
      expect(await config.isValid(hashedMessage, signature)).to.be.false
      await expect(config.validate(hashedMessage, signature)).to.be.revertedWith('TRUSTED_SIGNER_FORBIDDEN')
    }

    context('when the signature is not required', () => {
      context('when the signer was added', () => {
        beforeEach('add signer', async () => {
          await config.addSigner(signer.address)
        })

        it('any signature is considered valid', async () => {
          const signerSignature = await sign(signer, 'hello')
          await assertValid(signerSignature, 'hello')
          await assertValid(signerSignature, 'chau')

          const anotherSignerSignature = await sign(anotherSigner, 'hello')
          await assertValid(anotherSignerSignature, 'hello')
          await assertValid(anotherSignerSignature, 'chau')
        })
      })

      context('when the signer was not added', () => {
        it('any signature is considered valid', async () => {
          const signerSignature = await sign(signer, 'hello')
          await assertValid(signerSignature, 'hello')
          await assertValid(signerSignature, 'chau')

          const anotherSignerSignature = await sign(anotherSigner, 'hello')
          await assertValid(anotherSignerSignature, 'hello')
          await assertValid(anotherSignerSignature, 'chau')
        })
      })
    })

    context('when the signature is required', () => {
      beforeEach('set required', async () => {
        await config.setRequired(true)
      })

      context('when the signer was added', () => {
        beforeEach('add signer', async () => {
          await config.addSigner(signer.address)
        })

        it('only signer signatures are considered invalid', async () => {
          const signerSignature = await sign(signer, 'hello')
          await assertValid(signerSignature, 'hello')
          await assertInvalid(signerSignature, 'chau')

          const anotherSignerSignature = await sign(anotherSigner)
          await assertInvalid(anotherSignerSignature, 'hello')
          await assertInvalid(anotherSignerSignature, 'chau')
        })
      })

      context('when the signer was not added', () => {
        it('any signature is considered invalid', async () => {
          const signerSignature = await sign(signer, 'hello')
          await assertInvalid(signerSignature, 'hello')
          await assertInvalid(signerSignature, 'chau')

          const anotherSignerSignature = await sign(anotherSigner, 'hello')
          await assertInvalid(anotherSignerSignature, 'hello')
          await assertInvalid(anotherSignerSignature, 'chau')
        })
      })
    })
  })
})
