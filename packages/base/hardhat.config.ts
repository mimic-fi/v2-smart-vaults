import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-local-networks-config-plugin'

import { task } from 'hardhat/config'
import { homedir } from 'os'
import path from 'path'

import deploy from './deploy'

task('deploy', 'Deploy Mimic').setAction(deploy)

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
