// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../actions/base/TimeLockedAction.sol';

contract TimeLockedActionMock is TimeLockedAction {
    constructor(uint256 initialDelay, uint256 delay) TimeLockedAction(initialDelay, delay) {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }

    function call() external {
        _validateTimeLock();
    }
}
