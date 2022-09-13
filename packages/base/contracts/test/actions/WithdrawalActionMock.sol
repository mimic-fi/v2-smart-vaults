// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/WithdrawalAction.sol';

contract WithdrawalActionMock is WithdrawalAction {
    constructor(address _admin, IWallet _wallet) BaseAction(_admin, _wallet) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function withdrawAll(address token) external {
        _withdraw(token);
    }

    function withdraw(address token, uint256 amount) external {
        _withdraw(token, amount);
    }
}
