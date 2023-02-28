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

import '@openzeppelin/contracts/utils/structs/EnumerableMap.sol';

import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';

import './interfaces/IParameterizedAction.sol';

/**
 * @dev Action that can be define custom parameters to be used for any custom functionality
 */
abstract contract ParameterizedAction is IParameterizedAction, Authorizer {
    using EnumerableMap for EnumerableMap.Bytes32ToBytes32Map;

    // List of custom parameters
    EnumerableMap.Bytes32ToBytes32Map private _params;

    /**
     * @dev Creates a new parameterized action
     * @param keys List of custom param keys to be set
     * @param values List of custom param values to be set
     */
    constructor(bytes32[] memory keys, bytes32[] memory values) {
        _setCustomParams(keys, values);
    }

    /**
     * @dev Tells if a custom param is set
     * @param key Custom param key
     */
    function hasCustomParam(bytes32 key) public view override returns (bool) {
        return _params.contains(key);
    }

    /**
     * @dev Tells the custom parameter for a key
     * @param key Custom parameter key
     * @return exists Whether the custom param was set
     * @return value Value for the requested custom param key
     */
    function getCustomParam(bytes32 key) public view override returns (bool exists, bytes32 value) {
        return _params.tryGet(key);
    }

    /**
     * @dev Tells the list of allowed relayers
     */
    function getCustomParams() public view override returns (bytes32[] memory keys, bytes32[] memory values) {
        return (_getCustomParamsKeys(), _getCustomParamsValues());
    }

    /**
     * @dev Sets a list of custom parameters
     * @param keys List of custom param keys to be set
     * @param values List of custom param values to be set
     */
    function setCustomParams(bytes32[] memory keys, bytes32[] memory values) external auth {
        _setCustomParams(keys, values);
    }

    /**
     * @dev Unsets a list of custom parameters
     * @param keys List of custom param keys to be unset
     */
    function unsetCustomParams(bytes32[] memory keys) external auth {
        _unsetCustomParams(keys);
    }

    /**
     * @dev Tells the list of allowed relayers
     */
    function _getCustomParamsKeys() internal view returns (bytes32[] memory keys) {
        keys = new bytes32[](_params.length());
        for (uint256 i = 0; i < keys.length; i++) {
            (bytes32 key, ) = _params.at(i);
            keys[i] = key;
        }
    }

    /**
     * @dev Tells the list of allowed relayers
     */
    function _getCustomParamsValues() internal view returns (bytes32[] memory values) {
        values = new bytes32[](_params.length());
        for (uint256 i = 0; i < values.length; i++) {
            (, bytes32 value) = _params.at(i);
            values[i] = value;
        }
    }

    /**
     * @dev Sets a list of custom parameters
     * @param keys List of keys to be set. Cannot be zero.
     * @param values List of values to be set for each key
     */
    function _setCustomParams(bytes32[] memory keys, bytes32[] memory values) private {
        require(keys.length == values.length, 'CUSTOM_PARAMS_INPUT_INVALID_LEN');
        for (uint256 i = 0; i < keys.length; i++) {
            _params.set(keys[i], values[i]);
            emit CustomParamSet(keys[i], values[i]);
        }
    }

    /**
     * @dev Unsets a list of custom parameters. It ignores nonexistent keys.
     * @param keys List of keys to be unset
     */
    function _unsetCustomParams(bytes32[] memory keys) private {
        for (uint256 i = 0; i < keys.length; i++) {
            bytes32 key = keys[i];
            if (_params.remove(key)) emit CustomParamUnset(key);
        }
    }
}
