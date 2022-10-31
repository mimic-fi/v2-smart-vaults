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

import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v2-swap-connector/contracts/ISwapConnector.sol';

import './BaseClaimer.sol';

contract ERC20Claimer is BaseClaimer {
    using FixedPoint for uint256;

    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 22e3;

    address public swapSigner;
    uint256 public maxSlippage;

    event SwapSignerSet(address swapSigner);
    event MaxSlippageSet(uint256 maxSlippage);

    constructor(address admin, address registry) BaseClaimer(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setSwapSigner(address newSwapSigner) external auth {
        swapSigner = newSwapSigner;
        emit SwapSignerSet(newSwapSigner);
    }

    function setMaxSlippage(uint256 newMaxSlippage) external auth {
        require(newMaxSlippage <= FixedPoint.ONE, 'CLAIMER_SLIPPAGE_ABOVE_ONE');
        maxSlippage = newMaxSlippage;
        emit MaxSlippageSet(newMaxSlippage);
    }

    function call(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) external auth {
        (isRelayer[msg.sender] ? _relayedCall : _call)(
            tokenIn,
            amountIn,
            minAmountOut,
            expectedAmountOut,
            deadline,
            data,
            sig
        );
    }

    function _relayedCall(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) internal redeemGas {
        _call(tokenIn, amountIn, minAmountOut, expectedAmountOut, deadline, data, sig);
    }

    function _call(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) internal {
        address wrappedNativeToken = wallet.wrappedNativeToken();
        require(tokenIn != wrappedNativeToken && tokenIn != Denominations.NATIVE_TOKEN, 'ERC20_CLAIMER_INVALID_TOKEN');
        _validateThreshold(wrappedNativeToken, minAmountOut);
        _validateSlippage(minAmountOut, expectedAmountOut);
        _validateSignature(tokenIn, wrappedNativeToken, amountIn, minAmountOut, expectedAmountOut, deadline, data, sig);

        bytes memory claim = abi.encodeWithSelector(IFeeClaimer.withdrawSomeERC20.selector, tokenIn, amountIn, wallet);
        _claim(claim);
        wallet.swap(
            uint8(ISwapConnector.Source.ParaswapV5),
            tokenIn,
            wrappedNativeToken,
            amountIn,
            IWallet.SwapLimit.MinAmountOut,
            minAmountOut,
            data
        );
        emit Executed();
    }

    function _validateSlippage(uint256 minAmountOut, uint256 expectedAmountOut) internal view {
        require(minAmountOut <= expectedAmountOut, 'MIN_AMOUNT_GT_EXPECTED_AMOUNT');
        uint256 slippage = FixedPoint.ONE - minAmountOut.divUp(expectedAmountOut);
        require(slippage <= maxSlippage, 'CLAIMER_SLIPPAGE_TOO_BIG');
    }

    function _validateSignature(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) internal view {
        bytes32 message = _hash(tokenIn, tokenOut, amountIn, minAmountOut, expectedAmountOut, deadline, data);
        address signer = ECDSA.recover(ECDSA.toEthSignedMessageHash(message), sig);
        require(signer == swapSigner, 'INVALID_SWAP_SIGNATURE');
        require(block.timestamp <= deadline, 'SWAP_DEADLINE_EXPIRED');
    }

    function _hash(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expectedAmountOut,
        uint256 deadline,
        bytes memory data
    ) private pure returns (bytes32) {
        bool isBuy = false;
        return
            keccak256(
                abi.encodePacked(tokenIn, tokenOut, isBuy, amountIn, minAmountOut, expectedAmountOut, deadline, data)
            );
    }
}
