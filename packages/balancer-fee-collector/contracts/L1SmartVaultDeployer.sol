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

import '@mimic-fi/v2-helpers/contracts/utils/Arrays.sol';
import '@mimic-fi/v2-helpers/contracts/math/UncheckedMath.sol';
import '@mimic-fi/v2-registry/contracts/registry/IRegistry.sol';
import '@mimic-fi/v2-smart-vault/contracts/SmartVault.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/deploy/Deployer.sol';

import './BaseSmartVaultDeployer.sol';
import './actions/swap/OneInchSwapper.sol';
import './actions/swap/ParaswapSwapper.sol';
import './actions/withdraw/Withdrawer.sol';

// solhint-disable avoid-low-level-calls

contract L1SmartVaultDeployer is BaseSmartVaultDeployer {
    using UncheckedMath for uint256;

    struct Params {
        address mimic;
        IRegistry registry;
        Deployer.SmartVaultParams smartVaultParams;
        ClaimerActionParams claimerActionParams;
        SwapperActionParams oneInchSwapperActionParams;
        SwapperActionParams paraswapSwapperActionParams;
        WithdrawerActionParams withdrawerActionParams;
    }

    struct WithdrawerActionParams {
        address impl;
        address admin;
        address[] managers;
        Deployer.RelayedActionParams relayedActionParams;
        Deployer.WithdrawalActionParams withdrawalActionParams;
        Deployer.TimeLockedActionParams timeLockedActionParams;
        Deployer.TokenThresholdActionParams tokenThresholdActionParams;
    }

    function deploy(Params memory params) external {
        address mimic = params.mimic;
        SmartVault smartVault = Deployer.createSmartVault(params.registry, params.smartVaultParams, false);
        _setupClaimerAction(smartVault, params.claimerActionParams, mimic);
        _setupSwapperAction(smartVault, params.oneInchSwapperActionParams, OneInchSwapper.call.selector, mimic);
        _setupSwapperAction(smartVault, params.paraswapSwapperActionParams, ParaswapSwapper.call.selector, mimic);
        _setupWithdrawerAction(smartVault, params.withdrawerActionParams, mimic);
        Deployer.grantAdminPermissions(smartVault, mimic);
        Deployer.transferAdminPermissions(smartVault, params.smartVaultParams.admin);
    }

    function _setupWithdrawerAction(SmartVault smartVault, WithdrawerActionParams memory params, address mimic)
        internal
    {
        // Create and setup action
        Withdrawer withdrawer = Withdrawer(params.impl);
        Deployer.setupBaseAction(withdrawer, params.admin, address(smartVault));
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        Deployer.setupActionExecutors(withdrawer, executors, withdrawer.call.selector);
        Deployer.setupRelayedAction(withdrawer, params.admin, params.relayedActionParams);
        Deployer.setupTokenThresholdAction(withdrawer, params.admin, params.tokenThresholdActionParams);
        Deployer.setupWithdrawalAction(withdrawer, params.admin, params.withdrawalActionParams);

        // Grant admin rights to mimic and transfer admin permissions to admin
        Deployer.grantAdminPermissions(withdrawer, mimic);
        Deployer.transferAdminPermissions(withdrawer, params.admin);

        // Authorize action to withdraw from Smart Vault
        smartVault.authorize(address(withdrawer), smartVault.withdraw.selector);
    }
}
