// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';

/**
 * @dev Action that can be limited due to gas: gas price limit, a priority fee limit, or both.
 */
abstract contract GasLimitedAction is Authorizer {
    // Gas price limit expressed in the native token
    uint256 private _gasPriceLimit;

    // Priority fee limit expressed in the native token
    uint256 private _priorityFeeLimit;

    /**
     * @dev Emitted every time the relayer limits are set
     */
    event GasLimitSet(uint256 gasPriceLimit, uint256 priorityFeeLimit);

    /**
     * @dev Creates a new gas limited action
     * @param gasPriceLimit Gas price limit expressed in the native token
     * @param priorityFeeLimit Priority fee limit expressed in the native token
     */
    constructor(uint256 gasPriceLimit, uint256 priorityFeeLimit) {
        _setGasLimit(gasPriceLimit, priorityFeeLimit);
    }

    /**
     * @dev Sets gas limits
     * @param gasPriceLimit New gas price limit to be set
     * @param priorityFeeLimit New priority fee limit to be set
     */
    function setGasLimit(uint256 gasPriceLimit, uint256 priorityFeeLimit) external auth {
        _setGasLimit(gasPriceLimit, priorityFeeLimit);
    }

    /**
     * @dev Tells the action gas limits
     */
    function getGasLimit() public view returns (uint256 gasPriceLimit, uint256 priorityFeeLimit) {
        return (_gasPriceLimit, _priorityFeeLimit);
    }

    /**
     * @dev Reverts if the tx fee does not comply with the configured gas limits
     */
    function _validate() internal virtual {
        require(_isValid(), 'GAS_PRICE_LIMIT_EXCEEDED');
    }

    /**
     * @dev Tells if the tx fee data is compliant with the configured gas limits
     */
    function _isValid() internal view virtual returns (bool) {
        return _isGasPriceValid() && _isPriorityFeeValid();
    }

    /**
     * @dev Tells if the tx gas price is compliant with the configured gas price limit
     */
    function _isGasPriceValid() internal view returns (bool) {
        if (_gasPriceLimit == 0) return true;
        return tx.gasprice <= _gasPriceLimit;
    }

    /**
     * @dev Tells if the tx priority fee is compliant with the configured priority fee limit
     */
    function _isPriorityFeeValid() internal view returns (bool) {
        if (_priorityFeeLimit == 0) return true;
        return tx.gasprice - block.basefee <= _priorityFeeLimit;
    }

    /**
     * @dev Private function to set the gas limits
     * @param gasPriceLimit New gas price limit to be set
     * @param priorityFeeLimit New priority fee limit to be set
     */
    function _setGasLimit(uint256 gasPriceLimit, uint256 priorityFeeLimit) private {
        _gasPriceLimit = gasPriceLimit;
        _priorityFeeLimit = priorityFeeLimit;
        emit GasLimitSet(gasPriceLimit, priorityFeeLimit);
    }
}
