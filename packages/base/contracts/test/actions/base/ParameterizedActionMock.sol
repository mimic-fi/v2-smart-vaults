// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../actions/base/ParameterizedAction.sol';

contract ParameterizedActionMock is ParameterizedAction {
    constructor() ParameterizedAction(new bytes32[](0), new bytes32[](0)) {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }
}
