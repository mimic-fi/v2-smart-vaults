// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../config/TimeLock.sol';

contract TimeLockMock {
    using TimeLock for TimeLock.Config;

    TimeLock.Config internal timeLock;

    function validate() external {
        return timeLock.validate();
    }

    function isValid() external view returns (bool) {
        return timeLock.isValid();
    }

    function isSet() external view returns (bool) {
        return timeLock.isSet();
    }

    function getTimeLock() external view returns (uint256 delay, uint256 nextResetTime) {
        return timeLock.getTimeLock();
    }

    function initialize(uint256 initialDelay, uint256 delay) external {
        timeLock.initialize(initialDelay, delay);
    }

    function setDelay(uint256 delay) external {
        return timeLock.setDelay(delay);
    }
}
