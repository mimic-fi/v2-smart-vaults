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

import '@mimic-fi/v2-helpers/contracts/math/UncheckedMath.sol';
import '@mimic-fi/v2-registry/contracts/registry/IRegistry.sol';
import '@mimic-fi/v2-smart-vault/contracts/SmartVault.sol';
import '@mimic-fi/v2-smart-vault/contracts/ISmartVaultsFactory.sol';

import '../permissions/PermissionsManager.sol';

/**
 * @title DeployerHelpers
 * @dev Deployer library offering a bunch of set-up methods to deploy and customize smart vaults
 */
library DeployerLib {
    using UncheckedMath for uint256;

    // Namespace to use by this deployer to fetch ISmartVaultFactory implementations from the Mimic Registry
    bytes32 private constant SMART_VAULT_FACTORY_NAMESPACE = keccak256('SMART_VAULTS_FACTORY');

    // Namespace to use by this deployer to fetch ISmartVault implementations from the Mimic Registry
    bytes32 private constant SMART_VAULT_NAMESPACE = keccak256('SMART_VAULT');

    // Namespace to use by this deployer to fetch IStrategy implementations from the Mimic Registry
    bytes32 private constant STRATEGY_NAMESPACE = keccak256('STRATEGY');

    // Namespace to use by this deployer to fetch IPriceOracle implementations from the Mimic Registry
    bytes32 private constant PRICE_ORACLE_NAMESPACE = keccak256('PRICE_ORACLE');

    // Namespace to use by this deployer to fetch ISwapConnector implementations from the Mimic Registry
    bytes32 private constant SWAP_CONNECTOR_NAMESPACE = keccak256('SWAP_CONNECTOR');

    // Namespace to use by this deployer to fetch IBridgeConnector implementations from the Mimic Registry
    bytes32 private constant BRIDGE_CONNECTOR_NAMESPACE = keccak256('BRIDGE_CONNECTOR');

    /**
     * @dev Smart vault params
     * @param salt Salt bytes to derivate the address of the new Smart Vault instance
     * @param impl Address of the Smart Vault implementation to be used
     * @param factory Address of the factory that will be used to deploy an instance of the Smart Vault
     * @param strategies List of strategies to be allowed for the Smart Vault
     * @param bridgeConnector Optional Bridge Connector to set for the Smart Vault
     * @param swapConnector Optional Swap Connector to set for the Smart Vault
     * @param priceOracle Optional Price Oracle to set for the Smart Vault
     * @param priceFeedParams List of price feeds to be set for the Smart Vault
     * @param feeCollector Address to be set as the fee collector
     * @param feeCollectorAdmin Address that will be allowed to change the fee collector
     * @param swapFee Swap fee params
     * @param bridgeFee Bridge fee params
     * @param withdrawFee Withdraw fee params
     * @param performanceFee Performance fee params
     */
    struct SmartVaultParams {
        bytes32 salt;
        address impl;
        address factory;
        address[] strategies;
        address bridgeConnector;
        address swapConnector;
        address priceOracle;
        PriceFeedParams[] priceFeedParams;
        address feeCollector;
        address feeCollectorAdmin;
        SmartVaultFeeParams swapFee;
        SmartVaultFeeParams bridgeFee;
        SmartVaultFeeParams withdrawFee;
        SmartVaultFeeParams performanceFee;
    }

    /**
     * @dev Smart Vault price feed params
     * @param base Base token of the price feed
     * @param quote Quote token of the price feed
     * @param feed Address of the price feed
     */
    struct PriceFeedParams {
        address base;
        address quote;
        address feed;
    }

    /**
     * @dev Smart Vault fee configuration parameters
     * @param pct Percentage expressed using 16 decimals (1e18 = 100%)
     * @param cap Maximum amount of fees to be charged per period
     * @param token Address of the token to express the cap amount
     * @param period Period length in seconds
     */
    struct SmartVaultFeeParams {
        uint256 pct;
        uint256 cap;
        address token;
        uint256 period;
    }

    /**
     * @dev Creates a new Permissions Manager instance
     */
    function createPermissionsManager(address admin) external returns (PermissionsManager) {
        return new PermissionsManager(admin);
    }

    /**
     * @dev Set up permissions for the Smart Vault and Permissions Manager
     * @param manager Permissions manager that will control the Smart Vault
     * @param smartVault Address of the Smart Vault to be configured
     * @param owners Addresses that will be able to call the permission manager
     */
    function setUpPermissions(PermissionsManager manager, ISmartVault smartVault, address[] memory owners) external {
        // Authorize Permissions Manager on Smart Vault
        smartVault.authorize(address(manager), smartVault.authorize.selector);
        smartVault.authorize(address(manager), smartVault.unauthorize.selector);

        // Unauthorize deployer on Smart Vault
        smartVault.unauthorize(address(this), smartVault.authorize.selector);
        smartVault.unauthorize(address(this), smartVault.unauthorize.selector);

        // Build requests to authorize owners to execute on Permissions Manager and unauthorize deployer
        PermissionChangeRequest memory request;
        request.target = manager;
        request.changes = new PermissionChange[](owners.length + 1);
        request.changes[owners.length] = PermissionChange(false, Permission(manager.execute.selector, address(this)));
        for (uint256 i = 0; i < owners.length; i = i.uncheckedAdd(1)) {
            request.changes[i] = PermissionChange(true, Permission(manager.execute.selector, owners[i]));
        }

        // Execute permissions manager requests
        PermissionChangeRequest[] memory requests = new PermissionChangeRequest[](1);
        requests[0] = request;
        manager.execute(requests);
    }

    /**
     * @dev Deploys a new smart vault
     * @param registry Address of the Mimic Registry to validate the implementation addresses
     * @param params Deployment params to set up a smart vault
     */
    function deploySmartVault(IRegistry registry, SmartVaultParams memory params)
        external
        returns (ISmartVault smartVault)
    {
        require(params.salt != bytes32(0), 'SMART_VAULT_DEPLOY_SALT_ZERO');
        require(params.impl != address(0), 'SMART_VAULT_IMPL_ZERO');
        require(params.factory != address(0), 'SMART_VAULT_FACTORY_ZERO');
        require(params.feeCollector != address(0), 'SMART_VAULT_FEE_COLLECTOR_ZERO');
        require(params.feeCollectorAdmin != address(0), 'SMART_VAULT_FEE_ADMIN_ZERO');

        // Validate factory implementation
        require(registry.isActive(SMART_VAULT_FACTORY_NAMESPACE, params.factory), 'BAD_SMART_VAULT_FACTORY_IMPL');
        ISmartVaultsFactory factory = ISmartVaultsFactory(params.factory);

        // Clone requested Smart Vault implementation and initialize
        bytes memory initializeData = abi.encodeWithSelector(SmartVault.initialize.selector, address(this));
        bytes32 senderSalt = keccak256(abi.encodePacked(msg.sender, params.salt));
        smartVault = ISmartVault(payable(factory.create(senderSalt, params.impl, initializeData)));

        // Set price feeds if any
        if (params.priceFeedParams.length > 0) {
            smartVault.authorize(address(this), smartVault.setPriceFeed.selector);
            for (uint256 i = 0; i < params.priceFeedParams.length; i = i.uncheckedAdd(1)) {
                PriceFeedParams memory feedParams = params.priceFeedParams[i];
                smartVault.setPriceFeed(feedParams.base, feedParams.quote, feedParams.feed);
            }
            smartVault.unauthorize(address(this), smartVault.setPriceFeed.selector);
        }

        // Set price oracle if given
        if (params.priceOracle != address(0)) {
            require(registry.isActive(PRICE_ORACLE_NAMESPACE, params.priceOracle), 'BAD_PRICE_ORACLE_DEPENDENCY');
            smartVault.authorize(address(this), smartVault.setPriceOracle.selector);
            smartVault.setPriceOracle(params.priceOracle);
            smartVault.unauthorize(address(this), smartVault.setPriceOracle.selector);
        }

        // Set strategies if any
        if (params.strategies.length > 0) {
            smartVault.authorize(address(this), smartVault.setStrategy.selector);
            for (uint256 i = 0; i < params.strategies.length; i = i.uncheckedAdd(1)) {
                require(registry.isActive(STRATEGY_NAMESPACE, params.strategies[i]), 'BAD_STRATEGY_DEPENDENCY');
                smartVault.setStrategy(params.strategies[i], true);
            }
            smartVault.unauthorize(address(this), smartVault.setStrategy.selector);
        }

        // Set swap connector if given
        if (params.swapConnector != address(0)) {
            require(registry.isActive(SWAP_CONNECTOR_NAMESPACE, params.swapConnector), 'BAD_SWAP_CONNECTOR_DEPENDENCY');
            smartVault.authorize(address(this), smartVault.setSwapConnector.selector);
            smartVault.setSwapConnector(params.swapConnector);
            smartVault.unauthorize(address(this), smartVault.setSwapConnector.selector);
        }

        // Set bridge connector if given
        if (params.bridgeConnector != address(0)) {
            bool isActive = registry.isActive(BRIDGE_CONNECTOR_NAMESPACE, params.bridgeConnector);
            require(isActive, 'BAD_BRIDGE_CONNECTOR_DEPENDENCY');
            smartVault.authorize(address(this), smartVault.setBridgeConnector.selector);
            smartVault.setBridgeConnector(params.bridgeConnector);
            smartVault.unauthorize(address(this), smartVault.setBridgeConnector.selector);
        }

        // If no fee collector is given, make sure no fee amounts are requested too
        smartVault.authorize(params.feeCollectorAdmin, smartVault.setFeeCollector.selector);
        if (params.feeCollector != address(0)) {
            smartVault.authorize(address(this), smartVault.setFeeCollector.selector);
            smartVault.setFeeCollector(params.feeCollector);
            smartVault.unauthorize(address(this), smartVault.setFeeCollector.selector);
        } else {
            bool noFees = params.withdrawFee.pct == 0 &&
                params.swapFee.pct == 0 &&
                params.bridgeFee.pct == 0 &&
                params.performanceFee.pct == 0;
            require(noFees, 'SMART_VAULT_FEES_NO_COLLECTOR');
        }

        // Set withdraw fee if not zero
        SmartVaultFeeParams memory withdrawFee = params.withdrawFee;
        if (withdrawFee.pct != 0) {
            smartVault.authorize(address(this), smartVault.setWithdrawFee.selector);
            smartVault.setWithdrawFee(withdrawFee.pct, withdrawFee.cap, withdrawFee.token, withdrawFee.period);
            smartVault.unauthorize(address(this), smartVault.setWithdrawFee.selector);
        }

        // Set swap fee if not zero
        SmartVaultFeeParams memory swapFee = params.swapFee;
        if (swapFee.pct != 0) {
            smartVault.authorize(address(this), smartVault.setSwapFee.selector);
            smartVault.setSwapFee(swapFee.pct, swapFee.cap, swapFee.token, swapFee.period);
            smartVault.unauthorize(address(this), smartVault.setSwapFee.selector);
        }

        // Set bridge fee if not zero
        SmartVaultFeeParams memory bridgeFee = params.bridgeFee;
        if (bridgeFee.pct != 0) {
            smartVault.authorize(address(this), smartVault.setBridgeFee.selector);
            smartVault.setBridgeFee(bridgeFee.pct, bridgeFee.cap, bridgeFee.token, bridgeFee.period);
            smartVault.unauthorize(address(this), smartVault.setBridgeFee.selector);
        }

        // Set performance fee if not zero
        SmartVaultFeeParams memory perfFee = params.performanceFee;
        if (perfFee.pct != 0) {
            smartVault.authorize(address(this), smartVault.setPerformanceFee.selector);
            smartVault.setPerformanceFee(perfFee.pct, perfFee.cap, perfFee.token, perfFee.period);
            smartVault.unauthorize(address(this), smartVault.setPerformanceFee.selector);
        }
    }
}
