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
 * @dev Gas limit config interface
 */
interface IGasLimitConfig is IAuthorizer {
    /**
     * @dev Emitted every time the relayer limits are set
     */
    event GasLimitSet(uint256 gasPriceLimit, uint256 priorityFeeLimit);

    /**
     * @dev Tells the action gas limits
     */
    function getGasLimit() external view returns (uint256 gasPriceLimit, uint256 priorityFeeLimit);

    /**
     * @dev Sets gas limits
     * @param gasPriceLimit New gas price limit to be set
     * @param priorityFeeLimit New priority fee limit to be set
     */
    function setGasLimit(uint256 gasPriceLimit, uint256 priorityFeeLimit) external;
}
