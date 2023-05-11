// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/TimeLockedAction.sol';

contract TimeLockedActionMock is TimeLockedAction {
    constructor(address smartVault, address admin, address registry) BaseAction(admin, registry) {
        _setSmartVault(smartVault);
    }

    function call() external {
        _validateTimeLock();
    }
}
