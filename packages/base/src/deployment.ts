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

export async function deploy(network: string, outputFileName: string = network): Promise<{ [key: string]: string }> {
  const scriptPath = dir('index.ts')
  if (!fs.existsSync(scriptPath)) throw Error('Missing deployment script')
  const script = require(scriptPath).default

  const input = readInput(network)
  await script(input, writeOutput(outputFileName))
  return readOutput(outputFileName)
}

export function readInput(network: string): { [key: string]: any } {
  const generalInputPath = dir('input.ts')
  const existsGeneralInputPath = fs.existsSync(generalInputPath)
  const generalInput = existsGeneralInputPath ? require(generalInputPath).default[network] : undefined

  const networkInputPath = dir(`input.${network}.ts`)
  const existsNetworkInputPath = fs.existsSync(networkInputPath)
  const networkInput = existsNetworkInputPath ? require(networkInputPath).default : undefined

  if (generalInput && networkInput) throw Error(`Multiple inputs for the same network '${network}'`)
  if (!generalInput && !networkInput) throw Error(`Missing input for network '${network}'`)
  return generalInput || networkInput
}

export function readOutput(outputFileName: string): { [key: string]: string } {
  const outputFile = dir(`output/${outputFileName}.json`)
  return fs.existsSync(outputFile) ? JSON.parse(fs.readFileSync(outputFile).toString()) : {}
}

function writeOutput(outputFileName: string): (key: string, value: string) => void {
  return (key: string, value: string): void => {
    console.log(`${key}: ${value}`)
    const outputPath = dir('output')
    if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath)

    const outputFile = dir(`output/${outputFileName}.json`)
    const previousOutput = fs.existsSync(outputFile) ? JSON.parse(fs.readFileSync(outputFile).toString()) : {}

    const finalOutput = { ...previousOutput, [key]: value }
    const finalOutputJSON = JSON.stringify(finalOutput, null, 2)
    fs.writeFileSync(outputFile, finalOutputJSON)
  }
}

function dir(name: string): string {
  return path.join(process.cwd(), 'deploy', name)
}
