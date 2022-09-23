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
import './actions/TimeLockedAction.sol';
import './actions/TokenThresholdAction.sol';

/**
 * @title BaseDeployer
 * @dev Base Deployer contract offering a bunch of set-up methods to deploy and customize smart vaults
 */
contract BaseDeployer {
    using UncheckedMath for uint256;

    // Internal constant meaning no strategy attached for a wallet
    address internal constant NO_STRATEGY = address(0);

    // Internal constant meaning no price oracle attached for a wallet
    address internal constant NO_PRICE_ORACLE = address(0);

    // Namespace to use by this deployer to fetch IWallet implementations from the Mimic Registry
    bytes32 private constant WALLET_NAMESPACE = keccak256('WALLET');

    // Namespace to use by this deployer to fetch ISmartVault implementations from the Mimic Registry
    bytes32 private constant SMART_VAULT_NAMESPACE = keccak256('SMART_VAULT');

    // Namespace to use by this deployer to fetch IPriceOracle implementations from the Mimic Registry
    bytes32 private constant PRICE_ORACLE_NAMESPACE = keccak256('PRICE_ORACLE');

    // Namespace to use by this deployer to fetch ISwapConnector implementations from the Mimic Registry
    bytes32 private constant SWAP_CONNECTOR_NAMESPACE = keccak256('SWAP_CONNECTOR');

    /**
     * @dev Smart vault params
     * @param impl Address of the Smart Vault implementation to be used
     * @param admin Address that will be granted with admin rights for the deployed Smart Vault
     */
    struct SmartVaultParams {
        address impl;
        address admin;
    }

    /**
     * @dev Wallet params
     * @param impl Address of the Wallet implementation to be used
     * @param admin Address that will be granted with admin rights for the deployed Wallet
     * @param feeCollector Address to be set as the fee collector
     * @param strategy Optional strategy to set for the Mimic Wallet
     * @param swapConnector Optional Swap Connector to set for the Mimic Wallet
     * @param swapFee Swap fee percentage, can be zero
     * @param withdrawFee Withdraw fee percentage, can be zero
     * @param performanceFee Performance fee percentage, can be zero
     */
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

    /**
     * @dev Price Oracle params
     * @param impl Address of the Price Oracle implementation to be used
     * @param admin Address that will be granted with admin rights for the deployed Price Oracle
     * @param bases List of base tokens to be set
     * @param quotes List of quote tokens to be set
     * @param feeds List of feeds to be set
     */
    struct PriceOracleParams {
        address impl;
        address admin;
        address[] bases;
        address[] quotes;
        address[] feeds;
    }

    /**
     * @dev Relayed action params
     * @param relayers List of addresses to be marked as allowed executors and in particular as authorized relayers
     * @param gasPriceLimit Gas price limit to be used for the relayed action
     * @param totalCostLimit Total cost limit to be used for the relayed action
     * @param payingGasToken Paying gas token to be used for the relayed action
     */
    struct RelayedActionParams {
        address[] relayers;
        uint256 gasPriceLimit;
        uint256 totalCostLimit;
        address payingGasToken;
    }

    /**
     * @dev Token threshold action params
     * @param token Address of the token of the threshold
     * @param amount Amount of tokens of the threshold
     */
    struct TokenThresholdActionParams {
        address token;
        uint256 amount;
    }

    /**
     * @dev Time-locked action params
     * @param period Period in seconds to be set for the time lock
     */
    struct TimeLockedActionParams {
        uint256 period;
    }

    /**
     * @dev Withdrawal action params
     * @param recipient Address that will receive the funds from the withdraw action
     */
    struct WithdrawalActionParams {
        address recipient;
    }

    /**
     * @dev Internal function to create a new Smart Vault instance
     * @param registry Address of the registry to validate the Smart Vault implementation against
     * @param params Params to customize the Smart Vault to be deployed
     * @param wallet Address of the wallet to be set in the Smart Vault to be deployed
     * @param actions List of actions to be set in the Smart Vault to be deployed
     * @param transferPermissions Whether or not admin permissions on the Smart Vault should be transfer to the admin
     * right after creating the Smart Vault. Sometimes this is not desired if further customization might take in place.
     */
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

    /**
     * @dev Internal function to create a new Wallet instance
     * @param registry Address of the registry to validate the Wallet implementation against
     * @param params Params to customize the Wallet to be deployed
     * @param strategy Address of the strategy to be set in the Wallet to be deployed
     * @param priceOracle Address of the price oracle to be set in the Wallet to be deployed
     * @param transferPermissions Whether or not admin permissions on the Wallet should be transfer to the admin right
     * after creating the Wallet. Sometimes this is not desired if further customization might take in place.
     */
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
            bool isRegistered = registry.isRegistered(SWAP_CONNECTOR_NAMESPACE, params.swapConnector);
            require(isRegistered, 'SWAP_CONNECTOR_NOT_REGISTERED');
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

    /**
     * @dev Internal function to create a new Price Oracle instance
     * @param registry Address of the registry to validate the Price Oracle implementation against
     * @param params Params to customize the Price Oracle to be deployed
     * @param transferPermissions Whether or not admin permissions on the Price Oracle should be transfer to the admin
     * right after creating the Price Oracle. Sometimes this is not desired if further customization might take in place.
     */
    function _createPriceOracle(IRegistry registry, PriceOracleParams memory params, bool transferPermissions)
        internal
        returns (PriceOracle priceOracle)
    {
        // Clone requested price oracle implementation and initialize
        require(registry.isRegistered(PRICE_ORACLE_NAMESPACE, params.impl), 'PRICE_ORACLE_IMPL_NOT_REGISTERED');
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

    /**
     * @dev Internal function to set up a list of executors for a given action
     * @param action Action whose executors are being allowed
     * @param executors List of addresses to be allowed to call the given action
     * @param callSelector Selector of the function to allow the list of executors
     */
    function _setupActionExecutors(RelayedAction action, address[] memory executors, bytes4 callSelector) internal {
        for (uint256 i = 0; i < executors.length; i = i.uncheckedAdd(1)) {
            action.authorize(executors[i], callSelector);
        }
    }

    /**
     * @dev Internal function to set up a Relayed action
     * @param action Relayed action to be configured
     * @param admin Address that will be granted with admin rights for the deployed Relayed action
     * @param params Params to customize the Relayed action
     */
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

    /**
     * @dev Internal function to set up a Token Threshold action
     * @param action Token threshold action to be configured
     * @param admin Address that will be granted with admin rights for the deployed Token Threshold action
     * @param params Params to customize the Token Threshold action
     */
    function _setupTokenThresholdAction(
        TokenThresholdAction action,
        address admin,
        TokenThresholdActionParams memory params
    ) internal {
        action.authorize(admin, action.setThreshold.selector);
        action.authorize(address(this), action.setThreshold.selector);
        action.setThreshold(params.token, params.amount);
        action.unauthorize(address(this), action.setThreshold.selector);
    }

    /**
     * @dev Internal function to set up a Time-locked action
     * @param action Time-locked action to be configured
     * @param admin Address that will be granted with admin rights for the deployed Time-locked action
     * @param params Params to customize the Time-locked action
     */
    function _setupTimeLockedAction(TimeLockedAction action, address admin, TimeLockedActionParams memory params)
        internal
    {
        action.authorize(admin, action.setTimeLock.selector);
        action.authorize(address(this), action.setTimeLock.selector);
        action.setTimeLock(params.period);
        action.unauthorize(address(this), action.setTimeLock.selector);
    }

    /**
     * @dev Internal function to set up a Withdrawal action
     * @param action Relayed action to be configured
     * @param admin Address that will be granted with admin rights for the deployed Withdrawal action
     * @param params Params to customize the Withdrawal action
     */
    function _setupWithdrawalAction(WithdrawalAction action, address admin, WithdrawalActionParams memory params)
        internal
    {
        action.authorize(admin, action.setRecipient.selector);
        action.authorize(address(this), action.setRecipient.selector);
        action.setRecipient(params.recipient);
        action.unauthorize(address(this), action.setRecipient.selector);
    }

    /**
     * @dev Internal function to transfer admin rights from the deployer to another account
     * @param target Contract whose permissions are being transferred
     * @param to Address that will receive the admin rights
     */
    function _transferAdminPermissions(Authorizer target, address to) internal {
        _grantAdminPermissions(target, to);
        _revokeAdminPermissions(target, address(this));
    }

    /**
     * @dev Internal function to grant admin permissions to an account
     * @param target Contract whose permissions are being granted
     * @param to Address that will receive the admin rights
     */
    function _grantAdminPermissions(Authorizer target, address to) internal {
        target.authorize(to, target.authorize.selector);
        target.authorize(to, target.unauthorize.selector);
    }

    /**
     * @dev Internal function to revoke admin permissions from an account
     * @param target Contract whose permissions are being revoked
     * @param from Address that will be revoked
     */
    function _revokeAdminPermissions(Authorizer target, address from) internal {
        target.unauthorize(from, target.authorize.selector);
        target.unauthorize(from, target.unauthorize.selector);
    }

    /**
     * @dev Syntax sugar internal method to build an array of actions
     */
    function _actions(IAction action) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = address(action);
    }

    /**
     * @dev Syntax sugar internal method to build an array of actions
     */
    function _actions(IAction action1, IAction action2) internal pure returns (address[] memory arr) {
        arr = new address[](2);
        arr[0] = address(action1);
        arr[1] = address(action2);
    }

    /**
     * @dev Syntax sugar internal method to build an array of actions
     */
    function _actions(IAction action1, IAction action2, IAction action3) internal pure returns (address[] memory arr) {
        arr = new address[](3);
        arr[0] = address(action1);
        arr[1] = address(action2);
        arr[2] = address(action3);
    }
}
