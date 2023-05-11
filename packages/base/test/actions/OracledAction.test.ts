import {
  advanceTime,
  assertEvent,
  assertIndirectEvent,
  assertNoEvent,
  currentTimestamp,
  DAY,
  deploy,
  fp,
  getSigner,
  getSigners,
} from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'

import { createSmartVault, createTokenMock, Mimic, setupMimic } from '../../dist'
import { buildExtraFeedData, FeedData } from '../../src/oracle'
import { createPriceFeedMock } from '../../src/samples'

describe('OracledAction', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic, owner: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await deploy('OracledActionMock', [smartVault.address, owner.address, mimic.registry.address])
  })

  describe('setOracleSigner', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setOracleSignerRole = action.interface.getSighash('setOracleSigner')
        await action.connect(owner).authorize(owner.address, setOracleSignerRole)
        action = action.connect(owner)
      })

      context('when allowing the signer', () => {
        const allowed = true

        context('when the signer was not allowed', () => {
          it('allows the signer', async () => {
            await action.setOracleSigner(owner.address, allowed)
            expect(await action.isOracleSigner(owner.address)).to.be.true
          })

          it('emits an event', async () => {
            const tx = await action.setOracleSigner(owner.address, allowed)
            await assertEvent(tx, 'OracleSignerSet', { signer: owner, allowed })
          })
        })

        context('when the signer was not allowed', () => {
          beforeEach('allow signer', async () => {
            await action.setOracleSigner(owner.address, true)
          })

          it('does not affect the signer condition', async () => {
            await action.setOracleSigner(owner.address, allowed)
            expect(await action.isOracleSigner(owner.address)).to.be.true
          })

          it('does not emit an event', async () => {
            const tx = await action.setOracleSigner(owner.address, allowed)
            await assertNoEvent(tx, 'OracleSignerSet')
          })
        })
      })

      context('when removing the signer', () => {
        const allowed = false

        context('when the signer was not allowed', () => {
          it('does not affect the signer condition', async () => {
            await action.setOracleSigner(owner.address, allowed)
            expect(await action.isOracleSigner(owner.address)).to.be.false
          })

          it('does not emit an event', async () => {
            const tx = await action.setOracleSigner(owner.address, allowed)
            await assertNoEvent(tx, 'OracleSignerSet')
          })
        })

        context('when the signer was allowed', () => {
          beforeEach('allow signer', async () => {
            await action.setOracleSigner(owner.address, true)
          })

          it('removes the oracle signer', async () => {
            await action.setOracleSigner(owner.address, allowed)
            expect(await action.isOracleSigner(owner.address)).to.be.false
          })

          it('emits an event', async () => {
            const tx = await action.setOracleSigner(owner.address, allowed)
            await assertEvent(tx, 'OracleSignerSet', { signer: owner, allowed })
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(action.setOracleSigner(owner.address, true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('getPrice', () => {
    let base: Contract, quote: Contract, feed: Contract, extraCallData: string

    const OFF_CHAIN_ORACLE_PRICE = fp(5)
    const SMART_VAULT_ORACLE_PRICE = fp(10)

    before('deploy base and quote', async () => {
      base = await createTokenMock('BASE')
      quote = await createTokenMock('QUOTE')
      feed = await createPriceFeedMock(SMART_VAULT_ORACLE_PRICE)
    })

    const setUpSmartVaultOracleFeed = () => {
      beforeEach('set smart vault oracle', async () => {
        const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
        await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
        await smartVault.connect(owner).setPriceFeed(base.address, quote.address, feed.address)
      })
    }

    const itRetrievesThePriceFromTheSmartVaultOracle = () => {
      it('retrieves the pair price from the smart vault oracle', async () => {
        expect(await getPrice()).to.be.equal(SMART_VAULT_ORACLE_PRICE)
      })
    }

    const itRetrievesThePriceFromTheOffChainFeed = () => {
      it('retrieves the pair price from the off-chain feed', async () => {
        expect(await getPrice()).to.be.equal(OFF_CHAIN_ORACLE_PRICE)
      })
    }

    const itRevertsDueToMissingFeed = () => {
      it('reverts due to missing feed', async () => {
        await expect(getPrice()).to.be.revertedWith('MISSING_PRICE_FEED')
      })
    }

    const getPrice = async (): Promise<BigNumber> => {
      const defaultCallData = await action.populateTransaction.getPrice(base.address, quote.address)
      const signer = await getSigner()
      const callData = `${defaultCallData.data}${(extraCallData || '').replace('0x', '')}`
      const tx = await signer.sendTransaction({ to: action.address, data: callData })
      const event = await assertIndirectEvent(tx, action.interface, 'LogPrice')
      return event.args.price
    }

    context('when there is no off-chain feed given', () => {
      context('when there is no feed in the smart vault oracle', () => {
        itRevertsDueToMissingFeed()
      })

      context('when there is a feed in the smart vault oracle', () => {
        setUpSmartVaultOracleFeed()
        itRetrievesThePriceFromTheSmartVaultOracle()
      })
    })

    context('when the feed data is well-formed', () => {
      let feedsData: FeedData[]

      const itRetrievesPricesProperly = () => {
        context('when the feed data is properly signed', () => {
          beforeEach('sign with known signer', async () => {
            const signer = await getSigner(2)
            extraCallData = await buildExtraFeedData(action, feedsData, signer)

            const setOracleSignerRole = action.interface.getSighash('setOracleSigner')
            await action.connect(owner).authorize(owner.address, setOracleSignerRole)
            await action.connect(owner).setOracleSigner(signer.address, true)
          })

          context('when the feed data is up-to-date', () => {
            context('when there is no feed in the smart vault oracle', () => {
              itRetrievesThePriceFromTheOffChainFeed()
            })

            context('when there is a feed in the smart vault oracle', () => {
              setUpSmartVaultOracleFeed()
              itRetrievesThePriceFromTheOffChainFeed()
            })
          })

          context('when the feed data is outdated', () => {
            beforeEach('advance time', async () => {
              await advanceTime(DAY * 2)
            })

            const itRevertsDueToOutdatedFeed = () => {
              it('reverts due to outdated feed', async () => {
                await expect(getPrice()).to.be.revertedWith('ORACLE_FEED_OUTDATED')
              })
            }

            context('when there is no feed in the smart vault oracle', () => {
              itRevertsDueToOutdatedFeed()
            })

            context('when there is a feed in the smart vault oracle', () => {
              setUpSmartVaultOracleFeed()
              itRevertsDueToOutdatedFeed()
            })
          })
        })

        context('when the feed data is not properly signed', () => {
          beforeEach('sign with unknown signer', async () => {
            const signer = await getSigner(2)
            extraCallData = await buildExtraFeedData(action, feedsData, signer)
          })

          context('when there is no feed in the smart vault oracle', () => {
            itRevertsDueToMissingFeed()
          })

          context('when there is a feed in the smart vault oracle', () => {
            setUpSmartVaultOracleFeed()
            itRetrievesThePriceFromTheSmartVaultOracle()
          })
        })
      }

      context('when there is only one feed given', () => {
        beforeEach('build feed data', async () => {
          feedsData = [
            {
              base: base.address,
              quote: quote.address,
              rate: OFF_CHAIN_ORACLE_PRICE,
              deadline: (await currentTimestamp()).add(DAY),
            },
          ]
        })

        itRetrievesPricesProperly()
      })

      context('when there are many feeds given', () => {
        let anotherBase: Contract, anotherQuote: Contract

        before('deploy another base and quote', async () => {
          anotherBase = await createTokenMock('ANOTHER_BASE')
          anotherQuote = await createTokenMock('ANOTHER_QUOTE')
        })

        beforeEach('build feed data', async () => {
          const deadline = (await currentTimestamp()).add(DAY)
          feedsData = [
            { base: base.address, quote: anotherQuote.address, rate: OFF_CHAIN_ORACLE_PRICE.mul(2), deadline },
            { base: base.address, quote: quote.address, rate: OFF_CHAIN_ORACLE_PRICE, deadline },
            { base: anotherBase.address, quote: anotherQuote.address, rate: OFF_CHAIN_ORACLE_PRICE.mul(3), deadline },
          ]
        })

        itRetrievesPricesProperly()
      })
    })

    context('when the feed data is malformed', () => {
      beforeEach('set malformed extra calldata', async () => {
        extraCallData = '0xaabbccdd'
      })

      context('when there is no feed in the smart vault oracle', () => {
        itRevertsDueToMissingFeed()
      })

      context('when there is a feed in the smart vault oracle', () => {
        setUpSmartVaultOracleFeed()
        itRetrievesThePriceFromTheSmartVaultOracle()
      })
    })
  })
})
