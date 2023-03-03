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

pragma solidity >=0.8.0;

import '@mimic-fi/v2-helpers/contracts/auth/IAuthorizer.sol';

/**
 * @dev Custom params config interface
 */
interface ICustomParamsConfig is IAuthorizer {
    /**
     * @dev Emitted every time an action custom param is set
     */
    event CustomParamSet(bytes32 key, bytes32 value);

    /**
     * @dev Emitted every time an action custom param is unset
     */
    event CustomParamUnset(bytes32 key);

    /**
     * @dev Tells if a custom param is set
     * @param key Custom param key
     */
    function hasCustomParam(bytes32 key) external view returns (bool);

    /**
     * @dev Tells the custom parameter for a key
     * @param key Custom parameter key
     */
    function getCustomParam(bytes32 key) external view returns (bool exists, bytes32 value);

    /**
     * @dev Tells the list of allowed relayers
     */
    function getCustomParams() external view returns (bytes32[] memory keys, bytes32[] memory values);

    /**
     * @dev Sets a list of custom parameters
     * @param keys List of custom param keys to be set
     * @param values List of custom param values to be set
     */
    function setCustomParams(bytes32[] memory keys, bytes32[] memory values) external;

    /**
     * @dev Unsets a list of custom parameters
     * @param keys List of custom param keys to be unset
     */
    function unsetCustomParams(bytes32[] memory keys) external;
}
