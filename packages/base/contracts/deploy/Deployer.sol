// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';

import './DeployerLib.sol';
import '../permissions/PermissionsManager.sol';

contract Deployer is Ownable {
    /**
     * @dev Emitted every time a smart vault is deployed
     */
    event SmartVaultDeployed(address indexed smartVault);

    /**
     * @dev Emitted every time a permissions manager is deployed
     */
    event PermissionsManagerDeployed(address indexed permissionsManager);

    /**
     * @dev Deployment params
     * @param owners List of addresses that will be allowed to set permissions
     * @param registry Address of the Mimic Registry to validate the implementation addresses
     * @param smartVaultParams Params to configure the Smart Vault to be deployed
     */
    struct DeployParams {
        address[] owners;
        IRegistry registry;
        DeployerLib.SmartVaultParams smartVaultParams;
    }

    /**
     * @dev Creates a new deployer contract
     */
    constructor(address deployer) {
        _transferOwnership(deployer);
    }

    /**
     * @dev Deploys a new smart vault environment
     */
    function deploy(DeployParams memory params) external onlyOwner {
        PermissionsManager manager = DeployerLib.createPermissionsManager(address(this));
        emit PermissionsManagerDeployed(address(manager));

        ISmartVault smartVault = DeployerLib.deploySmartVault(params.registry, params.smartVaultParams);
        emit SmartVaultDeployed(address(smartVault));

        DeployerLib.setUpPermissions(manager, smartVault, params.owners);
    }
}
