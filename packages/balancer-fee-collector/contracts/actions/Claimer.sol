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

import '../interfaces/IProtocolFeeWithdrawer.sol';

contract Claimer is BaseAction {
    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 50e3;

    // Protocol fee withdrawer custom parameter key
    bytes32 public constant PROTOCOL_FEE_WITHDRAWER_KEY = keccak256('protocolFeeWithdrawer');

    constructor(BaseAction.Params memory params) BaseAction(params) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function getProtocolFeeWithdrawer() public returns (IProtocolFeeWithdrawer) {
        return IProtocolFeeWithdrawer(address(getCustomParam(PROTOCOL_FEE_WITHDRAWER_KEY)));
    }

    function getTokenAmountHint(address token) public view override returns (uint256[] memory) {
        revert('MISSING_TOKEN_AMOUNT_HINT');
    }

    function call(address token, uint256 amount) external redeemGas(token) {
        _validateAction();
        _validateToken(token);
        uint256 amount = _validateTokenAmount(token, amount);

        bytes memory data = _buildData(token, amount);
        bytes memory response = smartVault.call(getProtocolFeeWithdrawer(), data, 0, new bytes(0));
        require(abi.decode(response, (bool)), 'CLAIMER_WITHDRAW_FAILED');

        emit Executed();
    }

    function _processTokenAmount(address token, uint256 /* amount */) internal view override returns (uint256) {
        return IERC20(token).balanceOf(address(protocolFeeWithdrawer));
    }

    function _getPrice(address base, address quote) internal view returns (uint256) {
        return getSmartVault().getPrice(base, quote);
    }

    function _buildData(address token, uint256 amount) internal view returns (bytes memory) {
        address[] memory tokens = new address[](token);
        uint256[] memory amounts = new uint256[](amount);
        return abi.encodeWithSelector(
            IProtocolFeeWithdrawer.withdrawCollectedFees.selector,
            tokens,
            amounts,
            address(getSmartVault())
        );
    }
}
