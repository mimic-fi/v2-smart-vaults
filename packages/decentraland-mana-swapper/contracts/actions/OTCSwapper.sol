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
    uint256 public constant override BASE_GAS = 60e3;

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function canExecute(uint256 amountIn, uint256 minAmountOut) external view returns (bool) {
        uint256 amountOut = _calcAmountOut(amountIn);
        return
            tokenIn != address(0) &&
            tokenOut != address(0) &&
            amountOut >= minAmountOut &&
            _passesThreshold(tokenOut, amountOut);
    }

    function call(uint256 amountIn, uint256 minAmountOut) external auth {
        (isRelayer[msg.sender] ? _relayedCall : _call)(amountIn, minAmountOut);
    }

    function _relayedCall(uint256 amountIn, uint256 minAmountOut) internal redeemGas {
        _call(amountIn, minAmountOut);
    }

    function _call(uint256 amountIn, uint256 minAmountOut) internal {
        require(tokenIn != address(0), 'SWAPPER_TOKEN_IN_NOT_SET');
        require(tokenOut != address(0), 'SWAPPER_TOKEN_OUT_NOT_SET');

        uint256 amountOut = _calcAmountOut(amountIn);
        require(amountOut >= minAmountOut, 'SWAPPER_MIN_AMOUNT_OUT');
        _validateThreshold(tokenOut, amountOut);

        smartVault.collect(tokenIn, msg.sender, amountIn, new bytes(0));
        smartVault.withdraw(tokenOut, amountOut, msg.sender, new bytes(0));
        emit Executed();
    }

    function _calcAmountOut(uint256 amountIn) internal view returns (uint256) {
        uint256 price = smartVault.getPrice(tokenIn, tokenOut);
        uint256 amountOut = amountIn.mulDown(price);
        return amountOut.mulDown(FixedPoint.ONE.uncheckedAdd(maxSlippage));
    }
}
