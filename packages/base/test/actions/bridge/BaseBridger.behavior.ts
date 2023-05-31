import { assertEvent, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { createTokenMock } from '@mimic-fi/v2-smart-vaults-base'
import { expect } from 'chai'
import { Contract } from 'ethers'

export function itBehavesLikeBridgerAction(): void {
  describe('setDefaultDestinationChain', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setDestinationChainRole = this.action.interface.getSighash('setDefaultDestinationChain')
        await this.action.connect(this.owner).authorize(this.owner.address, setDestinationChainRole)
        this.action = this.action.connect(this.owner)
      })

      context('when setting the destination chain', () => {
        const itSetsTheChainCorrectly = () => {
          context('when the destination chain is not the current one', () => {
            const chainId = 1

            it('sets the destination chain', async function () {
              await this.action.setDefaultDestinationChain(chainId)

              expect(await this.action.getDefaultDestinationChain()).to.be.equal(chainId)
            })

            it('emits an event', async function () {
              const tx = await this.action.setDefaultDestinationChain(chainId)

              await assertEvent(tx, 'DefaultDestinationChainSet', { defaultDestinationChain: chainId })
            })
          })

          context('when the destination chain is the current one', () => {
            const chainId = 31337 // Hardhat destination chain

            it('reverts', async function () {
              await expect(this.action.setDefaultDestinationChain(chainId)).to.be.revertedWith(
                'ACTION_BRIDGE_CURRENT_CHAIN_ID'
              )
            })
          })
        }

        context('when the destination chain was set', () => {
          beforeEach('set destination chain', async function () {
            await this.action.setDefaultDestinationChain(1)
          })

          itSetsTheChainCorrectly()
        })

        context('when the destination chain was not set', () => {
          beforeEach('unset destination chain', async function () {
            await this.action.setDefaultDestinationChain(0)
          })

          itSetsTheChainCorrectly()
        })
      })

      context('when unsetting the destination chain', () => {
        const itUnsetsTheChainCorrectly = () => {
          it('unsets the destination chain', async function () {
            await this.action.setDefaultDestinationChain(0)

            expect(await this.action.getDefaultDestinationChain()).to.be.equal(0)
          })

          it('emits an event', async function () {
            const tx = await this.action.setDefaultDestinationChain(0)

            await assertEvent(tx, 'DefaultDestinationChainSet', { defaultDestinationChain: 0 })
          })
        }

        context('when the destination chain was set', () => {
          beforeEach('set destination chain', async function () {
            await this.action.setDefaultDestinationChain(1)
          })

          itUnsetsTheChainCorrectly()
        })

        context('when the destination chain was not set', () => {
          beforeEach('unset destination chain', async function () {
            await this.action.setDefaultDestinationChain(0)
          })

          itUnsetsTheChainCorrectly()
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.action.setDefaultDestinationChain(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setCustomDestinationChains', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setCustomDestinationChainsRole = this.action.interface.getSighash('setCustomDestinationChains')
        await this.action.connect(this.owner).authorize(this.owner.address, setCustomDestinationChainsRole)
        this.action = this.action.connect(this.owner)
      })

      context('when setting the destination chain', () => {
        context('when the destination chain is not the current one', () => {
          const chainId = 1

          const itSetsTheChainCorrectly = () => {
            it('sets the destination chain', async function () {
              await this.action.setCustomDestinationChains([token.address], [chainId])

              const destinationChain = await this.action.getCustomDestinationChain(token.address)
              expect(destinationChain[0]).to.be.true
              expect(destinationChain[1]).to.be.equal(chainId)
            })

            it('emits an event', async function () {
              const tx = await this.action.setCustomDestinationChains([token.address], [chainId])

              await assertEvent(tx, 'CustomDestinationChainSet', { token, defaultDestinationChain: chainId })
            })
          }

          context('when the destination chain was set', () => {
            beforeEach('set destination chain', async function () {
              await this.action.setCustomDestinationChains([token.address], [1])
            })

            itSetsTheChainCorrectly()
          })

          context('when the destination chain was not set', () => {
            beforeEach('unset destination chain', async function () {
              await this.action.setCustomDestinationChains([token.address], [0])
            })

            itSetsTheChainCorrectly()
          })
        })

        context('when the destination chain is the current one', () => {
          const chainId = 31337 // Hardhat destination chain

          it('reverts', async function () {
            await expect(this.action.setCustomDestinationChains([token.address], [chainId])).to.be.revertedWith(
              'ACTION_BRIDGE_CURRENT_CHAIN_ID'
            )
          })
        })
      })

      context('when unsetting the destination chain', () => {
        const itUnsetsTheChainCorrectly = () => {
          it('unsets the destination chain', async function () {
            await this.action.setCustomDestinationChains([token.address], [0])

            const destinationChain = await this.action.getCustomDestinationChain(token.address)
            expect(destinationChain[0]).to.be.false
            expect(destinationChain[1]).to.be.equal(0)
          })

          it('emits an event', async function () {
            const tx = await this.action.setCustomDestinationChains([token.address], [0])

            await assertEvent(tx, 'CustomDestinationChainSet', { token, defaultDestinationChain: 0 })
          })
        }

        context('when the destination chain was set', () => {
          beforeEach('set destination chain', async function () {
            await this.action.setCustomDestinationChains([token.address], [1])
          })

          itUnsetsTheChainCorrectly()
        })

        context('when the destination chain was not set', () => {
          beforeEach('unset destination chain', async function () {
            await this.action.setCustomDestinationChains([token.address], [0])
          })

          itUnsetsTheChainCorrectly()
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.action.setCustomDestinationChains([ZERO_ADDRESS], [0])).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })
}
