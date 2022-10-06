import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@mimic-fi/v2-helpers/dist/tests'
import 'hardhat-local-networks-config-plugin'

import { deployment } from '@mimic-fi/v2-smart-vaults-base'
import { task } from 'hardhat/config'
import { homedir } from 'os'
import path from 'path'

task('deploy', 'Deploy smart vault').setAction(deployment.deployFromHre)

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
