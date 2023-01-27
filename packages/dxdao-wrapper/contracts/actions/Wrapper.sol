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
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/ReceiverAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/RelayedAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/TokenThresholdAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/WithdrawalAction.sol';

contract Wrapper is BaseAction, TokenThresholdAction, ReceiverAction, RelayedAction, WithdrawalAction {
    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 90e3;

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function getWrappableBalance() public view returns (uint256) {
        uint256 actionBalance = address(this).balance;
        uint256 smartVaultBalance = address(smartVault).balance;
        return actionBalance + smartVaultBalance;
    }

    function canExecute() external view returns (bool) {
        return _passesThreshold(Denominations.NATIVE_TOKEN, getWrappableBalance());
    }

    function call() external auth {
        _call();
        _withdraw(smartVault.wrappedNativeToken());
    }

    function _call() internal redeemGas(smartVault.wrappedNativeToken()) {
        uint256 actionBalance = address(this).balance;
        uint256 smartVaultBalance = address(smartVault).balance;
        uint256 totalBalance = actionBalance + smartVaultBalance;
        _validateThreshold(Denominations.NATIVE_TOKEN, totalBalance);

        if (actionBalance > 0) _transferToSmartVault(Denominations.NATIVE_TOKEN, actionBalance);
        smartVault.wrap(totalBalance, new bytes(0));
        emit Executed();
    }
}
