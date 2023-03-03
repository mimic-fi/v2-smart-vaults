// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../../actions/base/config/TimeLockConfig.sol';

contract TimeLockConfigMock is TimeLockConfig {
    constructor(uint256 initialDelay, uint256 delay) TimeLockConfig(initialDelay, delay) {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }

    function call() external {
        _validateTimeLock();
    }
}
