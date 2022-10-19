import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@mimic-fi/v2-helpers/dist/tests'
import 'hardhat-local-networks-config-plugin'

import { task } from 'hardhat/config'
import { homedir } from 'os'
import path from 'path'

import { deployFromHre } from './src/deployment'

task('deploy', 'Deploy Mimic').setAction(deployFromHre)

export default {
  localNetworksConfig: path.join(homedir(), '/.hardhat/networks.mimic.json'),
  solidity: {
    version: '0.8.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
}
