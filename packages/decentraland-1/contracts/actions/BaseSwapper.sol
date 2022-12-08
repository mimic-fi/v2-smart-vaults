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
    uint256 public maxSlippage;
    mapping (address => bool) public isTokenInAllowed;
    mapping (address => bool) public isTokenOutAllowed;

    event MaxSlippageSet(uint256 maxSlippage);
    event TokenInSet(address indexed tokenIn, bool allowed);
    event TokenOutSet(address indexed tokenOut, bool allowed);

    function setMaxSlippage(uint256 newMaxSlippage) external auth {
        require(newMaxSlippage <= FixedPoint.ONE, 'SWAPPER_SLIPPAGE_ABOVE_ONE');
        maxSlippage = newMaxSlippage;
        emit MaxSlippageSet(newMaxSlippage);
    }

    function setTokenIn(address token, bool allowed) external auth {
        isTokenInAllowed[token] = allowed;
        emit TokenInSet(token, allowed);
    }

    function setTokenOut(address token, bool allowed) external auth {
        isTokenOutAllowed[token] = allowed;
        emit TokenOutSet(token, allowed);
    }

    function _validateSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage) internal view {
        require(slippage <= maxSlippage, 'SWAPPER_SLIPPAGE_ABOVE_MAX');
        require(isTokenInAllowed[tokenIn], 'SWAPPER_TOKEN_IN_NOT_ALLOWED');
        require(isTokenOutAllowed[tokenOut], 'SWAPPER_TOKEN_OUT_NOT_ALLOWED');
        _validateThreshold(tokenIn, amountIn);
    }

    function _canExecute(address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage)
        internal
        view
        returns (bool)
    {
        return
            slippage <= maxSlippage &&
            isTokenInAllowed[tokenIn] &&
            isTokenOutAllowed[tokenOut] &&
            _passesThreshold(tokenIn, amountIn);
    }
}
