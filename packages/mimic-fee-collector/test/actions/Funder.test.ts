import {
  assertAlmostEqual,
  assertEvent,
  assertIndirectEvent,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v2-helpers'
import {
  createAction,
  createPriceFeedMock,
  createSmartVault,
  createTokenMock,
  Mimic,
  setupMimic,
} from '@mimic-fi/v2-smart-vaults-base'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { ethers } from 'hardhat'

describe('Funder', () => {
  let action: Contract, smartVault: Contract, mimic: Mimic
  let owner: SignerWithAddress, other: SignerWithAddress, recipient: SignerWithAddress

  before('set up signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, other, recipient] = await getSigners()
  })

  beforeEach('deploy action', async () => {
    mimic = await setupMimic(true)
    smartVault = await createSmartVault(mimic, owner)
    action = await createAction('Funder', mimic, owner, smartVault)
  })

  describe('setTokenIn', () => {
    let tokenIn: Contract

    beforeEach('deploy token in', async () => {
      tokenIn = await createTokenMock()
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setTokenInRole = action.interface.getSighash('setTokenIn')
        await action.connect(owner).authorize(owner.address, setTokenInRole)
        action = action.connect(owner)
      })

      context('when the given address is not zero', () => {
        const itCanSetTheTokenProperly = () => {
          it('sets the token in', async () => {
            await action.setTokenIn(tokenIn.address)

            expect(await action.tokenIn()).to.be.equal(tokenIn.address)
          })

          it('emits an event', async () => {
            const tx = await action.setTokenIn(tokenIn.address)

            await assertEvent(tx, 'TokenInSet', { tokenIn })
          })
        }

        context('when the token in was set', () => {
          beforeEach('set the token', async () => {
            await action.setTokenIn(tokenIn.address)
          })

          itCanSetTheTokenProperly()
        })

        context('when the token out was not set', () => {
          itCanSetTheTokenProperly()
        })
      })

      context('when the given address is zero', () => {
        it('reverts', async () => {
          await expect(action.setTokenIn(ZERO_ADDRESS)).to.be.revertedWith('FUNDER_TOKEN_IN_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setTokenIn(tokenIn.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setBalanceLimits', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setBalanceLimitsRole = action.interface.getSighash('setBalanceLimits')
        await action.connect(owner).authorize(owner.address, setBalanceLimitsRole)
        action = action.connect(owner)
      })

      const itSetsBalanceLimitsCorrectly = (min: number, max: number) => {
        it('sets the balance limits', async () => {
          await action.setBalanceLimits(min, max)

          expect(await action.minBalance()).to.be.equal(min)
          expect(await action.maxBalance()).to.be.equal(max)
        })

        it('emits an event', async () => {
          const tx = await action.setBalanceLimits(min, max)

          await assertEvent(tx, 'BalanceLimitsSet', { min, max })
        })
      }

      context('when the min balance is not zero', () => {
        const min = 2

        context('when the max balance is not zero', () => {
          context('when the max balance is greater than the min balance', () => {
            const max = 5

            itSetsBalanceLimitsCorrectly(min, max)
          })

          context('when the max balance is lower than the min balance', () => {
            const max = 1

            it('reverts', async () => {
              await expect(action.setBalanceLimits(min, max)).to.be.revertedWith('FUNDER_MIN_GT_MAX')
            })
          })
        })

        context('when the max balance is zero', () => {
          const max = 0

          it('reverts', async () => {
            await expect(action.setBalanceLimits(min, max)).to.be.revertedWith('FUNDER_MIN_GT_MAX')
          })
        })
      })

      context('when the min balance is zero', () => {
        const min = 0

        context('when the max balance is not zero', () => {
          const max = 5

          itSetsBalanceLimitsCorrectly(min, max)
        })

        context('when the max balance is zero', () => {
          const max = 0

          itSetsBalanceLimitsCorrectly(min, max)
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setBalanceLimits(0, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
        await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
        action = action.connect(owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async () => {
          await action.setMaxSlippage(slippage)

          expect(await action.maxSlippage()).to.be.equal(slippage)
        })

        it('emits an event', async () => {
          const tx = await action.setMaxSlippage(slippage)

          await assertEvent(tx, 'MaxSlippageSet', { maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async () => {
          await expect(action.setMaxSlippage(slippage)).to.be.revertedWith('SLIPPAGE_ABOVE_ONE')
        })
      })
    })

    context('when the sender is not authorized', () => {
      beforeEach('set sender', () => {
        action = action.connect(other)
      })

      it('reverts', async () => {
        await expect(action.setMaxSlippage(1)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    beforeEach('authorize action', async () => {
      const withdrawRole = smartVault.interface.getSighash('withdraw')
      await smartVault.connect(owner).authorize(action.address, withdrawRole)
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = action.interface.getSighash('call')
        await action.connect(owner).authorize(owner.address, callRole)
        action = action.connect(owner)
      })

      context('when the recipient is set', () => {
        beforeEach('set recipient', async () => {
          const setRecipientRole = action.interface.getSighash('setRecipient')
          await action.connect(owner).authorize(owner.address, setRecipientRole)
          await action.connect(owner).setRecipient(recipient.address)
        })

        context('when the balance limit amounts were set', () => {
          const minBalance = fp(10)
          const maxBalance = fp(20)

          beforeEach('set balance limits', async () => {
            const setBalanceLimitsRole = action.interface.getSighash('setBalanceLimits')
            await action.connect(owner).authorize(owner.address, setBalanceLimitsRole)
            await action.connect(owner).setBalanceLimits(minBalance, maxBalance)
          })

          const fundRecipient = async (balance: BigNumber) => {
            const current = await ethers.provider.getBalance(recipient.address)
            if (current.lt(balance)) await other.sendTransaction({ to: recipient.address, value: balance.sub(current) })
            else await recipient.sendTransaction({ to: other.address, value: current.sub(balance) })
          }

          context('when the current balance is below the min', () => {
            const balance = minBalance.sub(1)

            beforeEach('fund recipient', async () => {
              await fundRecipient(balance)
            })

            context('when the token in is not zero', () => {
              context('when the token in is the native token', () => {
                const tokenIn = NATIVE_TOKEN_ADDRESS

                beforeEach('fund smart vault', async () => {
                  await other.sendTransaction({ to: smartVault.address, value: maxBalance })
                })

                beforeEach('set token in', async () => {
                  const setTokenInRole = action.interface.getSighash('setTokenIn')
                  await action.connect(owner).authorize(owner.address, setTokenInRole)
                  await action.connect(owner).setTokenIn(tokenIn)
                })

                it('can execute', async () => {
                  expect(await action.canExecute(0)).to.be.true
                })

                it('computes the fundeable amount correctly', async () => {
                  const currentBalance = await ethers.provider.getBalance(recipient.address)
                  const expectedAmount = maxBalance.sub(currentBalance)
                  expect(await action.fundeableAmount()).to.be.equal(expectedAmount)
                })

                it('transfers tokens to the recipient', async () => {
                  const previousRecipientBalance = await ethers.provider.getBalance(recipient.address)
                  const previousSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)

                  await action.call(0, 0, '0x')

                  const currentRecipientBalance = await ethers.provider.getBalance(recipient.address)
                  expect(currentRecipientBalance).to.be.eq(maxBalance)

                  const expectedAmount = maxBalance.sub(previousRecipientBalance)
                  const currentSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
                  expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.sub(expectedAmount))
                })

                it('calls withdraw primitive', async () => {
                  const previousRecipientBalance = await ethers.provider.getBalance(recipient.address)
                  const expectedAmount = maxBalance.sub(previousRecipientBalance)

                  const tx = await action.call(0, 0, '0x')

                  await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
                    token: NATIVE_TOKEN_ADDRESS,
                    recipient,
                    withdrawn: expectedAmount,
                    fee: 0,
                    data: '0x',
                  })
                })

                it('emits an Executed event', async () => {
                  const tx = await action.call(0, 0, '0x')

                  await assertEvent(tx, 'Executed')
                })
              })

              context('when the token in is the wrapped native token', () => {
                let tokenIn: Contract

                beforeEach('fund smart vault', async () => {
                  tokenIn = mimic.wrappedNativeToken
                  await tokenIn.connect(other).deposit({ value: maxBalance })
                  await tokenIn.connect(other).transfer(smartVault.address, maxBalance)
                })

                beforeEach('set token in', async () => {
                  const setTokenInRole = action.interface.getSighash('setTokenIn')
                  await action.connect(owner).authorize(owner.address, setTokenInRole)
                  await action.connect(owner).setTokenIn(tokenIn.address)
                })

                beforeEach('authorize action', async () => {
                  const unwrapRole = smartVault.interface.getSighash('unwrap')
                  await smartVault.connect(owner).authorize(action.address, unwrapRole)
                })

                it('can execute', async () => {
                  expect(await action.canExecute(0)).to.be.true
                })

                it('computes the fundeable amount correctly', async () => {
                  const currentBalance = await ethers.provider.getBalance(recipient.address)
                  const expectedAmount = maxBalance.sub(currentBalance)
                  expect(await action.fundeableAmount()).to.be.equal(expectedAmount)
                })

                it('transfers tokens to the recipient', async () => {
                  const previousRecipientBalance = await ethers.provider.getBalance(recipient.address)
                  const previousSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)

                  await action.call(0, 0, '0x')

                  const currentRecipientBalance = await ethers.provider.getBalance(recipient.address)
                  expect(currentRecipientBalance).to.be.eq(maxBalance)

                  const expectedAmount = maxBalance.sub(previousRecipientBalance)
                  const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                  expect(currentSmartVaultBalance).to.be.eq(previousSmartVaultBalance.sub(expectedAmount))
                })

                it('calls unwrap and withdraw primitive', async () => {
                  const previousRecipientBalance = await ethers.provider.getBalance(recipient.address)
                  const expectedAmount = maxBalance.sub(previousRecipientBalance)

                  const tx = await action.call(0, 0, '0x')

                  await assertIndirectEvent(tx, smartVault.interface, 'Unwrap', {
                    amount: expectedAmount,
                    unwrapped: expectedAmount,
                    data: '0x',
                  })

                  await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
                    token: NATIVE_TOKEN_ADDRESS,
                    recipient,
                    withdrawn: expectedAmount,
                    fee: 0,
                    data: '0x',
                  })
                })

                it('emits an Executed event', async () => {
                  const tx = await action.call(0, 0, '0x')

                  await assertEvent(tx, 'Executed')
                })
              })

              context('when the token in is another token', () => {
                let tokenIn: Contract
                const rate = fp(1.5)

                beforeEach('fund smart vault', async () => {
                  tokenIn = await createTokenMock()
                  await tokenIn.mint(smartVault.address, maxBalance)
                })

                beforeEach('set token in', async () => {
                  const setTokenInRole = action.interface.getSighash('setTokenIn')
                  await action.connect(owner).authorize(owner.address, setTokenInRole)
                  await action.connect(owner).setTokenIn(tokenIn.address)
                })

                beforeEach('fund swap connector', async () => {
                  await mimic.swapConnector.mockRate(rate)
                  await mimic.wrappedNativeToken.connect(other).deposit({ value: maxBalance })
                  await mimic.wrappedNativeToken.connect(other).transfer(await mimic.swapConnector.dex(), maxBalance)
                })

                beforeEach('set price feed', async () => {
                  const feed = await createPriceFeedMock(rate)
                  const setPriceFeedRole = smartVault.interface.getSighash('setPriceFeed')
                  await smartVault.connect(owner).authorize(owner.address, setPriceFeedRole)
                  await smartVault
                    .connect(owner)
                    .setPriceFeed(tokenIn.address, mimic.wrappedNativeToken.address, feed.address)
                })

                beforeEach('authorize action', async () => {
                  const swapRole = smartVault.interface.getSighash('swap')
                  await smartVault.connect(owner).authorize(action.address, swapRole)
                  const unwrapRole = smartVault.interface.getSighash('unwrap')
                  await smartVault.connect(owner).authorize(action.address, unwrapRole)
                })

                context('when the slippage is below the limit', () => {
                  const slippage = fp(0.001)

                  beforeEach('set max slippage', async () => {
                    const setMaxSlippageRole = action.interface.getSighash('setMaxSlippage')
                    await action.connect(owner).authorize(owner.address, setMaxSlippageRole)
                    await action.connect(owner).setMaxSlippage(slippage)
                  })

                  it('can execute', async () => {
                    expect(await action.canExecute(slippage)).to.be.true
                  })

                  it('computes the fundeable amount correctly', async () => {
                    const currentBalance = await ethers.provider.getBalance(recipient.address)
                    const expectedAmount = maxBalance.sub(currentBalance).mul(fp(1)).div(rate)
                    assertAlmostEqual(await action.fundeableAmount(), expectedAmount, 1e-15)
                  })

                  it('transfers tokens to the recipient', async () => {
                    const previousRecipientBalance = await ethers.provider.getBalance(recipient.address)
                    const previousSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)

                    await action.call(0, slippage, '0x')

                    const currentRecipientBalance = await ethers.provider.getBalance(recipient.address)
                    expect(currentRecipientBalance).to.be.at.least(maxBalance.sub(10))
                    expect(currentRecipientBalance).to.be.at.most(maxBalance.add(10))

                    const currentSmartVaultBalance = await tokenIn.balanceOf(smartVault.address)
                    const expectedAmountIn = maxBalance.sub(previousRecipientBalance).mul(fp(1)).div(rate)
                    const expectedBalance = previousSmartVaultBalance.sub(expectedAmountIn)
                    expect(currentSmartVaultBalance).to.be.at.least(expectedBalance.sub(10))
                    expect(currentSmartVaultBalance).to.be.at.most(expectedBalance.add(10))
                  })

                  it('calls swap, unwrap, and withdraw primitive', async () => {
                    const tx = await action.call(5, slippage, '0xabcd')

                    await assertIndirectEvent(tx, smartVault.interface, 'Swap', {
                      source: 5,
                      tokenIn,
                      tokenOut: mimic.wrappedNativeToken.address,
                      data: '0xabcd',
                    })

                    await assertIndirectEvent(tx, smartVault.interface, 'Unwrap', { data: '0x' })

                    await assertIndirectEvent(tx, smartVault.interface, 'Withdraw', {
                      token: NATIVE_TOKEN_ADDRESS,
                      recipient,
                      fee: 0,
                      data: '0x',
                    })
                  })

                  it('emits an Executed event', async () => {
                    const tx = await action.call(0, slippage, '0x')

                    await assertEvent(tx, 'Executed')
                  })
                })

                context('when the slippage is above the limit', () => {
                  const slippage = fp(1)

                  it('reverts', async () => {
                    await expect(action.call(0, slippage, '0x')).to.be.revertedWith('FUNDER_SLIPPAGE_ABOVE_MAX')
                  })
                })
              })
            })

            context('when the token in is not set', () => {
              it('reverts', async () => {
                await expect(action.call(0, 0, '0x')).to.be.revertedWith('FUNDER_TOKEN_IN_NOT_SET')
              })
            })
          })

          context('when the current balance is between the min and the max', () => {
            const balance = maxBalance.sub(1)

            beforeEach('fund recipient', async () => {
              await fundRecipient(balance)
            })

            it('reverts', async () => {
              await expect(action.call(0, 0, '0x')).to.be.revertedWith('FUNDER_BALANCE_ABOVE_MIN')
            })

            it('computes the fundeable amount correctly', async () => {
              expect(await action.fundeableAmount()).to.be.equal(0)
            })
          })

          context('when the current balance is above the max', () => {
            const balance = maxBalance.add(1)

            beforeEach('fund recipient', async () => {
              await fundRecipient(balance)
            })

            it('reverts', async () => {
              await expect(action.call(0, 0, '0x')).to.be.revertedWith('FUNDER_BALANCE_ABOVE_MIN')
            })

            it('computes the fundeable amount correctly', async () => {
              expect(await action.fundeableAmount()).to.be.equal(0)
            })
          })
        })

        context('when the balance limit was not set', () => {
          it('reverts', async () => {
            await expect(action.call(0, 0, '0x')).to.be.revertedWith('FUNDER_BALANCE_LIMIT_NOT_SET')
          })
        })
      })

      context('when the recipient is not set', () => {
        it('reverts', async () => {
          await expect(action.call(0, 0, '0x')).to.be.revertedWith('FUNDER_RECIPIENT_NOT_SET')
        })
      })
    })

    context('when the sender is authorized', () => {
      it('reverts', async () => {
        await expect(action.call(0, 0, '0x')).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
