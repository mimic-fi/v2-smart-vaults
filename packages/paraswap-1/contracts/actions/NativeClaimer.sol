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
    uint256 public constant override BASE_GAS = 60e3;

    constructor(address admin, address registry) BaseClaimer(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function canExecute(address token) public view override returns (bool) {
        return _isWrappedOrNativeToken(token) && _passesThreshold(token);
    }

    function call(address token) external auth {
        (isRelayer[msg.sender] ? _relayedCall : _call)(token);
    }

    function _relayedCall(address token) internal redeemGas {
        _call(token);
    }

    function _call(address token) internal {
        require(_isWrappedOrNativeToken(token), 'NATIVE_CLAIMER_INVALID_TOKEN');
        require(_passesThreshold(token), 'MIN_THRESHOLD_NOT_MET');

        _claim(abi.encodeWithSelector(IFeeClaimer.withdrawAllERC20.selector, token, smartVault));
        if (_isNativeToken(token)) smartVault.wrap(address(smartVault).balance, new bytes(0));
        emit Executed();
    }

    function _passesThreshold(address token) internal view returns (bool) {
        address wrappedNativeToken = smartVault.wrappedNativeToken();
        uint256 amountToClaim = IFeeClaimer(feeClaimer).getBalance(token, address(smartVault));
        uint256 totalBalance = amountToClaim + (_isNativeToken(token) ? address(smartVault).balance : 0);
        return _passesThreshold(wrappedNativeToken, totalBalance);
    }
}
