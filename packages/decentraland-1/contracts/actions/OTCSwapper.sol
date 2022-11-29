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

import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v2-helpers/contracts/math/UncheckedMath.sol';

import './BaseSwapper.sol';

contract OTCSwapper is BaseSwapper {
    using FixedPoint for uint256;
    using UncheckedMath for uint256;

    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 50e3;

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function call(address tokenIn, address tokenOut, uint256 amountOut, uint256 slippage) external auth {
        (isRelayer[msg.sender] ? _relayedCall : _call)(tokenIn, tokenOut, amountOut, slippage);
    }

    function _relayedCall(address tokenIn, address tokenOut, uint256 amountOut, uint256 slippage) internal redeemGas {
        _call(tokenIn, tokenOut, amountOut, slippage);
    }

    function _call(address tokenIn, address tokenOut, uint256 amountOut, uint256 slippage) internal {
        uint256 price = smartVault.getPrice(tokenOut, tokenIn);
        uint256 amountIn = amountOut.mulDown(price);
        uint256 maxAmountIn = amountIn.mulDown(FixedPoint.ONE.uncheckedAdd(slippage));
        _validateSwap(tokenIn, tokenOut, maxAmountIn, slippage);

        smartVault.collect(tokenOut, msg.sender, amountOut, new bytes(0));
        smartVault.withdraw(tokenIn, maxAmountIn, msg.sender, new bytes(0));
        emit Executed();
    }
}
