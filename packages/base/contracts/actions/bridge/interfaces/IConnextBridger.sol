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

import './IBaseBridger.sol';

interface IConnextBridger is IBaseBridger {
    /**
     * @dev Emitted every time the default max fee percentage is set
     */
    event DefaultMaxFeePctSet(uint256 maxFeePct);

    /**
     * @dev Emitted every time a custom max fee percentage is set
     */
    event CustomMaxFeePctSet(address indexed token, uint256 maxFeePct);

    /**
     * @dev Tells the default max fee pct
     */
    function getDefaultMaxFeePct() external view returns (uint256);

    /**
     * @dev Tells the max fee percentage defined for a specific token
     */
    function getCustomMaxFeePct(address token) external view returns (bool, uint256);

    /**
     * @dev Tells the list of custom max fee percentages set
     */
    function getCustomMaxFeePcts() external view returns (address[] memory tokens, uint256[] memory maxFeePcts);

    /**
     * @dev Sets the default max fee percentage
     * @param maxFeePct New default max fee percentage to be set
     */
    function setDefaultMaxFeePct(uint256 maxFeePct) external;

    /**
     * @dev Sets a list of custom max fee percentages
     * @param tokens List of token addresses to set a max fee percentage for
     * @param maxFeePcts List of max fee percentages to be set for each token
     */
    function setCustomMaxFeePcts(address[] memory tokens, uint256[] memory maxFeePcts) external;

    /**
     * @dev Execution function
     */
    function call(address token, uint256 amount, uint256 fee) external;
}
