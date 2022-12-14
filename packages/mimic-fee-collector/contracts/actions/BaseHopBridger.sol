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

import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/TokenThresholdAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/ReceiverAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/RelayedAction.sol';

abstract contract BaseHopBridger is BaseAction, ReceiverAction, TokenThresholdAction {
    // Hop Exchange source number
    uint8 internal constant HOP_SOURCE = 0;

    // Chain IDs
    uint256 internal constant MAINNET_CHAIN_ID = 1;
    uint256 internal constant GOERLI_CHAIN_ID = 5;

    uint256 public maxDeadline;
    uint256 public maxSlippage;
    mapping (uint256 => bool) public isChainAllowed;

    event MaxDeadlineSet(uint256 maxDeadline);
    event MaxSlippageSet(uint256 maxSlippage);
    event AllowedChainSet(uint256 indexed chainId, bool allowed);

    function setMaxDeadline(uint256 newMaxDeadline) external auth {
        require(newMaxDeadline > 0, 'BRIDGER_MAX_DEADLINE_ZERO');
        maxDeadline = newMaxDeadline;
        emit MaxDeadlineSet(newMaxDeadline);
    }

    function setMaxSlippage(uint256 newMaxSlippage) external auth {
        require(newMaxSlippage <= FixedPoint.ONE, 'BRIDGER_SLIPPAGE_ABOVE_ONE');
        maxSlippage = newMaxSlippage;
        emit MaxSlippageSet(newMaxSlippage);
    }

    function setAllowedChain(uint256 chainId, bool allowed) external auth {
        require(chainId != 0, 'BRIDGER_CHAIN_ID_ZERO');
        require(chainId != block.chainid, 'BRIDGER_SAME_CHAIN_ID');
        isChainAllowed[chainId] = allowed;
        emit AllowedChainSet(chainId, allowed);
    }

    function _isL1(uint256 chainId) internal pure returns (bool) {
        return chainId == MAINNET_CHAIN_ID || chainId == GOERLI_CHAIN_ID;
    }
}
