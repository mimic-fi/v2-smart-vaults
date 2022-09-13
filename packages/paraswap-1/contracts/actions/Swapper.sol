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

import '@mimic-fi/v2-wallet/contracts/IWallet.sol';
import '@mimic-fi/v2-swap-connector/contracts/ISwapConnector.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/RelayedAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/WithdrawalAction.sol';

contract Swapper is BaseAction, RelayedAction, WithdrawalAction {
    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 0;

    struct CollectParams {
        address token;
        address from;
        uint256 amount;
    }

    struct SwapParams {
        bytes data;
        uint256 amount;
        uint256 slippage;
    }

    uint256 public maxSlippage;

    event MaxSlippageSet(uint256 maxSlippage);

    constructor(address _admin, IWallet _wallet) BaseAction(_admin, _wallet) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setMaxSlippage(uint256 newMaxSlippage) external auth {
        maxSlippage = newMaxSlippage;
        emit MaxSlippageSet(newMaxSlippage);
    }

    function call(CollectParams memory collect, SwapParams memory swap) external auth {
        (isRelayer[msg.sender] ? _relayedCall : _call)(collect, swap);
        _withdraw(wallet.wrappedNativeToken());
    }

    function _relayedCall(CollectParams memory collect, SwapParams memory swap) internal redeemGas {
        _call(collect, swap);
    }

    function _call(CollectParams memory collect, SwapParams memory swap) internal {
        require(swap.slippage <= maxSlippage, 'SWAP_SLIPPAGE_TOO_BIG');
        wallet.collect(collect.token, collect.from, collect.amount, new bytes(0));
        address wrappedNativeToken = wallet.wrappedNativeToken();
        wallet.swap(
            ISwapConnector.Source.UniswapV2,
            collect.token,
            wrappedNativeToken,
            swap.amount,
            IWallet.SwapLimit.Slippage,
            swap.slippage,
            swap.data
        );
        uint256 unwrapBalance = IERC20(wrappedNativeToken).balanceOf(address(wallet));
        wallet.unwrap(unwrapBalance, new bytes(0));
    }
}
