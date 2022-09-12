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

import './BaseAction.sol';

abstract contract WithdrawalAction is BaseAction {
    address public recipient;

    event RecipientSet(address indexed recipient);

    function setRecipient(address newRecipient) external auth {
        recipient = newRecipient;
        emit RecipientSet(newRecipient);
    }

    function _withdraw(address token) internal {
        uint256 balance = IERC20(token).balanceOf(address(wallet));
        _withdraw(token, balance);
    }

    function _withdraw(address token, uint256 amount) internal {
        wallet.withdraw(token, amount, recipient, new bytes(0));
    }
}
