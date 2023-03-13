import { deploy, getSigner, ZERO_ADDRESS } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractTransaction } from 'ethers'

describe('PermissionsManager', () => {
  let manager: Contract, admin: SignerWithAddress

  beforeEach('deploy manager', async () => {
    admin = await getSigner(1)
    manager = await deploy('PermissionsManager', [admin.address])
  })

  describe('execute', () => {
    let targetA: Contract, targetB: Contract

    const accountA = '0x000000000000000000000000000000000000000A'
    const accountB = '0x000000000000000000000000000000000000000B'

    beforeEach('deploy samples', async () => {
      targetA = await deploy('AuthorizerMock')
      targetB = await deploy('AuthorizerMock')
    })

    context('when the sender is authorized', () => {
      let changesTargetA, changesTargetB

      const roleA = '0xaaaaaaaa'
      const roleB = '0xbbbbbbbb'

      beforeEach('authorize sender', async () => {
        const executeRole = manager.interface.getSighash('executeMany')
        await manager.connect(admin).authorize(admin.address, executeRole)
        manager = manager.connect(admin)
      })

      beforeEach('init changes', () => {
        changesTargetA = []
        changesTargetB = []
      })

      beforeEach('set up samples', async () => {
        await targetA.authorize(accountA, roleA)
        await targetB.authorize(accountB, roleB)
      })

      const execute = (): Promise<ContractTransaction> => {
        return manager.executeMany([
          { target: targetA.address, changes: changesTargetA },
          { target: targetB.address, changes: changesTargetB },
        ])
      }

      const itPerformsTheExpectedChanges = (checkPermissions) => {
        it('performs the expected changes', async () => {
          await execute()
          await checkPermissions()
        })
      }

      const itReverts = () => {
        it('reverts', async () => {
          await expect(execute()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
        })
      }

      context('when the manager has permissions to authorize', () => {
        beforeEach('authorize manager', async () => {
          const authorizeRole = manager.interface.getSighash('authorize')
          await targetA.authorize(manager.address, authorizeRole)
          await targetB.authorize(manager.address, authorizeRole)
        })

        context('when the manager has permissions to unauthorize', () => {
          beforeEach('authorize manager', async () => {
            const unauthorizeRole = manager.interface.getSighash('unauthorize')
            await targetA.authorize(manager.address, unauthorizeRole)
            await targetB.authorize(manager.address, unauthorizeRole)
          })

          context('when granting permissions', () => {
            beforeEach('set grants', async () => {
              changesTargetA.push(
                { grant: true, permission: { who: accountA, what: roleA } },
                { grant: true, permission: { who: accountB, what: roleA } }
              )

              changesTargetB.push(
                { grant: true, permission: { who: accountA, what: roleB } },
                { grant: true, permission: { who: accountB, what: roleB } }
              )
            })

            context('when revoking permissions', () => {
              beforeEach('set revokes', () => {
                changesTargetA.push({ grant: false, permission: { who: accountB, what: roleB } })
                changesTargetB.push({ grant: false, permission: { who: accountB, what: roleB } })
              })

              itPerformsTheExpectedChanges(async () => {
                expect(await targetA.isAuthorized(accountA, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetA.isAuthorized(accountB, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountB, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountA, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountA, roleB)).to.be.true

                expect(await targetB.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountB, roleB)).to.be.false
              })
            })

            context('when not revoking permissions', () => {
              itPerformsTheExpectedChanges(async () => {
                expect(await targetA.isAuthorized(accountA, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetA.isAuthorized(accountB, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountB, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountA, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountA, roleB)).to.be.true

                expect(await targetB.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountB, roleB)).to.be.true
              })
            })
          })

          context('when not granting permissions', () => {
            context('when revoking permissions', () => {
              beforeEach('set revokes', () => {
                changesTargetA.push({ grant: false, permission: { who: accountB, what: roleB } })
                changesTargetB.push({ grant: false, permission: { who: accountB, what: roleB } })
              })

              itPerformsTheExpectedChanges(async () => {
                expect(await targetA.isAuthorized(accountA, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetA.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetA.isAuthorized(accountB, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountA, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountB, roleB)).to.be.false
              })
            })

            context('when not revoking permissions', () => {
              itPerformsTheExpectedChanges(async () => {
                expect(await targetA.isAuthorized(accountA, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetA.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetA.isAuthorized(accountB, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountA, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountB, roleB)).to.be.true
              })
            })
          })
        })

        context('when the manager does not have permissions to unauthorize', () => {
          context('when granting permissions', () => {
            beforeEach('set grants', async () => {
              changesTargetA.push(
                { grant: true, permission: { who: accountA, what: roleA } },
                { grant: true, permission: { who: accountB, what: roleA } }
              )

              changesTargetB.push(
                { grant: true, permission: { who: accountA, what: roleB } },
                { grant: true, permission: { who: accountB, what: roleB } }
              )
            })

            context('when revoking permissions', () => {
              beforeEach('set revokes', () => {
                changesTargetA.push({ grant: false, permission: { who: accountB, what: roleB } })
                changesTargetB.push({ grant: false, permission: { who: accountB, what: roleB } })
              })

              itReverts()
            })

            context('when not revoking permissions', () => {
              itPerformsTheExpectedChanges(async () => {
                expect(await targetA.isAuthorized(accountA, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetA.isAuthorized(accountB, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountB, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountA, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountA, roleB)).to.be.true

                expect(await targetB.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountB, roleB)).to.be.true
              })
            })
          })

          context('when not granting permissions', () => {
            context('when revoking permissions', () => {
              beforeEach('set revokes', () => {
                changesTargetA.push({ grant: false, permission: { who: accountB, what: roleB } })
                changesTargetB.push({ grant: false, permission: { who: accountB, what: roleB } })
              })

              itReverts()
            })

            context('when not revoking permissions', () => {
              itPerformsTheExpectedChanges(async () => {
                expect(await targetA.isAuthorized(accountA, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetA.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetA.isAuthorized(accountB, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountA, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountB, roleB)).to.be.true
              })
            })
          })
        })
      })

      context('when the manager does not have permissions to authorize', () => {
        context('when the manager has permissions to unauthorize', () => {
          beforeEach('authorize manager', async () => {
            const unauthorizeRole = manager.interface.getSighash('unauthorize')
            await targetA.authorize(manager.address, unauthorizeRole)
            await targetB.authorize(manager.address, unauthorizeRole)
          })

          context('when granting permissions', () => {
            beforeEach('set grants', async () => {
              changesTargetA.push(
                { grant: true, permission: { who: accountA, what: roleA } },
                { grant: true, permission: { who: accountB, what: roleA } }
              )

              changesTargetB.push(
                { grant: true, permission: { who: accountA, what: roleB } },
                { grant: true, permission: { who: accountB, what: roleB } }
              )
            })

            context('when revoking permissions', () => {
              beforeEach('set revokes', () => {
                changesTargetA.push({ grant: false, permission: { who: accountB, what: roleB } })
                changesTargetB.push({ grant: false, permission: { who: accountB, what: roleB } })
              })

              itReverts()
            })

            context('when not revoking permissions', () => {
              itReverts()
            })
          })

          context('when not granting permissions', () => {
            context('when revoking permissions', () => {
              beforeEach('set revokes', () => {
                changesTargetA.push({ grant: false, permission: { who: accountB, what: roleB } })
                changesTargetB.push({ grant: false, permission: { who: accountB, what: roleB } })
              })

              itPerformsTheExpectedChanges(async () => {
                expect(await targetA.isAuthorized(accountA, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetA.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetA.isAuthorized(accountB, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountA, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountB, roleB)).to.be.false
              })
            })

            context('when not revoking permissions', () => {
              itPerformsTheExpectedChanges(async () => {
                expect(await targetA.isAuthorized(accountA, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetA.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetA.isAuthorized(accountB, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountA, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountB, roleB)).to.be.true
              })
            })
          })
        })

        context('when the manager does not have permissions to unauthorize', () => {
          context('when granting permissions', () => {
            beforeEach('set grants', async () => {
              changesTargetA.push(
                { grant: true, permission: { who: accountA, what: roleA } },
                { grant: true, permission: { who: accountB, what: roleA } }
              )

              changesTargetB.push(
                { grant: true, permission: { who: accountA, what: roleB } },
                { grant: true, permission: { who: accountB, what: roleB } }
              )
            })

            context('when revoking permissions', () => {
              beforeEach('set revokes', () => {
                changesTargetA.push({ grant: false, permission: { who: accountB, what: roleB } })
                changesTargetB.push({ grant: false, permission: { who: accountB, what: roleB } })
              })

              itReverts()
            })

            context('when not revoking permissions', () => {
              itReverts()
            })
          })

          context('when not granting permissions', () => {
            context('when revoking permissions', () => {
              beforeEach('set revokes', () => {
                changesTargetA.push({ grant: false, permission: { who: accountB, what: roleB } })
                changesTargetB.push({ grant: false, permission: { who: accountB, what: roleB } })
              })

              itReverts()
            })

            context('when not revoking permissions', () => {
              itPerformsTheExpectedChanges(async () => {
                expect(await targetA.isAuthorized(accountA, roleA)).to.be.true
                expect(await targetA.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetA.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetA.isAuthorized(accountB, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountA, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountA, roleB)).to.be.false

                expect(await targetB.isAuthorized(accountB, roleA)).to.be.false
                expect(await targetB.isAuthorized(accountB, roleB)).to.be.true
              })
            })
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(manager.executeMany([])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
        await expect(manager.execute({ target: ZERO_ADDRESS, changes: [] })).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('transferAdminPermissions', () => {
    let sample: Contract

    beforeEach('deploy sample', async () => {
      sample = await deploy('AuthorizerMock')
    })

    beforeEach('authorize manager', async () => {
      const authorizeRole = manager.interface.getSighash('authorize')
      await sample.authorize(manager.address, authorizeRole)
      const unauthorizeRole = manager.interface.getSighash('unauthorize')
      await sample.authorize(manager.address, unauthorizeRole)
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const executeRole = manager.interface.getSighash('transferAdminPermissions')
        await manager.connect(admin).authorize(admin.address, executeRole)
        manager = manager.connect(admin)
      })

      context('when transferring to the manager itself', () => {
        it('reverts', async () => {
          await expect(manager.transferAdminPermissions(sample.address, manager.address)).to.be.revertedWith(
            'REDUNDANT_TRANSFER_ADDRESS'
          )
        })
      })

      context('when transferring to another account', () => {
        context('when transferring to zero address', () => {
          it('reverts', async () => {
            await expect(manager.transferAdminPermissions(sample.address, ZERO_ADDRESS)).to.be.revertedWith(
              'TRANSFER_ADDRESS_ZERO'
            )
          })
        })

        context('when transferring to another account', () => {
          it('transfers the admin rights', async () => {
            const authorizeRole = manager.interface.getSighash('authorize')
            const unauthorizeRole = manager.interface.getSighash('unauthorize')

            expect(await sample.isAuthorized(admin.address, authorizeRole)).to.be.false
            expect(await sample.isAuthorized(admin.address, unauthorizeRole)).to.be.false

            expect(await sample.isAuthorized(manager.address, authorizeRole)).to.be.true
            expect(await sample.isAuthorized(manager.address, unauthorizeRole)).to.be.true

            await manager.transferAdminPermissions(sample.address, admin.address)

            expect(await sample.isAuthorized(admin.address, authorizeRole)).to.be.true
            expect(await sample.isAuthorized(admin.address, unauthorizeRole)).to.be.true

            expect(await sample.isAuthorized(manager.address, authorizeRole)).to.be.false
            expect(await sample.isAuthorized(manager.address, unauthorizeRole)).to.be.false
          })
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(manager.transferAdminPermissions(sample.address, admin.address)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('grantAdminPermissions', () => {
    let sample: Contract

    beforeEach('deploy sample', async () => {
      sample = await deploy('AuthorizerMock')
    })

    beforeEach('authorize manager', async () => {
      const authorizeRole = manager.interface.getSighash('authorize')
      await sample.authorize(manager.address, authorizeRole)
      const unauthorizeRole = manager.interface.getSighash('unauthorize')
      await sample.authorize(manager.address, unauthorizeRole)
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const executeRole = manager.interface.getSighash('grantAdminPermissions')
        await manager.connect(admin).authorize(admin.address, executeRole)
        manager = manager.connect(admin)
      })

      context('when granting to zero address', () => {
        it('reverts', async () => {
          await expect(manager.grantAdminPermissions(sample.address, ZERO_ADDRESS)).to.be.revertedWith(
            'GRANT_ADDRESS_ZERO'
          )
        })
      })

      context('when granting to another account', () => {
        it('grants the admin rights', async () => {
          const authorizeRole = manager.interface.getSighash('authorize')
          const unauthorizeRole = manager.interface.getSighash('unauthorize')

          expect(await sample.isAuthorized(admin.address, authorizeRole)).to.be.false
          expect(await sample.isAuthorized(admin.address, unauthorizeRole)).to.be.false

          expect(await sample.isAuthorized(manager.address, authorizeRole)).to.be.true
          expect(await sample.isAuthorized(manager.address, unauthorizeRole)).to.be.true

          await manager.grantAdminPermissions(sample.address, admin.address)

          expect(await sample.isAuthorized(admin.address, authorizeRole)).to.be.true
          expect(await sample.isAuthorized(admin.address, unauthorizeRole)).to.be.true

          expect(await sample.isAuthorized(manager.address, authorizeRole)).to.be.true
          expect(await sample.isAuthorized(manager.address, unauthorizeRole)).to.be.true
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(manager.grantAdminPermissions(sample.address, admin.address)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('revokeAdminPermissions', () => {
    let sample: Contract

    beforeEach('deploy sample', async () => {
      sample = await deploy('AuthorizerMock')
    })

    beforeEach('authorize manager and admin', async () => {
      const authorizeRole = manager.interface.getSighash('authorize')
      await sample.authorize(admin.address, authorizeRole)
      await sample.authorize(manager.address, authorizeRole)

      const unauthorizeRole = manager.interface.getSighash('unauthorize')
      await sample.authorize(admin.address, unauthorizeRole)
      await sample.authorize(manager.address, unauthorizeRole)
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const executeRole = manager.interface.getSighash('revokeAdminPermissions')
        await manager.connect(admin).authorize(admin.address, executeRole)
        manager = manager.connect(admin)
      })

      context('when revoking to zero address', () => {
        it('reverts', async () => {
          await expect(manager.revokeAdminPermissions(sample.address, ZERO_ADDRESS)).to.be.revertedWith(
            'REVOKE_ADDRESS_ZERO'
          )
        })
      })

      context('when revoking to another account', () => {
        it('revokes the admin rights', async () => {
          const authorizeRole = manager.interface.getSighash('authorize')
          const unauthorizeRole = manager.interface.getSighash('unauthorize')

          expect(await sample.isAuthorized(admin.address, authorizeRole)).to.be.true
          expect(await sample.isAuthorized(admin.address, unauthorizeRole)).to.be.true

          expect(await sample.isAuthorized(manager.address, authorizeRole)).to.be.true
          expect(await sample.isAuthorized(manager.address, unauthorizeRole)).to.be.true

          await manager.revokeAdminPermissions(sample.address, admin.address)

          expect(await sample.isAuthorized(admin.address, authorizeRole)).to.be.false
          expect(await sample.isAuthorized(admin.address, unauthorizeRole)).to.be.false

          expect(await sample.isAuthorized(manager.address, authorizeRole)).to.be.true
          expect(await sample.isAuthorized(manager.address, unauthorizeRole)).to.be.true
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(manager.revokeAdminPermissions(sample.address, admin.address)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })
})
