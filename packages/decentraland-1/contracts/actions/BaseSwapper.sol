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

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '@mimic-fi/v2-helpers/contracts/utils/Denominations.sol';
import '@mimic-fi/v2-swap-connector/contracts/ISwapConnector.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/TokenThresholdAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/RelayedAction.sol';

abstract contract BaseSwapper is BaseAction, TokenThresholdAction, RelayedAction {
    address public tokenIn;
    address public tokenOut;
    uint256 public maxSlippage;

    event TokenInSet(address indexed tokenIn);
    event TokenOutSet(address indexed tokenOut);
    event MaxSlippageSet(uint256 maxSlippage);

    function setTokenIn(address newTokenIn) external auth {
        require(newTokenIn != tokenOut, 'SWAPPER_TOKEN_IN_EQ_TOKEN_OUT');
        tokenIn = newTokenIn;
        emit TokenInSet(newTokenIn);
    }

    function setTokenOut(address newTokenOut) external auth {
        require(newTokenOut != tokenIn, 'SWAPPER_TOKEN_OUT_EQ_TOKEN_IN');
        tokenOut = newTokenOut;
        emit TokenOutSet(newTokenOut);
    }

    function setMaxSlippage(uint256 newMaxSlippage) external auth {
        require(newMaxSlippage <= FixedPoint.ONE, 'SWAPPER_SLIPPAGE_ABOVE_ONE');
        maxSlippage = newMaxSlippage;
        emit MaxSlippageSet(newMaxSlippage);
    }

    function _validateSwap(uint256 amount, uint256 slippage) internal view {
        require(slippage <= maxSlippage, 'SWAPPER_SLIPPAGE_ABOVE_MAX');
        _validateThreshold(tokenIn, amount);
    }
}
