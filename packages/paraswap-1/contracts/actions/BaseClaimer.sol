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
    using FixedPoint for uint256;

    address public feeClaimer;

    event FeeClaimerSet(address feeClaimer);

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setFeeClaimer(address newFeeClaimer) external auth {
        feeClaimer = newFeeClaimer;
        emit FeeClaimerSet(newFeeClaimer);
    }

    function _claim(bytes memory withdrawData) internal {
        bytes memory withdrawResponse = wallet.call(feeClaimer, withdrawData, 0, new bytes(0));
        require(abi.decode(withdrawResponse, (bool)), 'FEE_CLAIMER_WITHDRAW_FAILED');
    }
}
