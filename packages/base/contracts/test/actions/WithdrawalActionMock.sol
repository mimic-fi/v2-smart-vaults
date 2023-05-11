// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/WithdrawalAction.sol';

contract WithdrawalActionMock is WithdrawalAction {
    constructor(address smartVault, address admin, address registry) BaseAction(admin, registry) {
        _setSmartVault(smartVault);
    }

    function call(address token, uint256 amount) external {
        amount == 0 ? _withdraw(token) : _withdraw(token, amount);
    }
}
