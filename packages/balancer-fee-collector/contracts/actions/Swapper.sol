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

import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/config/TokensAcceptance.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/config/TokensThreshold.sol';

contract Swapper is BaseAction {
    using TokensThreshold for TokensThreshold.Config;
    using TokensAcceptance for TokensAcceptance.Config;

    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 50e3;

    TokensThreshold.Config private _tokensThreshold;
    TokensAcceptance.Config private _tokensAcceptance;
    SlippageTolerance.Config private _slippageTolerance;

    constructor(BaseAction.Params memory params) BaseAction(params) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function getTokenAmount(address token) public view returns (uint256) {
        return getSmartVaultBalance(token);
    }

    function call(address token, uint256 amount, uint256 slippage) external redeemGas(token) {
        _validate();
        _tokensAcceptance.validate(token);
        amount = _processAmount(token, amount);
        slippage = _processSlippage(token, slippage);

        smartVault.withdraw(token, amount, recipient, new bytes(0));
        emit Executed();
    }

    function _processAmount(address token, uint256 amount) internal view returns (uint256) {
        if (_tokensThreshold.isSet(token)) {
            _tokensThreshold.validate(token, amount, _getPrice);
            return amount;
        } else {
            require(amount == 0, 'CLAIMER_AMOUNT_IS_DYNAMIC');
            return getTokenAmount(token);
        }
    }

    function _processSlippage(address token, uint256 slippage) internal view returns (uint256) {
        if (_slippageTolerance.isSet(token)) {
            _slippageTolerance.validate(token, slippage);
            return slippage;
        } else {
            require(slippage == 0, 'SWAPPER_SLIPPAGE_IS_DYNAMIC');
            return getTokenSlippage(token);
        }
    }

    function _getPrice(address base, address quote) internal view returns (uint256) {
        return getSmartVault().getPrice(base, quote);
    }
}
