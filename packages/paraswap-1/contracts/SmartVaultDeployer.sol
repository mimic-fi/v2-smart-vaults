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

import './actions/Withdrawer.sol';
import './actions/ERC20Claimer.sol';
import './actions/NativeClaimer.sol';

// solhint-disable avoid-low-level-calls

contract SmartVaultDeployer {
    struct Params {
        IRegistry registry;
        WithdrawerActionParams withdrawerActionParams;
        ERC20ClaimerActionParams erc20ClaimerActionParams;
        NativeClaimerActionParams nativeClaimerActionParams;
        Deployer.SmartVaultParams smartVaultParams;
    }

    struct WithdrawerActionParams {
        address impl;
        address admin;
        address[] managers;
        Deployer.RelayedActionParams relayedActionParams;
        Deployer.TimeLockedActionParams timeLockedActionParams;
        Deployer.WithdrawalActionParams withdrawalActionParams;
    }

    struct NativeClaimerActionParams {
        address impl;
        address admin;
        address[] managers;
        FeeClaimerParams feeClaimerParams;
    }

    struct ERC20ClaimerActionParams {
        address impl;
        address admin;
        address[] managers;
        address swapSigner;
        FeeClaimerParams feeClaimerParams;
    }

    struct FeeClaimerParams {
        address feeClaimer;
        Deployer.RelayedActionParams relayedActionParams;
        Deployer.TokenThresholdActionParams tokenThresholdActionParams;
    }

    function deploy(Params memory params) external {
        Wallet wallet = Deployer.createWallet(params.registry, params.smartVaultParams.walletParams, false);
        IAction withdrawer = _setupWithdrawerAction(wallet, params.withdrawerActionParams);
        IAction erc20Claimer = _setupERC20ClaimerAction(wallet, params.erc20ClaimerActionParams);
        IAction nativeClaimer = _setupNativeClaimerAction(wallet, params.nativeClaimerActionParams);
        address[] memory actions = _actions(withdrawer, erc20Claimer, nativeClaimer);
        Deployer.transferAdminPermissions(wallet, params.smartVaultParams.walletParams.admin);
        Deployer.createSmartVault(params.registry, params.smartVaultParams, address(wallet), actions, true);
    }

    function _setupWithdrawerAction(Wallet wallet, WithdrawerActionParams memory params) internal returns (IAction) {
        // Create and setup action
        Withdrawer withdrawer = Withdrawer(params.impl);
        Deployer.setupBaseAction(withdrawer, params.admin, address(wallet));
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        Deployer.setupActionExecutors(withdrawer, executors, withdrawer.call.selector);
        Deployer.setupRelayedAction(withdrawer, params.admin, params.relayedActionParams);
        Deployer.setupTimeLockedAction(withdrawer, params.admin, params.timeLockedActionParams);
        Deployer.setupWithdrawalAction(withdrawer, params.admin, params.withdrawalActionParams);
        Deployer.transferAdminPermissions(withdrawer, params.admin);

        // Authorize action to collect, unwrap, and withdraw from wallet
        wallet.authorize(address(withdrawer), wallet.withdraw.selector);
        return withdrawer;
    }

    function _setupNativeClaimerAction(Wallet wallet, NativeClaimerActionParams memory params)
        internal
        returns (IAction)
    {
        // Create and setup action
        NativeClaimer claimer = NativeClaimer(params.impl);
        Deployer.setupBaseAction(claimer, params.admin, address(wallet));
        address[] memory executors = Arrays.from(
            params.admin,
            params.managers,
            params.feeClaimerParams.relayedActionParams.relayers
        );
        Deployer.setupActionExecutors(claimer, executors, claimer.call.selector);
        Deployer.setupRelayedAction(claimer, params.admin, params.feeClaimerParams.relayedActionParams);
        _setupBaseClaimerAction(claimer, params.admin, params.feeClaimerParams);
        Deployer.transferAdminPermissions(claimer, params.admin);

        // Authorize action to call and wrap
        wallet.authorize(address(claimer), wallet.call.selector);
        wallet.authorize(address(claimer), wallet.wrap.selector);
        wallet.authorize(address(claimer), wallet.withdraw.selector);
        return claimer;
    }

    function _setupERC20ClaimerAction(Wallet wallet, ERC20ClaimerActionParams memory params)
        internal
        returns (IAction)
    {
        // Create and setup action
        ERC20Claimer claimer = ERC20Claimer(params.impl);
        Deployer.setupBaseAction(claimer, params.admin, address(wallet));
        address[] memory executors = Arrays.from(
            params.admin,
            params.managers,
            params.feeClaimerParams.relayedActionParams.relayers
        );
        Deployer.setupActionExecutors(claimer, executors, claimer.call.selector);
        Deployer.setupRelayedAction(claimer, params.admin, params.feeClaimerParams.relayedActionParams);
        _setupBaseClaimerAction(claimer, params.admin, params.feeClaimerParams);
        _setupSwapSignerAction(claimer, params.admin, params.swapSigner);
        Deployer.transferAdminPermissions(claimer, params.admin);

        // Authorize action to call and swap
        wallet.authorize(address(claimer), wallet.call.selector);
        wallet.authorize(address(claimer), wallet.swap.selector);
        wallet.authorize(address(claimer), wallet.withdraw.selector);
        return claimer;
    }

    function _setupBaseClaimerAction(BaseClaimer claimer, address admin, FeeClaimerParams memory params) internal {
        Deployer.setupTokenThresholdAction(claimer, admin, params.tokenThresholdActionParams);

        claimer.authorize(admin, claimer.setFeeClaimer.selector);
        claimer.authorize(address(this), claimer.setFeeClaimer.selector);
        claimer.setFeeClaimer(params.feeClaimer);
        claimer.unauthorize(address(this), claimer.setFeeClaimer.selector);
    }

    function _setupSwapSignerAction(ERC20Claimer claimer, address admin, address signer) internal {
        claimer.authorize(admin, claimer.setSwapSigner.selector);
        claimer.authorize(address(this), claimer.setSwapSigner.selector);
        claimer.setSwapSigner(signer);
        claimer.unauthorize(address(this), claimer.setSwapSigner.selector);
    }

    function _actions(IAction action1, IAction action2, IAction action3) internal pure returns (address[] memory arr) {
        arr = new address[](3);
        arr[0] = address(action1);
        arr[1] = address(action2);
        arr[2] = address(action3);
    }
}
