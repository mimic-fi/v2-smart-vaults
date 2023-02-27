// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';

/**
 * @dev Action that can be limited using time locks
 */
abstract contract TimeLockedAction is Authorizer {
    // Period in seconds that must be waited between two bumps
    uint256 private _delay;

    // Future timestamp in which the time-lock can be bumped again
    uint256 private _expiresAt;

    /**
     * @dev Emitted every time a new time-lock delay is set
     */
    event TimeLockDelaySet(uint256 delay);

    /**
     * @dev Emitted every time a new expiration date is set
     */
    event TimeLockExpireSet(uint256 expiresAt);

    /**
     * @dev Creates a new time-locked action
     * @param initialDelay Initial delay to be set for the time-lock
     * @param delay Time-lock delay to be used after the initial delay has passed
     */
    constructor(uint256 initialDelay, uint256 delay) {
        _increaseExpireDate(initialDelay);
        _setTimeLockDelay(delay);
    }

    /**
     * @dev Sets the time-lock delay
     * @param delay New delay to be set
     */
    function setTimeLockDelay(uint256 delay) external auth {
        _setTimeLockDelay(delay);
    }

    /**
     * @dev Tells the time-lock information
     */
    function getTimeLock() public view returns (uint256 delay, uint256 expiresAt) {
        return (_delay, _expiresAt);
    }

    /**
     * @dev Reverts if the given time-lock is not expired, otherwise it bumps it based on its delay
     */
    function _validate() internal virtual {
        require(_isValid(), 'TIME_LOCK_NOT_EXPIRED');
        _increaseExpireDate(_delay);
    }

    /**
     * @dev Tells if a time-lock is expired or not
     */
    function _isValid() internal view virtual returns (bool) {
        return block.timestamp >= _expiresAt;
    }

    /**
     * @dev Sets the time-lock delay
     * @param delay New delay to be set
     */
    function _setTimeLockDelay(uint256 delay) private {
        _delay = delay;
        emit TimeLockDelaySet(delay);
    }

    /**
     * @dev Increases the expire date
     * @param increment Number of seconds to increment the expire date
     */
    function _increaseExpireDate(uint256 increment) private {
        if (increment == 0) return;
        uint256 expiresAt = block.timestamp + increment;
        _expiresAt = expiresAt;
        emit TimeLockExpireSet(expiresAt);
    }
}
