import { expect } from 'chai'
import { Contract } from 'ethers'

export type NAry<N> = N | N[]

export type PermissionAssertion = {
  name: string
  roles: string[]
  account: NAry<{ address: string } | string>
}

export async function assertPermissions(target: Contract, assertions: PermissionAssertion[]): Promise<void> {
  for (const assertion of assertions) {
    const accounts = Array.isArray(assertion.account) ? assertion.account : [assertion.account]
    for (const account of accounts) {
      const address = typeof account === 'string' ? account : account.address
      for (const fn in target.interface.functions) {
        const fnName = target.interface.functions[fn].name
        const role = target.interface.getSighash(fnName)
        const should = assertion.roles.includes(fnName)
        const message = `expected "${assertion.name}" ${address} ${should ? 'to' : 'not to'} have "${fn}" rights`
        expect(await target.isAuthorized(address, role)).to.be.equal(should, message)
      }
    }
  }
}
