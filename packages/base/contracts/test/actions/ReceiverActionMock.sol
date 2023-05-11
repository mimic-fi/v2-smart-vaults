// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/ReceiverAction.sol';

contract ReceiverActionMock is ReceiverAction {
    constructor(address smartVault, address admin, address registry) BaseAction(admin, registry) {
        _setSmartVault(smartVault);
    }
}
