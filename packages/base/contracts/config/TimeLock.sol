// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

/**
 * @dev Library to operate time-lock configs.
 * It allows users to make sure a certain period of time has passed between two bumps.
 */
library TimeLock {
    /**
     * @dev Time lock config
     * @param delay Period in seconds that must be waited between two bumps
     * @param nextResetTime Future timestamp in which the config can be bumped again
     */
    struct Config {
        uint256 delay;
        uint256 nextResetTime;
    }

    /**
     * @dev Reverts if the given time-lock is not expired, otherwise it bumps it based on its delay
     * @param self Time-lock config to be evaluated
     */
    function validate(Config storage self) internal {
        require(isValid(self), 'TIME_LOCK_FORBIDDEN');
        if (isSet(self)) self.nextResetTime = block.timestamp + self.delay;
    }

    /**
     * @dev Tells if a time-lock is expired or not, it must be set to be considered expired
     * @param self Time-lock config to be checked
     */
    function isValid(Config storage self) internal view returns (bool) {
        return !isSet(self) || block.timestamp >= self.nextResetTime;
    }

    /**
     * @dev Tells if a time-lock is set
     * @param self Time-lock config to be checked
     */
    function isSet(Config storage self) internal view returns (bool) {
        return self.delay > 0 || self.nextResetTime > 0;
    }

    /**
     * @dev Tells the information related to a time-lock
     * @param self Time-lock config to be queried
     */
    function getTimeLock(Config storage self) internal view returns (uint256 delay, uint256 nextResetTime) {
        return (self.delay, self.nextResetTime);
    }

    /**
     * @dev Initializes a time-lock config
     * @param self Time-lock config to be updated
     * @param initialDelay Initial delay to be set
     * @param delay New delay to be set
     */
    function initialize(Config storage self, uint256 initialDelay, uint256 delay) internal {
        setInitialDelay(self, initialDelay);
        setDelay(self, delay);
    }

    /**
     * @dev Updates the delay of a time-lock config
     * @param self Time-lock config to be updated
     * @param delay New delay to be set
     */
    function setDelay(Config storage self, uint256 delay) internal {
        self.delay = delay;
    }

    /**
     * @dev Sets the initial delay for a time-lock, it must have not been set before
     * @param self Time-lock config to be updated
     * @param delay Initial delay to be set
     */
    function setInitialDelay(Config storage self, uint256 delay) private {
        require(!isSet(self), 'TIME_LOCK_ALREADY_INITIALIZED');
        self.nextResetTime = block.timestamp + delay;
    }
}
