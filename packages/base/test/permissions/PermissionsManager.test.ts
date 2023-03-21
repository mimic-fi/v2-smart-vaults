import { deploy, getSigner } from '@mimic-fi/v2-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractTransaction } from 'ethers'

describe('PermissionsManager', () => {
  let manager: Contract, admin: SignerWithAddress

  beforeEach('deploy manager', async () => {
    admin = await getSigner(1)
    manager = await deploy('PermissionsManager', [admin.address])
  })

  describe('initialize', () => {
    it('allows the admin to execute the permissions manager', async () => {
      const executeRole = manager.interface.getSighash('execute')
      expect(await manager.isAuthorized(admin.address, executeRole)).to.be.true

      const authorizeRole = manager.interface.getSighash('authorize')
      expect(await manager.isAuthorized(admin.address, authorizeRole)).to.be.false

      const unauthorizeRole = manager.interface.getSighash('unauthorize')
      expect(await manager.isAuthorized(admin.address, unauthorizeRole)).to.be.false
    })

    it('allows the permissions manager to admin itself', async () => {
      const executeRole = manager.interface.getSighash('execute')
      expect(await manager.isAuthorized(manager.address, executeRole)).to.be.false

      const authorizeRole = manager.interface.getSighash('authorize')
      expect(await manager.isAuthorized(manager.address, authorizeRole)).to.be.true

      const unauthorizeRole = manager.interface.getSighash('unauthorize')
      expect(await manager.isAuthorized(manager.address, unauthorizeRole)).to.be.true
    })
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

      beforeEach('init changes', () => {
        changesTargetA = []
        changesTargetB = []
      })

      beforeEach('set up samples', async () => {
        await targetA.authorize(accountA, roleA)
        await targetB.authorize(accountB, roleB)
      })

      const execute = (): Promise<ContractTransaction> => {
        return manager.connect(admin).execute([
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
        await expect(manager.execute([])).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
