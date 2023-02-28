// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableMap.sol';

import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';

/**
 * @dev Action that can be define custom parameters to be used for any custom functionality
 */
abstract contract ParameterizedAction is Authorizer {
    using EnumerableMap for EnumerableMap.Bytes32ToBytes32Map;

    // List of custom parameters
    EnumerableMap.Bytes32ToBytes32Map private _params;

    /**
     * @dev Emitted every time an action custom param is set
     */
    event CustomParamSet(bytes32 key, bytes32 value);

    /**
     * @dev Emitted every time an action custom param is unset
     */
    event CustomParamUnset(bytes32 key);

    /**
     * @dev Creates a new parameterized action
     * @param keys List of custom param keys to be set
     * @param values List of custom param values to be set
     */
    constructor(bytes32[] memory keys, bytes32[] memory values) {
        _setCustomParams(keys, values);
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
     * @dev Tells if a custom param is set
     * @param key Custom param key
     */
    function hasCustomParam(bytes32 key) public view returns (bool) {
        return _params.contains(key);
    }

    /**
     * @dev Tells the custom parameter for a key
     * @param key Custom parameter key
     * @return exists Whether the custom param was set
     * @return value Value for the requested custom param key
     */
    function getCustomParam(bytes32 key) public view returns (bool exists, bytes32 value) {
        return _params.tryGet(key);
    }

    /**
     * @dev Tells the list of allowed relayers
     */
    function getCustomParams() public view returns (bytes32[] memory keys, bytes32[] memory values) {
        keys = new bytes32[](_params.length());
        values = new bytes32[](keys.length);
        for (uint256 i = 0; i < keys.length; i++) {
            (bytes32 key, bytes32 value) = _params.at(i);
            keys[i] = key;
            values[i] = value;
        }
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
