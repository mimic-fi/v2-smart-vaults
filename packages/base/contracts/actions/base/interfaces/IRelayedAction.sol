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
 * @dev Relayed action interface
 */
interface IRelayedAction is IAuthorizer {
    /**
     * @dev Emitted every time the tx cost limit is set
     */
    event TxCostLimitSet(uint256 txCostLimit);

    /**
     * @dev Emitted every time a relayer is added to the allow-list
     */
    event RelayerAllowed(address indexed relayer);

    /**
     * @dev Emitted every time a relayer is removed from the allow-list
     */
    event RelayerDisallowed(address indexed relayer);

    /**
     * @dev Tells the transaction cost limit
     */
    function getTxCostLimit() external view returns (uint256);

    /**
     * @dev Tells if a relayer is allowed or not
     * @param relayer Address of the relayer to be checked
     */
    function isRelayer(address relayer) external view returns (bool);

    /**
     * @dev Tells the list of allowed relayers
     */
    function getRelayers() external view returns (address[] memory);

    /**
     * @dev Sets the transaction cost limit
     * @param txCostLimit New transaction cost limit to be set
     */
    function setTxCostLimit(uint256 txCostLimit) external;

    /**
     * @dev Updates the list of allowed relayers
     * @param relayersToAdd List of relayers to be added to the allow-list
     * @param relayersToRemove List of relayers to be removed from the allow-list
     */
    function setRelayers(address[] memory relayersToAdd, address[] memory relayersToRemove) external;
}
