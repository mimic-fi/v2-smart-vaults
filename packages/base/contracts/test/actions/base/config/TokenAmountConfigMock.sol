// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../../actions/base/config/TokenAmountConfig.sol';

contract TokenAmountConfigMock is TokenAmountConfig {
    mapping (address => mapping (address => uint256)) internal rates;

    constructor(Threshold memory defaultThreshold, address[] memory tokens, Threshold[] memory thresholds)
        TokenAmountConfig(defaultThreshold, tokens, thresholds)
    {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }

    function mockRate(address base, address quote, uint256 rate) external {
        rates[base][quote] = rate;
    }

    function call(address token, uint256 amount) external view {
        amount = _processTokenAmount(token, amount);
        _validateTokenAmount(token, amount, getPrice);
    }

    function getPrice(address base, address quote) internal view returns (uint256) {
        uint256 rate = rates[base][quote];
        require(rate > 0, 'MISSING_PRICE_FEED');
        return rate;
    }
}
