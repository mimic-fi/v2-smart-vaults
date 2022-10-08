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

import './BaseClaimer.sol';

contract NativeClaimer is BaseClaimer {
    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 63e3;

    constructor(address admin, address registry) BaseClaimer(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function call(address token) external auth {
        (isRelayer[msg.sender] ? _relayedCall : _call)(token);
    }

    function _relayedCall(address token) internal redeemGas {
        _call(token);
    }

    function _call(address token) internal {
        address wrappedNativeToken = wallet.wrappedNativeToken();
        require(token == Denominations.NATIVE_TOKEN || token == wrappedNativeToken, 'NATIVE_CLAIMER_INVALID_TOKEN');
        uint256 balance = token == wrappedNativeToken ? IERC20(token).balanceOf(feeClaimer) : feeClaimer.balance;
        _validateThreshold(wrappedNativeToken, balance);

        bytes memory claimData = abi.encodeWithSelector(IFeeClaimer.withdrawAllERC20.selector, token, wallet);
        _claim(claimData);
        if (token != wrappedNativeToken) wallet.wrap(balance, new bytes(0));
        emit Executed();
    }
}
