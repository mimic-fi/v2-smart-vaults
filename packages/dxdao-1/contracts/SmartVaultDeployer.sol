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

import '@mimic-fi/v2-wallet/contracts/Wallet.sol';
import '@mimic-fi/v2-helpers/contracts/utils/Arrays.sol';
import '@mimic-fi/v2-registry/contracts/registry/IRegistry.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/Deployer.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/IAction.sol';

import './actions/Wrapper.sol';

// solhint-disable avoid-low-level-calls

contract SmartVaultDeployer {
    struct Params {
        IRegistry registry;
        WrapperActionParams wrapperActionParams;
        Deployer.SmartVaultParams smartVaultParams;
    }

    struct WrapperActionParams {
        address impl;
        address admin;
        address[] managers;
        Deployer.RelayedActionParams relayedActionParams;
        Deployer.WithdrawalActionParams withdrawalActionParams;
        Deployer.TokenThresholdActionParams tokenThresholdActionParams;
    }

    function deploy(Params memory params) external {
        Wallet wallet = Deployer.createWallet(params.registry, params.smartVaultParams.walletParams, false);
        IAction wrapper = _setupWrapperAction(wallet, params.wrapperActionParams);
        Deployer.transferAdminPermissions(wallet, params.smartVaultParams.walletParams.admin);
        Deployer.createSmartVault(params.registry, params.smartVaultParams, address(wallet), _actions(wrapper), true);
    }

    function _setupWrapperAction(Wallet wallet, WrapperActionParams memory params) internal returns (IAction) {
        // Create and setup action
        Wrapper wrapper = Wrapper(params.impl);
        Deployer.setupBaseAction(wrapper, params.admin, address(wallet));
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        Deployer.setupActionExecutors(wrapper, executors, wrapper.call.selector);
        Deployer.setupRelayedAction(wrapper, params.admin, params.relayedActionParams);
        Deployer.setupTokenThresholdAction(wrapper, params.admin, params.tokenThresholdActionParams);
        Deployer.setupWithdrawalAction(wrapper, params.admin, params.withdrawalActionParams);
        Deployer.transferAdminPermissions(wrapper, params.admin);

        // Authorize action to wrap and withdraw from wallet
        wallet.authorize(address(wrapper), wallet.wrap.selector);
        wallet.authorize(address(wrapper), wallet.withdraw.selector);
        return wrapper;
    }

    function _actions(IAction action) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = address(action);
    }
}
