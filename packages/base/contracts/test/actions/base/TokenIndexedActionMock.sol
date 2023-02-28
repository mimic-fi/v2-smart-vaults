// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../actions/base/TokenIndexedAction.sol';

contract TokenIndexedActionMock is TokenIndexedAction {
    constructor(TokensAcceptanceType acceptanceType, address[] memory tokens)
        TokenIndexedAction(acceptanceType, tokens)
    {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }

    function call(address token) external view {
        _validateTokenAcceptance(token);
    }
}
