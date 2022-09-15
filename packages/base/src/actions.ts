import { Contract, ContractTransaction } from 'ethers'
import { LogDescription } from 'ethers/lib/utils'

export async function getActions(tx: ContractTransaction, smartVault: Contract): Promise<string[]> {
  const receipt = await tx.wait()
  return receipt.logs
    .map((log) => {
      try {
        return smartVault.interface.parseLog(log)
      } catch {
        return undefined
      }
    })
    .filter((e): e is LogDescription => e !== undefined)
    .filter((event) => event.name === 'ActionSet')
    .map((event) => event.args.action)
}
