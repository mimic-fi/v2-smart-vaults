import fs from 'fs'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import path from 'path'

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-unused-vars */

export async function deployFromHre(args: any, hreOrNetwork: string | HardhatRuntimeEnvironment): Promise<void> {
  const network = typeof hreOrNetwork === 'string' ? hreOrNetwork : hreOrNetwork.network.name
  await deploy(network)
}

export async function deploy(
  network: string,
  outputFileName: string = network,
  rootDir?: string
): Promise<{ [key: string]: string }> {
  const scriptPath = dir('index.ts', rootDir)
  if (!fs.existsSync(scriptPath)) throw Error('Missing deployment script')
  const script = require(scriptPath).default

  const input = readInput(network, rootDir)
  await script(input, writeOutput(outputFileName, rootDir))
  return readOutput(outputFileName, rootDir)
}

export function readInput(network: string, rootDir?: string): { [key: string]: any } {
  const generalInputPath = dir('input.ts', rootDir)
  const existsGeneralInputPath = fs.existsSync(generalInputPath)
  const generalInput = existsGeneralInputPath ? require(generalInputPath).default[network] : undefined

  const networkInputPath = dir(`input.${network}.ts`, rootDir)
  const existsNetworkInputPath = fs.existsSync(networkInputPath)
  const networkInput = existsNetworkInputPath ? require(networkInputPath).default : undefined

  if (generalInput && networkInput) throw Error(`Multiple inputs for the same network '${network}'`)
  if (!generalInput && !networkInput) throw Error(`Missing input for network '${network}'`)
  return generalInput || networkInput
}

export function readOutput(outputFileName: string, rootDir?: string): { [key: string]: string } {
  const outputFile = dir(`output/${outputFileName}.json`, rootDir)
  return fs.existsSync(outputFile) ? JSON.parse(fs.readFileSync(outputFile).toString()) : {}
}

export function writeOutput(outputFileName: string, rootDir?: string): (key: string, value: string) => void {
  return (key: string, value: string): void => {
    console.log(`${key}: ${value}`)
    const outputPath = dir('output', rootDir)
    if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath)

    const outputFile = dir(`output/${outputFileName}.json`, rootDir)
    const previousOutput = fs.existsSync(outputFile) ? JSON.parse(fs.readFileSync(outputFile).toString()) : {}

    const finalOutput = { ...previousOutput, [key]: value }
    const finalOutputJSON = JSON.stringify(finalOutput, null, 2)
    fs.writeFileSync(outputFile, finalOutputJSON)
  }
}

function dir(name: string, rootDir?: string): string {
  return path.join(rootDir || process.cwd(), 'deploy', name)
}
