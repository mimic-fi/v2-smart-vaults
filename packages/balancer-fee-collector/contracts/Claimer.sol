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

import '@mimic-fi/v2-helpers/contracts/utils/ERC20Helpers.sol';

import '@mimic-fi/v2-smart-vaults-base/contracts/actions/Action.sol';

import './interfaces/IProtocolFeeWithdrawer.sol';

contract Claimer is Action {
    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 65e3;

    // Address of the Balancer protocol fee withdrawer
    address public protocolFeeWithdrawer;

    /**
     * @dev Emitted every time the protocol fee withdrawer is set
     */
    event ProtocolFeeWithdrawerSet(address indexed protocolFeeWithdrawer);

    /**
     * @dev Claimer action config
     * @param protocolFeeWithdrawer Address of the Balancer protocol fee withdrawer
     * @param actionConfig Action config parameters
     */
    struct ClaimerConfig {
        address protocolFeeWithdrawer;
        ActionConfig actionConfig;
    }

    /**
     * @dev Creates a new claimer action
     * @param config Claimer config
     */
    constructor(ClaimerConfig memory config) Action(config.actionConfig) {
        protocolFeeWithdrawer = config.protocolFeeWithdrawer;
    }

    /**
     * @dev Sets the protocol fee withdrawer address
     * @param newProtocolFeeWithdrawer Address of the protocol fee withdrawer to be set
     */
    function setProtocolFeeWithdrawer(address newProtocolFeeWithdrawer) external auth {
        require(newProtocolFeeWithdrawer != address(0), 'ACTION_PROTOCOL_WITHDRAWER_ZERO');
        protocolFeeWithdrawer = newProtocolFeeWithdrawer;
        emit ProtocolFeeWithdrawerSet(newProtocolFeeWithdrawer);
    }

    /**
     * @dev Execution function
     */
    function call(address token, uint256 amount) external actionCall(token, amount) {
        require(token != address(0), 'ACTION_TOKEN_ZERO');
        require(amount != 0, 'ACTION_AMOUNT_ZERO');

        // solhint-disable-next-line avoid-low-level-calls
        smartVault.call(protocolFeeWithdrawer, _buildData(token, amount), 0, new bytes(0));
    }

    /**
     * @dev Builds a protocol withdrawer call data
     */
    function _buildData(address token, uint256 amount) internal view returns (bytes memory) {
        address[] memory tokens = new address[](1);
        tokens[0] = token;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        return
            abi.encodeWithSelector(
                IProtocolFeeWithdrawer.withdrawCollectedFees.selector,
                tokens,
                amounts,
                address(smartVault)
            );
    }
}
