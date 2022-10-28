import {
  assertAlmostEqual,
  assertEvent,
  assertIndirectEvent,
  assertNoIndirectEvent,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import { createAction, createTokenMock, createWallet, Mimic, setupMimic } from '..'
import { createPriceFeedMock } from '../src/samples'

describe('RelayedAction', () => {
  let action: Contract, wallet: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, feeCollector: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    wallet = await createWallet(mimic, owner)
    action = await createAction('RelayedActionMock', mimic, owner, wallet)
  })

  beforeEach('authorize action', async () => {
    const withdrawRole = wallet.interface.getSighash('withdraw')
    await wallet.connect(owner).authorize(action.address, withdrawRole)
  })

  beforeEach('set fee collector', async () => {
    const setFeeCollectorRole = wallet.interface.getSighash('setFeeCollector')
    await wallet.connect(owner).authorize(owner.address, setFeeCollectorRole)
    await wallet.connect(owner).setFeeCollector(feeCollector.address)
  })

  describe('setPermissiveMode', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setPermissiveModeRole = action.interface.getSighash('setPermissiveMode')
        await action.connect(owner).authorize(owner.address, setPermissiveModeRole)
        action = action.connect(owner)
      })

      context('when the permissive mode was inactive', async () => {
        it('can be activated', async () => {
          const tx = await action.setPermissiveMode(true)

          expect(await action.isPermissiveModeActive()).to.be.true
          await assertEvent(tx, 'PermissiveModeSet', { active: true })
        })

        it('can be deactivated', async () => {
          const tx = await action.setPermissiveMode(false)

          expect(await action.isPermissiveModeActive()).to.be.false
          await assertEvent(tx, 'PermissiveModeSet', { active: false })
        })
      })

      context('when the permissive mode was active', async () => {
        beforeEach('activate permissive mode', async () => {
          await action.setPermissiveMode(true)
        })

        it('can be activated', async () => {
          const tx = await action.setPermissiveMode(true)

          expect(await action.isPermissiveModeActive()).to.be.true
          await assertEvent(tx, 'PermissiveModeSet', { active: true })
        })

        it('can be deactivated', async () => {
          const tx = await action.setPermissiveMode(false)

          expect(await action.isPermissiveModeActive()).to.be.false
          await assertEvent(tx, 'PermissiveModeSet', { active: false })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setPermissiveMode(true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setRelayer', () => {
    let newRelayer: SignerWithAddress

    beforeEach('set new relayer', async () => {
      newRelayer = other
    })

    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setRelayerRole = action.interface.getSighash('setRelayer')
        await action.connect(owner).authorize(owner.address, setRelayerRole)
        action = action.connect(owner)
      })

      context('when the relayer was not allowed', async () => {
        it('can be allowed', async () => {
          const tx = await action.setRelayer(newRelayer.address, true)

          expect(await action.isRelayer(newRelayer.address)).to.be.true
          await assertEvent(tx, 'RelayerSet', { relayer: newRelayer, allowed: true })
        })

        it('can be disallowed', async () => {
          const tx = await action.setRelayer(newRelayer.address, false)

          expect(await action.isRelayer(newRelayer.address)).to.be.false
          await assertEvent(tx, 'RelayerSet', { relayer: newRelayer, allowed: false })
        })
      })

      context('when the relayer was allowed', async () => {
        beforeEach('allow relayer', async () => {
          await action.setRelayer(newRelayer.address, true)
        })

        it('can be allowed', async () => {
          const tx = await action.setRelayer(newRelayer.address, true)

          expect(await action.isRelayer(newRelayer.address)).to.be.true
          await assertEvent(tx, 'RelayerSet', { relayer: newRelayer, allowed: true })
        })

        it('can be disallowed', async () => {
          const tx = await action.setRelayer(newRelayer.address, false)

          expect(await action.isRelayer(newRelayer.address)).to.be.false
          await assertEvent(tx, 'RelayerSet', { relayer: newRelayer, allowed: false })
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setRelayer(ZERO_ADDRESS, true)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setLimits', () => {
    context('when the sender is authorized', async () => {
      beforeEach('set sender', async () => {
        const setLimitsRole = action.interface.getSighash('setLimits')
        await action.connect(owner).authorize(owner.address, setLimitsRole)
        action = action.connect(owner)
      })

      context('when the paying gas token is not zero', async () => {
        const payingGasToken = NATIVE_TOKEN_ADDRESS

        context('when the limits are not zero', async () => {
          const gasPriceLimit = 1e10
          const totalCostLimit = fp(2)

          it('sets the limits', async () => {
            await action.setLimits(gasPriceLimit, totalCostLimit, payingGasToken)

            expect(await action.gasPriceLimit()).to.be.equal(gasPriceLimit)
            expect(await action.totalCostLimit()).to.be.equal(totalCostLimit)
            expect(await action.payingGasToken()).to.be.equal(payingGasToken)
          })

          it('emits an event', async () => {
            const tx = await action.setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
            await assertEvent(tx, 'LimitsSet', { gasPriceLimit, totalCostLimit, payingGasToken })
          })
        })

        context('when the limits are zero', async () => {
          const gasPriceLimit = 0
          const totalCostLimit = 0
          const payingGasToken = NATIVE_TOKEN_ADDRESS

          it('sets the limits', async () => {
            await action.setLimits(gasPriceLimit, totalCostLimit, payingGasToken)

            expect(await action.gasPriceLimit()).to.be.equal(gasPriceLimit)
            expect(await action.totalCostLimit()).to.be.equal(totalCostLimit)
            expect(await action.payingGasToken()).to.be.equal(payingGasToken)
          })

          it('emits an event', async () => {
            const tx = await action.setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
            await assertEvent(tx, 'LimitsSet', { gasPriceLimit, totalCostLimit, payingGasToken })
          })
        })
      })

      context('when the paying gas token is zero', async () => {
        const payingGasToken = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(action.setLimits(0, 0, payingGasToken)).to.be.revertedWith('PAYING_GAS_TOKEN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setLimits(0, 0, ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('redeemGas', () => {
    const REDEEM_GAS_NOTE = `0x${Buffer.from('RELAYER', 'utf-8').toString('hex')}`

    beforeEach('authorize owner', async () => {
      const setLimitsRole = action.interface.getSighash('setLimits')
      await action.connect(owner).authorize(owner.address, setLimitsRole)
    })

    context('when the sender is a relayer', () => {
      beforeEach('authorize relayer', async () => {
        const setRelayerRole = action.interface.getSighash('setRelayer')
        await action.connect(owner).authorize(owner.address, setRelayerRole)
        await action.connect(owner).setRelayer(other.address, true)
        action = action.connect(other)
      })

      context('with gas price limit', () => {
        const gasPriceLimit = 10e9
        const totalCostLimit = 0
        const payingGasToken = NATIVE_TOKEN_ADDRESS

        beforeEach('setLimits', async () => {
          await action.connect(owner).setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
        })

        context('when the tx gas price is under the limit', () => {
          const gasPrice = gasPriceLimit - 1

          beforeEach('fund wallet', async () => {
            await owner.sendTransaction({ to: wallet.address, value: fp(1) })
          })

          it('redeems the expected cost to the wallet fee collector', async () => {
            const tx = await action.call({ gasPrice })

            const { args } = await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
              token: payingGasToken,
              recipient: feeCollector,
              data: REDEEM_GAS_NOTE,
            })

            const { gasUsed, effectiveGasPrice } = await tx.wait()
            const expectedCost = gasUsed.mul(effectiveGasPrice)
            assertAlmostEqual(args.withdrawn, expectedCost, 0.1)
          })
        })

        context('when the tx gas price is above the limit', () => {
          const gasPrice = gasPriceLimit + 1

          it('reverts', async () => {
            await expect(action.call({ gasPrice })).to.be.revertedWith('GAS_PRICE_ABOVE_LIMIT')
          })
        })
      })

      context('with total cost limit', () => {
        let realGasCostEth
        const gasCostError = 1e13
        const gasPriceLimit = 0

        beforeEach('measure real gas cost', async () => {
          await action.connect(owner).setLimits(gasPriceLimit, fp(100), NATIVE_TOKEN_ADDRESS)
          await owner.sendTransaction({ to: wallet.address, value: fp(1) })
          const { args } = await assertIndirectEvent(await action.call(), wallet.interface, 'Withdraw')
          realGasCostEth = args.withdrawn
        })

        context('paying in the native token', () => {
          const payingGasToken = NATIVE_TOKEN_ADDRESS

          context('when total gas cost limit is above the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.add(gasCostError)
              await action.connect(owner).setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
            })

            context('when the wallet has enough funds', () => {
              beforeEach('ensure wallet balance', async () => {
                const balance = await ethers.provider.getBalance(wallet.address)
                expect(balance).to.be.gt(realGasCostEth)
              })

              context('when the permissive mode is on', () => {
                beforeEach('activate permission mode', async () => {
                  const setPermissiveModeRole = action.interface.getSighash('setPermissiveMode')
                  await action.connect(owner).authorize(owner.address, setPermissiveModeRole)
                  await action.connect(owner).setPermissiveMode(true)
                })

                it('redeems the expected cost to the wallet fee collector', async () => {
                  const tx = await action.call()

                  const { args } = await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
                    token: payingGasToken,
                    recipient: feeCollector,
                    data: REDEEM_GAS_NOTE,
                  })

                  expect(args.withdrawn).to.be.at.least(realGasCostEth.sub(gasCostError))
                  expect(args.withdrawn).to.be.at.most(realGasCostEth.add(gasCostError))
                })
              })

              context('when the permissive mode is off', () => {
                beforeEach('deactivate permission mode', async () => {
                  const setPermissiveModeRole = action.interface.getSighash('setPermissiveMode')
                  await action.connect(owner).authorize(owner.address, setPermissiveModeRole)
                  await action.connect(owner).setPermissiveMode(false)
                })

                it('redeems the expected cost to the wallet fee collector', async () => {
                  const tx = await action.call()

                  const { args } = await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
                    token: payingGasToken,
                    recipient: feeCollector,
                    data: REDEEM_GAS_NOTE,
                  })

                  expect(args.withdrawn).to.be.at.least(realGasCostEth.sub(gasCostError))
                  expect(args.withdrawn).to.be.at.most(realGasCostEth.add(gasCostError))
                })
              })
            })

            context('when the wallet has does not have enough funds', () => {
              beforeEach('empty wallet', async () => {
                const balance = await ethers.provider.getBalance(wallet.address)
                const withdrawRole = wallet.interface.getSighash('withdraw')
                await wallet.connect(owner).authorize(owner.address, withdrawRole)
                await wallet.connect(owner).withdraw(payingGasToken, balance, owner.address, '0x')
              })

              context('when the permissive mode is on', () => {
                beforeEach('activate permission mode', async () => {
                  const setPermissiveModeRole = action.interface.getSighash('setPermissiveMode')
                  await action.connect(owner).authorize(owner.address, setPermissiveModeRole)
                  await action.connect(owner).setPermissiveMode(true)
                })

                it('does not revert nor redeems any cost', async () => {
                  const tx = await action.call()
                  await assertNoIndirectEvent(tx, wallet.interface, 'Withdraw')
                })
              })

              context('when the permissive mode is off', () => {
                beforeEach('deactivate permission mode', async () => {
                  const setPermissiveModeRole = action.interface.getSighash('setPermissiveMode')
                  await action.connect(owner).authorize(owner.address, setPermissiveModeRole)
                  await action.connect(owner).setPermissiveMode(false)
                })

                it('reverts', async () => {
                  await expect(action.call()).to.be.revertedWith('Address: insufficient balance')
                })
              })
            })
          })

          context('when total gas cost limit is below the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.sub(gasCostError)
              await action.connect(owner).setLimits(gasPriceLimit, totalCostLimit, payingGasToken)
            })

            it('reverts', async () => {
              await expect(action.call()).to.be.revertedWith('TX_COST_ABOVE_LIMIT')
            })
          })
        })

        context('paying in the wrapped native token', () => {
          let payingGasToken: Contract

          beforeEach('set paying token', async () => {
            payingGasToken = mimic.wrappedNativeToken
          })

          context('when total gas cost limit is above the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.add(gasCostError)
              await action.connect(owner).setLimits(gasPriceLimit, totalCostLimit, payingGasToken.address)
            })

            beforeEach('fund wallet', async () => {
              await mimic.wrappedNativeToken.connect(owner).deposit({ value: fp(1) })
              await mimic.wrappedNativeToken.connect(owner).transfer(wallet.address, fp(1))
            })

            it('redeems the expected cost to the wallet fee collector', async () => {
              const tx = await action.call()

              const { args } = await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
                token: payingGasToken,
                recipient: feeCollector,
                data: REDEEM_GAS_NOTE,
              })

              expect(args.withdrawn).to.be.at.least(realGasCostEth.sub(gasCostError))
              expect(args.withdrawn).to.be.at.most(realGasCostEth.add(gasCostError))
            })
          })

          context('when total gas cost limit is below the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.sub(gasCostError)
              await action.connect(owner).setLimits(gasPriceLimit, totalCostLimit, payingGasToken.address)
            })

            it('reverts', async () => {
              await expect(action.call()).to.be.revertedWith('TX_COST_ABOVE_LIMIT')
            })
          })
        })

        context('paying in another ERC20', () => {
          const rate = fp(2)
          let payingGasToken: Contract

          beforeEach('set paying token and mock price feed', async () => {
            payingGasToken = await createTokenMock()
            const feed = await createPriceFeedMock(rate)
            const setPriceFeedRole = wallet.interface.getSighash('setPriceFeed')
            await wallet.connect(owner).authorize(owner.address, setPriceFeedRole)
            await wallet
              .connect(owner)
              .setPriceFeed(mimic.wrappedNativeToken.address, payingGasToken.address, feed.address)
          })

          context('when total gas cost limit is above the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.add(gasCostError).mul(rate).div(fp(1))
              await action.connect(owner).setLimits(gasPriceLimit, totalCostLimit, payingGasToken.address)
            })

            beforeEach('fund wallet', async () => {
              await payingGasToken.mint(wallet.address, fp(2))
            })

            it('redeems the expected cost to the wallet fee collector', async () => {
              const tx = await action.call()

              const { args } = await assertIndirectEvent(tx, wallet.interface, 'Withdraw', {
                token: payingGasToken,
                recipient: feeCollector,
                data: REDEEM_GAS_NOTE,
              })

              expect(args.withdrawn).to.be.at.least(realGasCostEth.sub(gasCostError).mul(rate).div(fp(1)))
              expect(args.withdrawn).to.be.at.most(realGasCostEth.add(gasCostError).mul(rate).div(fp(1)))
            })
          })

          context('when total gas cost limit is below the actual cost', () => {
            beforeEach('setLimits', async () => {
              const totalCostLimit = realGasCostEth.sub(gasCostError).mul(rate).div(fp(1))
              await action.connect(owner).setLimits(gasPriceLimit, totalCostLimit, payingGasToken.address)
            })

            it('reverts', async () => {
              await expect(action.call()).to.be.revertedWith('TX_COST_ABOVE_LIMIT')
            })
          })
        })
      })
    })

    context('when the sender is not a relayer', () => {
      it('reverts', async () => {
        await expect(action.call()).to.be.revertedWith('SENDER_NOT_RELAYER')
      })
    })
  })
})
