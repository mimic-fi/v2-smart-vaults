// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

/**
 * @dev Library to operate transaction gas configs.
 * It essentially allow to define either a gas price limit, a priority fee limit, or both.
 */
library TransactionGas {
    /**
     * @dev Transaction gas config
     * @param gasPriceLimit Gas price limit expressed in the native token
     * @param priorityFeeLimit Priority fee limit expressed in the native token
     */
    struct Config {
        uint256 gasPriceLimit;
        uint256 priorityFeeLimit;
    }

    /**
     * @dev Reverts if the tx fee does not comply with the given transaction gas config
     * @param self Transaction gas config to be evaluated
     */
    function validate(Config storage self) internal view {
        require(isValid(self), 'TRANSACTION_GAS_FORBIDDEN');
    }

    /**
     * @dev Tells if the tx fee data is compliant with the given transaction gas config
     * @param self Transaction gas config to be checked
     */
    function isValid(Config storage self) internal view returns (bool) {
        return isGasPriceValid(self) && isPriorityFeeValid(self);
    }

    /**
     * @dev Tells if the tx gas price is compliant with the given transaction gas config
     * @param self Transaction gas config to be checked
     */
    function isGasPriceValid(Config storage self) internal view returns (bool) {
        if (self.gasPriceLimit == 0) return true;
        return tx.gasprice <= self.gasPriceLimit;
    }

    /**
     * @dev Tells if the tx priority fee is compliant with the given transaction gas config
     * @param self Transaction gas config to be checked
     */
    function isPriorityFeeValid(Config storage self) internal view returns (bool) {
        if (self.priorityFeeLimit == 0) return true;
        return tx.gasprice - block.basefee <= self.priorityFeeLimit;
    }

    /**
     * @dev Tells the transaction gas config limits
     * @param self Transaction gas config to be queried
     */
    function get(Config storage self) internal view returns (uint256 gasPriceLimit, uint256 priorityFeeLimit) {
        return (self.gasPriceLimit, self.priorityFeeLimit);
    }

    /**
     * @dev Sets the transaction gas config limits
     * @param self Transaction gas config to be updated
     * @param gasPriceLimit New gas price limit to be set
     * @param priorityFeeLimit New priority fee limit to be set
     */
    function set(Config storage self, uint256 gasPriceLimit, uint256 priorityFeeLimit) internal {
        self.gasPriceLimit = gasPriceLimit;
        self.priorityFeeLimit = priorityFeeLimit;
    }
}
