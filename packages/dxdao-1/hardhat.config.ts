import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-local-networks-config-plugin'

import { task } from 'hardhat/config'
import { homedir } from 'os'
import path from 'path'

import { deployHardhatTask } from '@mimic-fi/v2-smart-vaults-base'

task('deploy', 'Deploy smart vault').setAction(deployHardhatTask)

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
