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
import '@mimic-fi/v2-smart-vault/contracts/SmartVault.sol';
import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';
import '@mimic-fi/v2-helpers/contracts/math/UncheckedMath.sol';
import '@mimic-fi/v2-price-oracle/contracts/PriceOracle.sol';
import '@mimic-fi/v2-registry/contracts/registry/IRegistry.sol';

import './actions/RelayedAction.sol';
import './actions/WithdrawalAction.sol';

contract BaseDeployer {
    using UncheckedMath for uint256;

    address internal constant NO_STRATEGY = address(0);
    address internal constant NO_PRICE_ORACLE = address(0);

    bytes32 private constant WALLET_NAMESPACE = keccak256('WALLET');
    bytes32 private constant SMART_VAULT_NAMESPACE = keccak256('SMART_VAULT');

    struct SmartVaultParams {
        address impl;
        address admin;
    }

    struct WalletParams {
        address impl;
        address admin;
        address feeCollector;
        address strategy;
        address swapConnector;
        uint256 swapFee;
        uint256 withdrawFee;
        uint256 performanceFee;
    }

    struct PriceOracleParams {
        address impl;
        address admin;
        address[] bases;
        address[] quotes;
        address[] feeds;
    }

    struct RelayedActionParams {
        address[] relayers;
        uint256 gasPriceLimit;
        uint256 totalCostLimit;
        address payingGasToken;
    }

    function _createSmartVault(
        IRegistry registry,
        SmartVaultParams memory params,
        address wallet,
        address[] memory actions,
        bool transferPermissions
    ) internal returns (SmartVault smartVault) {
        // Clone requested smart vault implementation and initialize
        require(registry.isRegistered(SMART_VAULT_NAMESPACE, params.impl), 'SMART_VAULT_IMPL_NOT_REGISTERED');
        bytes memory initializeData = abi.encodeWithSelector(SmartVault.initialize.selector, address(this));
        smartVault = SmartVault(registry.clone(params.impl, initializeData));

        // Set wallet
        smartVault.authorize(address(this), smartVault.setWallet.selector);
        smartVault.setWallet(wallet);
        smartVault.unauthorize(address(this), smartVault.setWallet.selector);

        // Set actions
        smartVault.authorize(address(this), smartVault.setAction.selector);
        for (uint256 i = 0; i < actions.length; i = i.uncheckedAdd(1)) smartVault.setAction(actions[i], true);
        smartVault.unauthorize(address(this), smartVault.setAction.selector);

        // Authorize admin
        smartVault.authorize(params.admin, smartVault.setWallet.selector);
        smartVault.authorize(params.admin, smartVault.setAction.selector);
        if (transferPermissions) _transferAdminPermissions(smartVault, params.admin);
    }

    function _createWallet(
        IRegistry registry,
        WalletParams memory params,
        address strategy,
        address priceOracle,
        bool transferPermissions
    ) internal returns (Wallet wallet) {
        // Clone requested wallet implementation and initialize
        require(registry.isRegistered(WALLET_NAMESPACE, params.impl), 'WALLET_IMPL_NOT_REGISTERED');
        bytes memory initializeData = abi.encodeWithSelector(Wallet.initialize.selector, address(this));
        wallet = Wallet(payable(registry.clone(params.impl, initializeData)));

        // Authorize admin to perform any action except setting the fee collector, see below
        wallet.authorize(params.admin, wallet.collect.selector);
        wallet.authorize(params.admin, wallet.withdraw.selector);
        wallet.authorize(params.admin, wallet.wrap.selector);
        wallet.authorize(params.admin, wallet.unwrap.selector);
        wallet.authorize(params.admin, wallet.claim.selector);
        wallet.authorize(params.admin, wallet.join.selector);
        wallet.authorize(params.admin, wallet.exit.selector);
        wallet.authorize(params.admin, wallet.swap.selector);
        wallet.authorize(params.admin, wallet.setStrategy.selector);
        wallet.authorize(params.admin, wallet.setPriceOracle.selector);
        wallet.authorize(params.admin, wallet.setSwapConnector.selector);
        wallet.authorize(params.admin, wallet.setWithdrawFee.selector);
        wallet.authorize(params.admin, wallet.setPerformanceFee.selector);
        wallet.authorize(params.admin, wallet.setSwapFee.selector);

        // Set price oracle if given
        if (priceOracle != address(0)) {
            wallet.authorize(address(this), wallet.setPriceOracle.selector);
            wallet.setPriceOracle(priceOracle);
            wallet.unauthorize(address(this), wallet.setPriceOracle.selector);
        }

        // Set strategy if given
        if (strategy != address(0)) {
            wallet.authorize(address(this), wallet.setStrategy.selector);
            wallet.setStrategy(strategy);
            wallet.unauthorize(address(this), wallet.setStrategy.selector);
        }

        // Set swap connector if given
        if (params.swapConnector != address(0)) {
            wallet.authorize(address(this), wallet.setSwapConnector.selector);
            wallet.setSwapConnector(params.swapConnector);
            wallet.unauthorize(address(this), wallet.setSwapConnector.selector);
        }

        // Set fee collector if given, if not make sure no fee amounts were requested too
        // If there is a fee collector, authorize that address to change it, otherwise authorize the requested admin
        if (params.feeCollector != address(0)) {
            wallet.authorize(params.feeCollector, wallet.setFeeCollector.selector);
            wallet.authorize(address(this), wallet.setFeeCollector.selector);
            wallet.setFeeCollector(params.feeCollector);
            wallet.unauthorize(address(this), wallet.setFeeCollector.selector);
        } else {
            bool noFees = params.withdrawFee == 0 && params.swapFee == 0 && params.performanceFee == 0;
            require(noFees, 'WALLET_FEES_WITHOUT_COLLECTOR');
            wallet.authorize(params.admin, wallet.setFeeCollector.selector);
        }

        // Set withdraw fee if not zero
        if (params.withdrawFee != 0) {
            wallet.authorize(address(this), wallet.setWithdrawFee.selector);
            wallet.setWithdrawFee(params.withdrawFee);
            wallet.unauthorize(address(this), wallet.setWithdrawFee.selector);
        }

        // Set swap fee if not zero
        if (params.swapFee != 0) {
            wallet.authorize(address(this), wallet.setSwapFee.selector);
            wallet.setSwapFee(params.swapFee);
            wallet.unauthorize(address(this), wallet.setSwapFee.selector);
        }

        // Set performance fee if not zero
        if (params.performanceFee != 0) {
            wallet.authorize(address(this), wallet.setPerformanceFee.selector);
            wallet.setPerformanceFee(params.performanceFee);
            wallet.unauthorize(address(this), wallet.setPerformanceFee.selector);
        }

        if (transferPermissions) _transferAdminPermissions(wallet, params.admin);
    }

    function _createPriceOracle(IRegistry registry, PriceOracleParams memory params, bool transferPermissions)
        internal
        returns (PriceOracle priceOracle)
    {
        // Clone requested price oracle implementation and initialize
        bytes memory initializeData = abi.encodeWithSelector(PriceOracle.initialize.selector, address(this));
        priceOracle = PriceOracle(registry.clone(params.impl, initializeData));

        // Set feeds – it does not fail if there are no feeds
        priceOracle.authorize(address(this), priceOracle.setFeeds.selector);
        priceOracle.setFeeds(params.bases, params.quotes, params.feeds);
        priceOracle.unauthorize(address(this), priceOracle.setFeeds.selector);

        // Authorize admin
        priceOracle.authorize(params.admin, priceOracle.setFeeds.selector);
        if (transferPermissions) _transferAdminPermissions(priceOracle, params.admin);
    }

    function _setupActionExecutors(RelayedAction action, address[] memory executors, bytes4 callSelector) internal {
        for (uint256 i = 0; i < executors.length; i = i.uncheckedAdd(1)) {
            action.authorize(executors[i], callSelector);
        }
    }

    function _setupRelayedAction(RelayedAction action, address admin, RelayedActionParams memory params) internal {
        // Authorize admin to set relayers and txs limits
        action.authorize(admin, action.setLimits.selector);
        action.authorize(admin, action.setRelayer.selector);

        // Authorize relayers to call action
        action.authorize(address(this), action.setRelayer.selector);
        for (uint256 i = 0; i < params.relayers.length; i = i.uncheckedAdd(1)) {
            action.setRelayer(params.relayers[i], true);
        }
        action.unauthorize(address(this), action.setRelayer.selector);

        // Set relayed transactions limits
        action.authorize(address(this), action.setLimits.selector);
        action.setLimits(params.gasPriceLimit, params.totalCostLimit, params.payingGasToken);
        action.unauthorize(address(this), action.setLimits.selector);
    }

    function _setupWithdrawalAction(WithdrawalAction action, address admin, address recipient) internal {
        action.authorize(admin, action.setRecipient.selector);
        action.authorize(address(this), action.setRecipient.selector);
        action.setRecipient(recipient);
        action.unauthorize(address(this), action.setRecipient.selector);
    }

    function _transferAdminPermissions(Authorizer target, address to) internal {
        _grantAdminPermissions(target, to);
        _revokeAdminPermissions(target, address(this));
    }

    function _grantAdminPermissions(Authorizer target, address to) internal {
        target.authorize(to, target.authorize.selector);
        target.authorize(to, target.unauthorize.selector);
    }

    function _revokeAdminPermissions(Authorizer target, address from) internal {
        target.unauthorize(from, target.authorize.selector);
        target.unauthorize(from, target.unauthorize.selector);
    }

    function _actions(IAction action) internal pure returns (address[] memory actions) {
        actions = new address[](1);
        actions[0] = address(action);
    }

    function _actions(IAction action1, IAction action2) internal pure returns (address[] memory actions) {
        actions = new address[](2);
        actions[0] = address(action1);
        actions[1] = address(action2);
    }
}
