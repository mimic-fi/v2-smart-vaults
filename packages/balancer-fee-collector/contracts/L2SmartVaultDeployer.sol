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
import './actions/bridge/L2HopBridger.sol';
import './actions/swap/OneInchSwapper.sol';
import './actions/swap/ParaswapSwapper.sol';

// solhint-disable avoid-low-level-calls

contract L2SmartVaultDeployer is BaseSmartVaultDeployer {
    using UncheckedMath for uint256;

    struct Params {
        address mimic;
        IRegistry registry;
        Deployer.SmartVaultParams smartVaultParams;
        ClaimerActionParams claimerActionParams;
        SwapperActionParams oneInchSwapperActionParams;
        SwapperActionParams paraswapSwapperActionParams;
        L2HopBridgerActionParams l2HopBridgerActionParams;
    }

    struct L2HopBridgerActionParams {
        address impl;
        address admin;
        address[] managers;
        uint256 maxDeadline;
        uint256 maxSlippage;
        uint256 maxBonderFeePct;
        uint256 destinationChainId;
        HopAmmParams[] hopAmmParams;
        Deployer.RelayedActionParams relayedActionParams;
        Deployer.TokenThresholdActionParams tokenThresholdActionParams;
    }

    struct HopAmmParams {
        address token;
        address amm;
    }

    function deploy(Params memory params) external {
        address mimic = params.mimic;
        SmartVault smartVault = Deployer.createSmartVault(params.registry, params.smartVaultParams, false);
        _setupClaimerAction(smartVault, params.claimerActionParams, mimic);
        _setupSwapperAction(smartVault, params.oneInchSwapperActionParams, OneInchSwapper.call.selector, mimic);
        _setupSwapperAction(smartVault, params.paraswapSwapperActionParams, ParaswapSwapper.call.selector, mimic);
        _setupL2HopBridgerAction(smartVault, params.l2HopBridgerActionParams, mimic);
        Deployer.grantAdminPermissions(smartVault, mimic);
        Deployer.transferAdminPermissions(smartVault, params.smartVaultParams.admin);
    }

    function _setupL2HopBridgerAction(SmartVault smartVault, L2HopBridgerActionParams memory params, address mimic)
        internal
    {
        // Create and setup action
        L2HopBridger bridger = L2HopBridger(payable(params.impl));
        Deployer.setupBaseAction(bridger, params.admin, address(smartVault));
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        Deployer.setupActionExecutors(bridger, executors, bridger.call.selector);
        Deployer.setupReceiverAction(bridger, params.admin);
        Deployer.setupRelayedAction(bridger, params.admin, params.relayedActionParams);
        Deployer.setupTokenThresholdAction(bridger, params.admin, params.tokenThresholdActionParams);

        // Set bridger max deadline
        bridger.authorize(params.admin, bridger.setMaxDeadline.selector);
        bridger.authorize(address(this), bridger.setMaxDeadline.selector);
        bridger.setMaxDeadline(params.maxDeadline);
        bridger.unauthorize(address(this), bridger.setMaxDeadline.selector);

        // Set bridger max slippage
        bridger.authorize(params.admin, bridger.setMaxSlippage.selector);
        bridger.authorize(address(this), bridger.setMaxSlippage.selector);
        bridger.setMaxSlippage(params.maxSlippage);
        bridger.unauthorize(address(this), bridger.setMaxSlippage.selector);

        // Set bridger max bonder fee pct
        bridger.authorize(params.admin, bridger.setMaxBonderFeePct.selector);
        bridger.authorize(address(this), bridger.setMaxBonderFeePct.selector);
        bridger.setMaxBonderFeePct(params.maxBonderFeePct);
        bridger.unauthorize(address(this), bridger.setMaxBonderFeePct.selector);

        // Set bridger AMMs
        bridger.authorize(params.admin, bridger.setTokenAmm.selector);
        bridger.authorize(address(this), bridger.setTokenAmm.selector);
        for (uint256 i = 0; i < params.hopAmmParams.length; i = i.uncheckedAdd(1)) {
            HopAmmParams memory hopAmmParam = params.hopAmmParams[i];
            bridger.setTokenAmm(hopAmmParam.token, hopAmmParam.amm);
        }
        bridger.unauthorize(address(this), bridger.setTokenAmm.selector);

        // Set bridger destination chain ID
        bridger.authorize(params.admin, bridger.setDestinationChainId.selector);
        bridger.authorize(address(this), bridger.setDestinationChainId.selector);
        bridger.setDestinationChainId(params.destinationChainId);
        bridger.unauthorize(address(this), bridger.setDestinationChainId.selector);

        // Grant admin rights to mimic and transfer admin permissions to admin
        Deployer.grantAdminPermissions(bridger, mimic);
        Deployer.transferAdminPermissions(bridger, params.admin);

        // Authorize action to bridge and withdraw from Smart Vault
        smartVault.authorize(address(bridger), smartVault.bridge.selector);
        smartVault.authorize(address(bridger), smartVault.withdraw.selector);
    }
}
