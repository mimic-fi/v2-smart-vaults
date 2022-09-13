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
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/RelayedAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/WithdrawalAction.sol';

contract Wrapper is RelayedAction, WithdrawalAction {
    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 0;

    constructor(address _admin, IWallet _wallet) BaseAction(_admin, _wallet) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function call() external auth {
        isRelayer[msg.sender] ? _relayedCall() : _call();
        _withdraw(wallet.wrappedNativeToken());
    }

    function _relayedCall() internal redeemGas {
        _call();
    }

    function _call() internal {
        address wrappedNativeToken = wallet.wrappedNativeToken();
        uint256 balance = IERC20(wrappedNativeToken).balanceOf(address(wallet));
        wallet.wrap(balance, new bytes(0));
    }
}
