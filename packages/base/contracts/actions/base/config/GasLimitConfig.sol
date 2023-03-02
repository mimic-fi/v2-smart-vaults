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

pragma solidity ^0.8.3;

import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';

import './interfaces/IGasLimitConfig.sol';

/**
 * @dev Gas limit config for actions. It allows limiting either the gas price, the priority fee, or both.
 */
abstract contract GasLimitConfig is IGasLimitConfig, Authorizer {
    // Gas price limit expressed in the native token
    uint256 private _gasPriceLimit;

    // Priority fee limit expressed in the native token
    uint256 private _priorityFeeLimit;

    /**
     * @dev Creates a new gas limit config
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
    function getGasLimit() public view override returns (uint256 gasPriceLimit, uint256 priorityFeeLimit) {
        return (_gasPriceLimit, _priorityFeeLimit);
    }

    /**
     * @dev Reverts if the tx fee does not comply with the configured gas limits
     */
    function _validateGasLimit() internal view {
        require(_isGasLimitValid(), 'GAS_PRICE_LIMIT_EXCEEDED');
    }

    /**
     * @dev Tells if the tx fee data is compliant with the configured gas limits
     */
    function _isGasLimitValid() internal view returns (bool) {
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
