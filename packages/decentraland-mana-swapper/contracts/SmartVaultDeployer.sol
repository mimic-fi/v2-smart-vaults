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
import '@mimic-fi/v2-smart-vaults-base/contracts/Deployer.sol';

import './actions/DEXSwapper.sol';
import './actions/OTCSwapper.sol';
import './actions/Withdrawer.sol';

// solhint-disable avoid-low-level-calls

contract SmartVaultDeployer {
    using UncheckedMath for uint256;

    struct Params {
        IRegistry registry;
        SwapperActionParams dexSwapperActionParams;
        SwapperActionParams otcSwapperActionParams;
        WithdrawerActionParams withdrawerActionParams;
        Deployer.SmartVaultParams smartVaultParams;
    }

    struct SwapperActionParams {
        address impl;
        address admin;
        address[] managers;
        address tokenIn;
        address tokenOut;
        uint256 maxSlippage;
        Deployer.RelayedActionParams relayedActionParams;
        Deployer.TokenThresholdActionParams tokenThresholdActionParams;
    }

    struct WithdrawerActionParams {
        address impl;
        address admin;
        address[] managers;
        address token;
        Deployer.RelayedActionParams relayedActionParams;
        Deployer.WithdrawalActionParams withdrawalActionParams;
        Deployer.TokenThresholdActionParams tokenThresholdActionParams;
    }

    function deploy(Params memory params) external {
        SmartVault smartVault = Deployer.createSmartVault(params.registry, params.smartVaultParams, false);
        _setupDexSwapperAction(smartVault, params.dexSwapperActionParams);
        _setupOtcSwapperAction(smartVault, params.otcSwapperActionParams);
        _setupWithdrawerAction(smartVault, params.withdrawerActionParams);
        Deployer.transferAdminPermissions(smartVault, params.smartVaultParams.admin);
    }

    function _setupDexSwapperAction(SmartVault smartVault, SwapperActionParams memory params) internal {
        DEXSwapper swapper = DEXSwapper(address(_setupSwapperAction(smartVault, params)));

        // Allow executors and transfer admin permissions to admin
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        Deployer.setupActionExecutors(swapper, executors, swapper.call.selector);
        Deployer.transferAdminPermissions(swapper, params.admin);

        // Authorize action to swap and withdraw from Smart Vault
        smartVault.authorize(address(swapper), smartVault.swap.selector);
        smartVault.authorize(address(swapper), smartVault.withdraw.selector);
    }

    function _setupOtcSwapperAction(SmartVault smartVault, SwapperActionParams memory params) internal {
        OTCSwapper swapper = OTCSwapper(address(_setupSwapperAction(smartVault, params)));

        // Allow ANY to execute and transfer admin permissions to admin
        swapper.authorize(swapper.ANY_ADDRESS(), swapper.call.selector);
        Deployer.transferAdminPermissions(swapper, params.admin);

        // Authorize action to collect and withdraw from Smart Vault
        smartVault.authorize(address(swapper), smartVault.collect.selector);
        smartVault.authorize(address(swapper), smartVault.withdraw.selector);
    }

    function _setupSwapperAction(SmartVault smartVault, SwapperActionParams memory params)
        internal
        returns (BaseSwapper swapper)
    {
        // Create and setup action
        swapper = BaseSwapper(params.impl);
        Deployer.setupBaseAction(swapper, params.admin, address(smartVault));
        Deployer.setupRelayedAction(swapper, params.admin, params.relayedActionParams);
        Deployer.setupTokenThresholdAction(swapper, params.admin, params.tokenThresholdActionParams);

        // Set swapper token in
        swapper.authorize(params.admin, swapper.setTokenIn.selector);
        swapper.authorize(address(this), swapper.setTokenIn.selector);
        swapper.setTokenIn(params.tokenIn);
        swapper.unauthorize(address(this), swapper.setTokenIn.selector);

        // Set swapper token out
        swapper.authorize(params.admin, swapper.setTokenOut.selector);
        swapper.authorize(address(this), swapper.setTokenOut.selector);
        swapper.setTokenOut(params.tokenOut);
        swapper.unauthorize(address(this), swapper.setTokenOut.selector);

        // Set swapper max slippage
        swapper.authorize(params.admin, swapper.setMaxSlippage.selector);
        swapper.authorize(address(this), swapper.setMaxSlippage.selector);
        swapper.setMaxSlippage(params.maxSlippage);
        swapper.unauthorize(address(this), swapper.setMaxSlippage.selector);
    }

    function _setupWithdrawerAction(SmartVault smartVault, WithdrawerActionParams memory params) internal {
        // Create and setup action
        Withdrawer withdrawer = Withdrawer(params.impl);
        Deployer.setupBaseAction(withdrawer, params.admin, address(smartVault));
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        Deployer.setupActionExecutors(withdrawer, executors, withdrawer.call.selector);
        Deployer.setupRelayedAction(withdrawer, params.admin, params.relayedActionParams);
        Deployer.setupTokenThresholdAction(withdrawer, params.admin, params.tokenThresholdActionParams);
        Deployer.setupWithdrawalAction(withdrawer, params.admin, params.withdrawalActionParams);

        // Set withdrawer token
        withdrawer.authorize(params.admin, withdrawer.setToken.selector);
        withdrawer.authorize(address(this), withdrawer.setToken.selector);
        withdrawer.setToken(params.token);
        withdrawer.unauthorize(address(this), withdrawer.setToken.selector);

        // Transfer admin permissions to admin
        Deployer.transferAdminPermissions(withdrawer, params.admin);

        // Authorize action to withdraw from Smart Vault
        smartVault.authorize(address(withdrawer), smartVault.withdraw.selector);
    }
}
