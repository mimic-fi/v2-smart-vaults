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
import '@mimic-fi/v2-smart-vaults-base/contracts/deploy/Deployer.sol';

import './actions/claim/Claimer.sol';
import './actions/swap/BaseSwapper.sol';

// solhint-disable avoid-low-level-calls

contract BaseSmartVaultDeployer {
    using UncheckedMath for uint256;

    struct ClaimerActionParams {
        address impl;
        address admin;
        address[] managers;
        address protocolFeeWithdrawer;
        Deployer.RelayedActionParams relayedActionParams;
        Deployer.TokenThresholdActionParams tokenThresholdActionParams;
    }

    struct SwapperActionParams {
        address impl;
        address admin;
        address[] managers;
        address tokenOut;
        address swapSigner;
        address[] deniedTokens;
        uint256 defaultMaxSlippage;
        address[] customSlippageTokens;
        uint256[] customSlippageValues;
        Deployer.RelayedActionParams relayedActionParams;
        Deployer.TokenThresholdActionParams tokenThresholdActionParams;
    }

    function _setupClaimerAction(SmartVault smartVault, ClaimerActionParams memory params, address mimic) internal {
        // Create and setup action
        Claimer claimer = Claimer(params.impl);
        Deployer.setupBaseAction(claimer, params.admin, address(smartVault));
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        Deployer.setupActionExecutors(claimer, executors, claimer.call.selector);
        Deployer.setupTokenThresholdAction(claimer, params.admin, params.tokenThresholdActionParams);
        Deployer.setupRelayedAction(claimer, params.admin, params.relayedActionParams);

        // Set protocol fee withdrawer
        claimer.authorize(params.admin, claimer.setProtocolFeeWithdrawer.selector);
        claimer.authorize(address(this), claimer.setProtocolFeeWithdrawer.selector);
        claimer.setProtocolFeeWithdrawer(params.protocolFeeWithdrawer);
        claimer.unauthorize(address(this), claimer.setProtocolFeeWithdrawer.selector);

        // Grant admin rights to mimic and transfer admin permissions to admin
        Deployer.grantAdminPermissions(claimer, mimic);
        Deployer.transferAdminPermissions(claimer, params.admin);

        // Authorize action to call and withdraw
        smartVault.authorize(address(claimer), smartVault.call.selector);
        smartVault.authorize(address(claimer), smartVault.withdraw.selector);
    }

    function _setupSwapperAction(
        SmartVault smartVault,
        SwapperActionParams memory params,
        bytes4 selector,
        address mimic
    ) internal {
        // Create and setup action
        BaseSwapper swapper = BaseSwapper(params.impl);
        Deployer.setupBaseAction(swapper, params.admin, address(smartVault));
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        Deployer.setupActionExecutors(swapper, executors, selector);
        Deployer.setupTokenThresholdAction(swapper, params.admin, params.tokenThresholdActionParams);
        Deployer.setupRelayedAction(swapper, params.admin, params.relayedActionParams);

        // Set token out
        swapper.authorize(params.admin, swapper.setTokenOut.selector);
        swapper.authorize(address(this), swapper.setTokenOut.selector);
        swapper.setTokenOut(params.tokenOut);
        swapper.unauthorize(address(this), swapper.setTokenOut.selector);

        // Set swap signer
        swapper.authorize(params.admin, swapper.setSwapSigner.selector);
        swapper.authorize(address(this), swapper.setSwapSigner.selector);
        swapper.setSwapSigner(params.swapSigner);
        swapper.unauthorize(address(this), swapper.setSwapSigner.selector);

        // Set default max slippage
        swapper.authorize(params.admin, swapper.setDefaultMaxSlippage.selector);
        swapper.authorize(address(this), swapper.setDefaultMaxSlippage.selector);
        swapper.setDefaultMaxSlippage(params.defaultMaxSlippage);
        swapper.unauthorize(address(this), swapper.setDefaultMaxSlippage.selector);

        // Set custom token max slippages
        bool isCustomSlippageLengthValid = params.customSlippageTokens.length == params.customSlippageValues.length;
        require(isCustomSlippageLengthValid, 'DEPLOYER_SLIPPAGES_INVALID_LEN');
        swapper.authorize(params.admin, swapper.setTokenMaxSlippage.selector);
        swapper.authorize(address(this), swapper.setTokenMaxSlippage.selector);
        for (uint256 i = 0; i < params.customSlippageTokens.length; i++) {
            swapper.setTokenMaxSlippage(params.customSlippageTokens[i], params.customSlippageValues[i]);
        }
        swapper.unauthorize(address(this), swapper.setTokenMaxSlippage.selector);

        // Deny requested tokens
        swapper.authorize(params.admin, swapper.setDeniedTokens.selector);
        swapper.authorize(address(this), swapper.setDeniedTokens.selector);
        swapper.setDeniedTokens(params.deniedTokens, _trues(params.deniedTokens.length));
        swapper.unauthorize(address(this), swapper.setDeniedTokens.selector);

        // Grant admin rights to mimic and transfer admin permissions to admin
        Deployer.grantAdminPermissions(swapper, mimic);
        Deployer.transferAdminPermissions(swapper, params.admin);

        // Authorize action to swap and withdraw
        smartVault.authorize(address(swapper), smartVault.swap.selector);
        smartVault.authorize(address(swapper), smartVault.withdraw.selector);
    }

    function _trues(uint256 length) internal pure returns (bool[] memory arr) {
        arr = new bool[](length);
        for (uint256 i = 0; i < length; i = i.uncheckedAdd(1)) arr[i] = true;
    }
}
