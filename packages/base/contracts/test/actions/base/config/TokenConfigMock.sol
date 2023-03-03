// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../../actions/base/config/TokenConfig.sol';

contract TokenConfigMock is TokenConfig {
    constructor(TokensAcceptanceType acceptanceType, address[] memory tokens) TokenConfig(acceptanceType, tokens) {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }

    function call(address token) external view {
        _validateToken(token);
    }
}
