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

import '@mimic-fi/v2-swap-connector/contracts/ISwapConnector.sol';

import './BaseClaimer.sol';

contract ERC20Claimer is BaseClaimer {
    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 0;

    address public swapSigner;

    event SwapSignerSet(address swapSigner);

    constructor(address admin, address registry) BaseClaimer(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setSwapSigner(address newSwapSigner) external auth {
        swapSigner = newSwapSigner;
        emit SwapSignerSet(newSwapSigner);
    }

    function call(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) external auth {
        (isRelayer[msg.sender] ? _relayedCall : _call)(tokenIn, amountIn, minAmountOut, deadline, data, sig);
    }

    function _relayedCall(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) internal redeemGas {
        _call(tokenIn, amountIn, minAmountOut, deadline, data, sig);
    }

    function _call(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        bytes memory data,
        bytes memory sig
    ) internal {
        address wrappedNativeToken = wallet.wrappedNativeToken();
        require(tokenIn != wrappedNativeToken && tokenIn != Denominations.NATIVE_TOKEN, 'ERC20_CLAIMER_INVALID_TOKEN');
        _validateThreshold(wrappedNativeToken, minAmountOut);
        _validateSwapSignature(tokenIn, wrappedNativeToken, amountIn, minAmountOut, deadline, sig);

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

    function _validateSwapSignature(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        bytes memory sig
    ) internal view {
        bytes32 hash = keccak256(abi.encodePacked(tokenIn, tokenOut, amountIn, minAmountOut, deadline));
        address signer = ECDSA.recover(ECDSA.toEthSignedMessageHash(hash), sig);
        require(signer == swapSigner, 'INVALID_SWAP_SIGNATURE');
        require(block.timestamp <= deadline, 'SWAP_DEADLINE_EXPIRED');
    }
}
