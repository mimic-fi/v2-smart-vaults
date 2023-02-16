// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';

/**
 * @dev Library to operate transaction cost configs.
 * TODO
 */
library TransactionCost {
    using FixedPoint for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @dev Transaction cost config
     * @param _initialGas Internal variable used to allow a better developer experience to reimburse tx gas cost
     * @param txCostLimit Total transaction cost limit expressed in the native token
     * @param relayers List of allowed relayers
     */
    struct Config {
        uint256 _initialGas;
        uint256 txCostLimit;
        EnumerableSet.AddressSet relayers;
    }

    /**
     * @dev Tells if the requested relayer is compliant with the given transaction cost config
     * @param self Transaction cost config to be queried
     * @param relayer Address of the relayer to be checked
     */
    function hasRelayer(Config storage self, address relayer) internal view returns (bool) {
        return self.relayers.contains(relayer);
    }

    /**
     * @dev Tells if the requested transaction cost is compliant with the given transaction cost config
     * @param self Transaction cost config to be queried
     * @param totalCost Transaction cost in native token to be checked
     */
    function isTxCostValid(Config storage self, uint256 totalCost) internal view returns (bool) {
        return self.txCostLimit == 0 || totalCost <= self.txCostLimit;
    }

    /**
     * @dev Tells the list of allowed relayers for a transaction cost config
     * @param self Transaction cost config querying the relayers of
     */
    function getRelayers(Config storage self) internal view returns (address[] memory) {
        return self.relayers.values();
    }

    /**
     * @dev Tells the transaction cost limit of a transaction cost config
     * @param self Transaction cost config querying the transaction cost limit of
     */
    function getTxCostLimit(Config storage self) internal view returns (uint256) {
        return self.txCostLimit;
    }

    /**
     * @dev Sets the transaction cost limit and allowed relayers of a transaction cost config
     * @param self Transaction cost config to be updated
     * @param txCostLimit Transaction cost limit to be set
     * @param relayers List of allowed relayers to be set
     */
    function set(Config storage self, uint256 txCostLimit, address[] memory relayers) internal {
        setTxCostLimit(self, txCostLimit);
        setRelayers(self, relayers);
    }

    /**
     * @dev Sets the transaction cost limit of a transaction cost config
     * @param self Transaction cost config to be updated
     * @param txCostLimit Transaction cost limit to be set
     */
    function setTxCostLimit(Config storage self, uint256 txCostLimit) internal {
        self.txCostLimit = txCostLimit;
    }

    /**
     * @dev Sets the allowed relayers of a transaction cost config
     * @param self Transaction cost config to be updated
     * @param relayers List of allowed relayers to be set
     */
    function setRelayers(Config storage self, address[] memory relayers) internal {
        cleanRelayers(self);
        addRelayers(self, relayers);
    }

    /**
     * @dev Adds a list of allowed relayers to a transaction cost config
     * @param self Transaction cost config to be updated
     * @param relayers List of allowed relayers to be added
     */
    function addRelayers(Config storage self, address[] memory relayers) internal {
        for (uint256 i = 0; i < relayers.length; i++) addRelayer(self, relayers[i]);
    }

    /**
     * @dev Adds an allowed relayer to a transaction cost config
     * @param self Transaction cost config to be updated
     * @param relayer Address of the allowed relayer to be added, cannot be zero
     * @return True if the relayer was added to the list, that is if it was not present
     */
    function addRelayer(Config storage self, address relayer) internal returns (bool) {
        require(relayer != address(0), 'TRANSACTION_RELAYER_ZERO');
        return self.relayers.add(relayer);
    }

    /**
     * @dev Cleans the list of allowed relayers of a transaction cost config
     * @param self Transaction cost config to be updated
     */
    function cleanRelayers(Config storage self) internal {
        address[] memory relayers = getRelayers(self);
        for (uint256 i = 0; i < relayers.length; i++) removeRelayer(self, relayers[i]);
    }

    /**
     * @dev Removes an allowed relayer of a transaction cost config
     * @param self Transaction cost config to be updated
     * @param relayer Address of the allowed relayer to be removed
     * @return True if the value was removed from the set, that is if it was present
     */
    function removeRelayer(Config storage self, address relayer) internal returns (bool) {
        return self.relayers.remove(relayer);
    }

    /**
     * @dev Initializes relayed txs
     * @param self Transaction cost config to be initialized
     */
    function initRelayedTx(Config storage self) internal {
        if (!hasRelayer(self, msg.sender)) return;
        self._initialGas = gasleft();
    }

    /**
     * @dev Internal after call hook where tx cost is reimbursed. Only when the sender is marked as a relayer.
     * @param self Transaction cost config to be used in order to pay a relayed tx.
     * @param token Address of the token to be used to pay the tx cost
     * @param baseGas Base amount of gas to be covered for the gas cost redemption itself
     * @param getNativeTokenPrice View function to fetch the price of the native token quoted in the paying token
     * @param redeemGasCost Function that will be called to execute the gas redemption
     * @return Amount of tokens reimbursed to cover the tx cost
     */
    function payRelayedTx(
        Config storage self,
        address token,
        uint256 baseGas,
        function(address) internal view returns (uint256) getNativeTokenPrice,
        function(address, uint256) internal redeemGasCost
    ) internal returns (uint256) {
        if (!hasRelayer(self, msg.sender)) return 0;
        require(self._initialGas > 0, 'TRANSACTION_COST_NOT_INITIALIZED');

        uint256 totalGas = baseGas + self._initialGas - gasleft();
        uint256 totalCostNative = totalGas * tx.gasprice;
        require(isTxCostValid(self, totalCostNative), 'TRANSACTION_COST_FORBIDDEN');

        uint256 price = getNativeTokenPrice(token);
        uint256 totalCostToken = totalCostNative.mulDown(price);
        redeemGasCost(token, totalCostToken);

        self._initialGas = 0;
        return totalCostToken;
    }
}
