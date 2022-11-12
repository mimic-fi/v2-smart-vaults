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

import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/TokenThresholdAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/RelayedAction.sol';

import '../interfaces/IFeeClaimer.sol';

// solhint-disable avoid-low-level-calls

abstract contract BaseClaimer is BaseAction, TokenThresholdAction, RelayedAction {
    address public feeClaimer;

    event FeeClaimerSet(address indexed feeClaimer);

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setFeeClaimer(address newFeeClaimer) external auth {
        feeClaimer = newFeeClaimer;
        emit FeeClaimerSet(newFeeClaimer);
    }

    function claimableBalance(address token) public view returns (uint256) {
        return IFeeClaimer(feeClaimer).getBalance(token, address(smartVault));
    }

    function totalBalance(address token) external view returns (uint256) {
        uint256 feeClaimerBalance = claimableBalance(token);
        uint256 smartVaultBalance = (token == Denominations.NATIVE_TOKEN)
            ? address(smartVault).balance
            : IERC20(token).balanceOf(address(smartVault));
        return feeClaimerBalance + smartVaultBalance;
    }

    function _claim(bytes memory withdrawData) internal {
        bytes memory withdrawResponse = smartVault.call(feeClaimer, withdrawData, 0, new bytes(0));
        require(abi.decode(withdrawResponse, (bool)), 'FEE_CLAIMER_WITHDRAW_FAILED');
    }
}
