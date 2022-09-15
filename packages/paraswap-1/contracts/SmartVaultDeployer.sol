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

import '@mimic-fi/v2-wallet/contracts/IWallet.sol';
import '@mimic-fi/v2-helpers/contracts/utils/Arrays.sol';
import '@mimic-fi/v2-price-oracle/contracts/IPriceOracle.sol';
import '@mimic-fi/v2-registry/contracts/registry/IRegistry.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/BaseDeployer.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/IAction.sol';

import './actions/ERC20Claimer.sol';
import './actions/NativeClaimer.sol';

// solhint-disable avoid-low-level-calls

contract SmartVaultDeployer is BaseDeployer {
    struct Params {
        address owner;
        address[] managers;
        IRegistry registry;
        WalletParams walletParams;
        PriceOracleParams priceOracleParams;
        FeeClaimerParams feeClaimerParams;
        RelayedActionParams relayedActionParams;
        SmartVaultParams smartVaultParams;
    }

    struct FeeClaimerParams {
        address swapSigner;
        address feeClaimer;
        address thresholdToken;
        uint256 thresholdAmount;
    }

    function deploy(Params memory params) external {
        PriceOracle priceOracle = _createPriceOracle(params.registry, params.priceOracleParams, true);
        Wallet wallet = _createWallet(params.registry, params.walletParams, NO_STRATEGY, address(priceOracle), false);
        IAction erc20Claimer = _setupERC20ClaimerAction(wallet, params);
        IAction nativeClaimer = _setupNativeClaimerAction(wallet, params);
        address[] memory actions = _actions(erc20Claimer, nativeClaimer);
        _transferAdminPermissions(wallet, params.walletParams.admin);
        _createSmartVault(params.registry, params.smartVaultParams, address(wallet), actions, true);
    }

    function _setupNativeClaimerAction(Wallet wallet, Params memory params) internal returns (IAction) {
        // Create and setup action
        NativeClaimer claimer = new NativeClaimer(address(this), wallet);
        address[] memory executors = Arrays.from(params.owner, params.managers, params.relayedActionParams.relayers);
        _setupActionExecutors(claimer, executors, claimer.call.selector);
        _setupRelayedAction(claimer, params.owner, params.relayedActionParams);
        _setupBaseClaimerAction(claimer, params.owner, params.feeClaimerParams);
        _transferAdminPermissions(claimer, params.owner);

        // Authorize action to call and wrap
        wallet.authorize(address(claimer), wallet.call.selector);
        wallet.authorize(address(claimer), wallet.wrap.selector);
        wallet.authorize(address(claimer), wallet.withdraw.selector);
        return claimer;
    }

    function _setupERC20ClaimerAction(Wallet wallet, Params memory params) internal returns (IAction) {
        // Create and setup action
        ERC20Claimer claimer = new ERC20Claimer(address(this), wallet);
        address[] memory executors = Arrays.from(params.owner, params.managers, params.relayedActionParams.relayers);
        _setupActionExecutors(claimer, executors, claimer.call.selector);
        _setupRelayedAction(claimer, params.owner, params.relayedActionParams);
        _setupBaseClaimerAction(claimer, params.owner, params.feeClaimerParams);
        _setupSwapSignerAction(claimer, params.owner, params.feeClaimerParams.swapSigner);
        _transferAdminPermissions(claimer, params.owner);

        // Authorize action to call and swap
        wallet.authorize(address(claimer), wallet.call.selector);
        wallet.authorize(address(claimer), wallet.swap.selector);
        wallet.authorize(address(claimer), wallet.withdraw.selector);
        return claimer;
    }

    function _setupBaseClaimerAction(BaseClaimer claimer, address admin, FeeClaimerParams memory params) internal {
        claimer.authorize(admin, claimer.setFeeClaimer.selector);
        claimer.authorize(address(this), claimer.setFeeClaimer.selector);
        claimer.setFeeClaimer(params.feeClaimer);
        claimer.unauthorize(address(this), claimer.setFeeClaimer.selector);

        claimer.authorize(admin, claimer.setThreshold.selector);
        claimer.authorize(address(this), claimer.setThreshold.selector);
        claimer.setThreshold(params.thresholdToken, params.thresholdAmount);
        claimer.unauthorize(address(this), claimer.setThreshold.selector);
    }

    function _setupSwapSignerAction(ERC20Claimer claimer, address admin, address signer) internal {
        claimer.authorize(admin, claimer.setSwapSigner.selector);
        claimer.authorize(address(this), claimer.setSwapSigner.selector);
        claimer.setSwapSigner(signer);
        claimer.unauthorize(address(this), claimer.setSwapSigner.selector);
    }
}
