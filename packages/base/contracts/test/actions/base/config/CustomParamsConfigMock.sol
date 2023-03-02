// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../../actions/base/config/CustomParamsConfig.sol';

contract CustomParamsConfigMock is CustomParamsConfig {
    constructor() CustomParamsConfig(new bytes32[](0), new bytes32[](0)) {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }
}
