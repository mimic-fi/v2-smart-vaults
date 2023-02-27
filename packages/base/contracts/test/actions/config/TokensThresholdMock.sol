// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../actions/config/TokensThreshold.sol';

contract TokensThresholdMock {
    using TokensThreshold for TokensThreshold.Config;

    TokensThreshold.Config internal tokensThreshold;
    mapping (address => mapping (address => uint256)) internal rates;

    function mockRate(address base, address quote, uint256 rate) external {
        rates[base][quote] = rate;
    }

    function getRate(address base, address quote) internal view returns (uint256) {
        uint256 rate = rates[base][quote];
        require(rate > 0, 'TOKENS_THRESHOLD_MOCK_RATE_ZERO');
        return rate;
    }

    function validate(address token, uint256 amount) external view {
        tokensThreshold.validate(token, amount, getRate);
    }

    function isValid(address token, uint256 amount) external view returns (bool) {
        return tokensThreshold.isValid(token, amount, getRate);
    }

    function getThreshold(address token) external view returns (TokensThreshold.Threshold memory) {
        return tokensThreshold.getThreshold(token);
    }

    function getDefault() external view returns (TokensThreshold.Threshold memory) {
        return tokensThreshold.getDefault();
    }

    function getThresholds()
        external
        view
        returns (address[] memory tokens, TokensThreshold.Threshold[] memory thresholds)
    {
        return tokensThreshold.getThresholds();
    }

    function setDefault(TokensThreshold.Threshold memory threshold) external {
        tokensThreshold.setDefault(threshold);
    }

    function removeThreshold(address token) external returns (bool) {
        return tokensThreshold.remove(token);
    }

    function setThreshold(address token, TokensThreshold.Threshold memory threshold) external returns (bool) {
        return tokensThreshold.set(token, threshold);
    }

    function setManyThresholds(address[] memory tokens, TokensThreshold.Threshold[] memory thresholds) external {
        return tokensThreshold.set(tokens, thresholds);
    }
}
