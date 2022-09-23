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

import './actions/Withdrawer.sol';
import './actions/ERC20Claimer.sol';
import './actions/NativeClaimer.sol';

// solhint-disable avoid-low-level-calls

contract SmartVaultDeployer is BaseDeployer {
    struct Params {
        IRegistry registry;
        WalletParams walletParams;
        PriceOracleParams priceOracleParams;
        WithdrawerActionParams withdrawerActionParams;
        ERC20ClaimerActionParams erc20ClaimerActionParams;
        NativeClaimerActionParams nativeClaimerActionParams;
        SmartVaultParams smartVaultParams;
    }

    struct WithdrawerActionParams {
        address admin;
        address[] managers;
        RelayedActionParams relayedActionParams;
        WithdrawalActionParams withdrawalActionParams;
    }

    struct NativeClaimerActionParams {
        address admin;
        address[] managers;
        FeeClaimerParams feeClaimerParams;
    }

    struct ERC20ClaimerActionParams {
        address admin;
        address[] managers;
        address swapSigner;
        FeeClaimerParams feeClaimerParams;
    }

    struct FeeClaimerParams {
        address feeClaimer;
        RelayedActionParams relayedActionParams;
        TokenThresholdActionParams tokenThresholdActionParams;
    }

    function deploy(Params memory params) external {
        PriceOracle priceOracle = _createPriceOracle(params.registry, params.priceOracleParams, true);
        Wallet wallet = _createWallet(params.registry, params.walletParams, NO_STRATEGY, address(priceOracle), false);
        IAction withdrawer = _setupWithdrawerAction(wallet, params.withdrawerActionParams);
        IAction erc20Claimer = _setupERC20ClaimerAction(wallet, params.erc20ClaimerActionParams);
        IAction nativeClaimer = _setupNativeClaimerAction(wallet, params.nativeClaimerActionParams);
        address[] memory actions = _actions(withdrawer, erc20Claimer, nativeClaimer);
        _transferAdminPermissions(wallet, params.walletParams.admin);
        _createSmartVault(params.registry, params.smartVaultParams, address(wallet), actions, true);
    }

    function _setupWithdrawerAction(Wallet wallet, WithdrawerActionParams memory params) internal returns (IAction) {
        // Create and setup action
        Withdrawer withdrawer = new Withdrawer(address(this), wallet);
        address[] memory executors = Arrays.from(params.admin, params.managers, params.relayedActionParams.relayers);
        _setupActionExecutors(withdrawer, executors, withdrawer.call.selector);
        _setupRelayedAction(withdrawer, params.admin, params.relayedActionParams);
        _setupWithdrawalAction(withdrawer, params.admin, params.withdrawalActionParams);
        _transferAdminPermissions(withdrawer, params.admin);

        // Authorize action to collect, unwrap, and withdraw from wallet
        wallet.authorize(address(withdrawer), wallet.withdraw.selector);
        return withdrawer;
    }

    function _setupNativeClaimerAction(Wallet wallet, NativeClaimerActionParams memory params)
        internal
        returns (IAction)
    {
        // Create and setup action
        NativeClaimer claimer = new NativeClaimer(address(this), wallet);
        address[] memory executors = Arrays.from(
            params.admin,
            params.managers,
            params.feeClaimerParams.relayedActionParams.relayers
        );

        _setupActionExecutors(claimer, executors, claimer.call.selector);
        _setupRelayedAction(claimer, params.admin, params.feeClaimerParams.relayedActionParams);
        _setupBaseClaimerAction(claimer, params.admin, params.feeClaimerParams);
        _transferAdminPermissions(claimer, params.admin);

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
        ERC20Claimer claimer = new ERC20Claimer(address(this), wallet);
        address[] memory executors = Arrays.from(
            params.admin,
            params.managers,
            params.feeClaimerParams.relayedActionParams.relayers
        );

        _setupActionExecutors(claimer, executors, claimer.call.selector);
        _setupRelayedAction(claimer, params.admin, params.feeClaimerParams.relayedActionParams);
        _setupBaseClaimerAction(claimer, params.admin, params.feeClaimerParams);
        _setupSwapSignerAction(claimer, params.admin, params.swapSigner);
        _transferAdminPermissions(claimer, params.admin);

        // Authorize action to call and swap
        wallet.authorize(address(claimer), wallet.call.selector);
        wallet.authorize(address(claimer), wallet.swap.selector);
        wallet.authorize(address(claimer), wallet.withdraw.selector);
        return claimer;
    }

    function _setupBaseClaimerAction(BaseClaimer claimer, address admin, FeeClaimerParams memory params) internal {
        _setupTokenThresholdAction(claimer, admin, params.tokenThresholdActionParams);

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
}
