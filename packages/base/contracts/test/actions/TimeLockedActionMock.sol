// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/TimeLockedAction.sol';

contract TimeLockedActionMock is TimeLockedAction {
    constructor(address _admin, IWallet _wallet) BaseAction(_admin, _wallet) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function execute() external {
        _validateTimeLock();
    }
}
