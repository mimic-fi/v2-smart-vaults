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

import './actions/Wrapper.sol';
import './actions/Withdrawer.sol';

// solhint-disable avoid-low-level-calls

contract SmartVaultDeployer is BaseDeployer {
    struct Params {
        IRegistry registry;
        WalletParams walletParams;
        PriceOracleParams priceOracleParams;
        WrapperActionParams wrapperActionParams;
        WithdrawerActionParams withdrawerActionParams;
        SmartVaultParams smartVaultParams;
    }

    struct WrapperActionParams {
        address admin;
        address[] managers;
        RelayedActionParams relayedActionParams;
        TokenThresholdActionParams tokenThresholdActionParams;
    }

    struct WithdrawerActionParams {
        address admin;
        address[] managers;
        RelayedActionParams relayedActionParams;
        WithdrawalActionParams withdrawalActionParams;
        TimeLockedActionParams timeLockedActionParams;
        TokenThresholdActionParams tokenThresholdActionParams;
    }

    function deploy(Params memory params) external {
        PriceOracle priceOracle = _createPriceOracle(params.registry, params.priceOracleParams, true);
        Wallet wallet = _createWallet(params.registry, params.walletParams, NO_STRATEGY, address(priceOracle), false);
        IAction wrapper = _setupWrapperAction(wallet, params.wrapperActionParams);
        IAction withdrawer = _setupWithdrawerAction(wallet, params.withdrawerActionParams);
        address[] memory actions = _actions(wrapper, withdrawer);
        _transferAdminPermissions(wallet, params.walletParams.admin);
        _createSmartVault(params.registry, params.smartVaultParams, address(wallet), actions, true);
    }

    function _setupWrapperAction(Wallet wallet, WrapperActionParams memory params) internal returns (IAction) {
        // Create and setup action
        Wrapper wrapper = new Wrapper(address(this), wallet);
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        _setupActionExecutors(wrapper, executors, wrapper.call.selector);
        _setupRelayedAction(wrapper, params.admin, params.relayedActionParams);
        _setupTokenThresholdAction(wrapper, params.admin, params.tokenThresholdActionParams);
        _transferAdminPermissions(wrapper, params.admin);

        // Authorize action to wrap and withdraw from wallet
        wallet.authorize(address(wrapper), wallet.wrap.selector);
        wallet.authorize(address(wrapper), wallet.withdraw.selector);
        return wrapper;
    }

    function _setupWithdrawerAction(Wallet wallet, WithdrawerActionParams memory params) internal returns (IAction) {
        // Create and setup action
        Withdrawer withdrawer = new Withdrawer(address(this), wallet);
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        _setupActionExecutors(withdrawer, executors, withdrawer.call.selector);
        _setupRelayedAction(withdrawer, params.admin, params.relayedActionParams);
        _setupTimeLockedAction(withdrawer, params.admin, params.timeLockedActionParams);
        _setupWithdrawalAction(withdrawer, params.admin, params.withdrawalActionParams);
        _transferAdminPermissions(withdrawer, params.admin);

        // Authorize action to withdraw from wallet
        wallet.authorize(address(withdrawer), wallet.withdraw.selector);
        return withdrawer;
    }
}
