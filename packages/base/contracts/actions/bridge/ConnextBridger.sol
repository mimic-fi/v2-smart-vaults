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

import '@mimic-fi/v2-bridge-connector/contracts/IBridgeConnector.sol';
import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v2-helpers/contracts/utils/EnumerableMap.sol';

import './BaseBridger.sol';
import './interfaces/IConnextBridger.sol';

contract ConnextBridger is IConnextBridger, BaseBridger {
    using FixedPoint for uint256;
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 32e3;

    // Default max fee pct
    uint256 private _defaultMaxFeePct;

    // Max fee percentage per token
    EnumerableMap.AddressToUintMap private _customMaxFeePcts;

    /**
     * @dev Custom max fee percentage config
     */
    struct CustomMaxFeePct {
        address token;
        uint256 maxFeePct;
    }

    /**
     * @dev Connext bridger action config
     */
    struct ConnextBridgerConfig {
        uint256 maxFeePct;
        CustomMaxFeePct[] customMaxFeePcts;
        BridgerConfig bridgerConfig;
    }

    /**
     * @dev Creates a Connext bridger action
     */
    constructor(ConnextBridgerConfig memory config) BaseBridger(config.bridgerConfig) {
        _setDefaultMaxFeePct(config.maxFeePct);

        for (uint256 i = 0; i < config.customMaxFeePcts.length; i++) {
            CustomMaxFeePct memory customMaxFeePct = config.customMaxFeePcts[i];
            _setCustomMaxFeePct(customMaxFeePct.token, customMaxFeePct.maxFeePct);
        }
    }

    /**
     * @dev Tells the default max fee pct
     */
    function getDefaultMaxFeePct() public view override returns (uint256) {
        return _defaultMaxFeePct;
    }

    /**
     * @dev Tells the max fee percentage defined for a specific token
     */
    function getCustomMaxFeePct(address token) public view override returns (bool, uint256) {
        return _customMaxFeePcts.tryGet(token);
    }

    /**
     * @dev Tells the list of custom max fee percentages set
     */
    function getCustomMaxFeePcts()
        external
        view
        override
        returns (address[] memory tokens, uint256[] memory maxFeePcts)
    {
        tokens = _customMaxFeePcts.keys();
        maxFeePcts = _customMaxFeePcts.values();
    }

    /**
     * @dev Sets the default max fee percentage
     * @param maxFeePct New default max fee percentage to be set
     */
    function setDefaultMaxFeePct(uint256 maxFeePct) external override auth {
        _setDefaultMaxFeePct(maxFeePct);
    }

    /**
     * @dev Sets a list of custom max fee percentages
     * @param tokens List of token addresses to set a max fee percentage for
     * @param maxFeePcts List of max fee percentages to be set for each token
     */
    function setCustomMaxFeePcts(address[] memory tokens, uint256[] memory maxFeePcts) external override auth {
        _setCustomMaxFeePcts(tokens, maxFeePcts);
    }

    /**
     * @dev Execution function
     */
    function call(address token, uint256 amount, uint256 fee) external override actionCall(token, amount) {
        _validateFee(token, amount, fee);

        smartVault.bridge(
            uint8(IBridgeConnector.Source.Connext),
            _getApplicableDestinationChain(token),
            token,
            amount,
            ISmartVault.BridgeLimit.MinAmountOut,
            amount - fee,
            address(smartVault),
            abi.encode(fee)
        );
    }

    /**
     * @dev Tells the max fee percentage that should be used for a token
     */
    function _getApplicableMaxFeePct(address token) internal view returns (uint256) {
        (bool exists, uint256 maxFeePct) = getCustomMaxFeePct(token);
        return exists ? maxFeePct : getDefaultMaxFeePct();
    }

    /**
     * @dev Tells if the requested fee is valid based on the max fee percentage configured for a token
     */
    function _isFeeValid(address token, uint256 amount, uint256 fee) internal view returns (bool) {
        return fee.divUp(amount) <= _getApplicableMaxFeePct(token);
    }

    /**
     * @dev Reverts if the requested fee is above the max fee percentage configured for a token
     */
    function _validateFee(address token, uint256 amount, uint256 fee) internal view {
        require(_isFeeValid(token, amount, fee), 'ACTION_FEE_TOO_HIGH');
    }

    /**
     * @dev Sets the default max fee percentage
     * @param maxFeePct Default max fee percentage to be set
     */
    function _setDefaultMaxFeePct(uint256 maxFeePct) internal {
        _defaultMaxFeePct = maxFeePct;
        emit DefaultMaxFeePctSet(maxFeePct);
    }

    /**
     * @dev Sets a list of custom max fee percentages for a list of tokens
     * @param tokens List of addresses of the tokens to set a max fee percentage for
     * @param maxFeePcts List of max fee percentages to be set per token
     */
    function _setCustomMaxFeePcts(address[] memory tokens, uint256[] memory maxFeePcts) internal {
        require(tokens.length == maxFeePcts.length, 'ACTION_MAX_FEE_PCTS_BAD_INPUT');
        for (uint256 i = 0; i < tokens.length; i++) {
            _setCustomMaxFeePct(tokens[i], maxFeePcts[i]);
        }
    }

    /**
     * @dev Sets a custom max fee percentage for a token
     * @param token Address of the token to set a custom max fee percentage for
     * @param maxFeePct Max fee percentage to be set for the given token
     */
    function _setCustomMaxFeePct(address token, uint256 maxFeePct) internal {
        maxFeePct == 0 ? _customMaxFeePcts.remove(token) : _customMaxFeePcts.set(token, maxFeePct);
        emit CustomMaxFeePctSet(token, maxFeePct);
    }
}
