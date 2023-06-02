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

import './BaseBridger.sol';
import './interfaces/IAxelarBridger.sol';

contract AxelarBridger is IAxelarBridger, BaseBridger {
    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 30e3;

    /**
     * @dev Creates an Axelar bridger action
     */
    constructor(BridgerConfig memory bridgerConfig) BaseBridger(bridgerConfig) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Execution function
     */
    function call(address token, uint256 amount) external override actionCall(token, amount) {
        smartVault.bridge(
            uint8(IBridgeConnector.Source.Axelar),
            _getApplicableDestinationChain(token),
            token,
            amount,
            ISmartVault.BridgeLimit.MinAmountOut,
            amount,
            address(smartVault),
            new bytes(0)
        );
    }
}
