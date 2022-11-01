import { decimal, instanceAt, pct } from '@mimic-fi/v2-helpers'
import { expect } from 'chai'
import { BigNumber, Contract, ContractTransaction } from 'ethers'

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

export async function assertRelayedBaseCost(
  tx: ContractTransaction,
  redeemedCost: BigNumber,
  tolerance = 0.05
): Promise<void> {
  const { gasUsed, effectiveGasPrice } = await tx.wait()
  const redeemedGas = redeemedCost.div(effectiveGasPrice)

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const relayedAction = await instanceAt('RelayedAction', tx.to!)
  const BASE_GAS = await relayedAction.BASE_GAS()

  if (redeemedGas.lt(gasUsed)) {
    const missing = gasUsed.sub(redeemedGas)
    const ideal = BASE_GAS.add(missing)
    const message = `Missing ${missing.toString()} gas units. Set it at least to ${ideal.toString()} gas units.`
    expect(redeemedGas.toNumber()).to.be.gt(gasUsed.toNumber(), message)
  } else {
    const extraGas = redeemedGas.sub(gasUsed)
    const ratio = decimal(redeemedGas).div(decimal(gasUsed)).toNumber() - 1
    const message = `Redeemed ${extraGas} extra gas units (+${(ratio * 100).toPrecision(4)} %)`
    if (ratio <= tolerance) console.log(message)
    else {
      const min = gasUsed.sub(redeemedGas.sub(BASE_GAS))
      const max = pct(gasUsed, 1 + tolerance).sub(redeemedGas.sub(BASE_GAS))
      expect(ratio).to.be.lte(tolerance, `${message}. Set it between ${min} and ${max}`)
    }
  }
}
