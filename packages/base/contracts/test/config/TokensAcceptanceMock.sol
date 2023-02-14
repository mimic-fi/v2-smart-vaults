// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../config/TokensAcceptance.sol';

contract TokensAcceptanceMock {
    using TokensAcceptance for TokensAcceptance.Config;

    TokensAcceptance.Config internal tokensAcceptance;

    function validate(address token) external view {
        tokensAcceptance.validate(token);
    }

    function isValid(address token) external view returns (bool) {
        return tokensAcceptance.isValid(token);
    }

    function includes(address token) external view returns (bool) {
        return tokensAcceptance.includes(token);
    }

    function excludes(address token) external view returns (bool) {
        return tokensAcceptance.excludes(token);
    }

    function length() external view returns (uint256) {
        return tokensAcceptance.length();
    }

    function at(uint256 index) external view returns (address) {
        return tokensAcceptance.at(index);
    }

    function getTokens() external view returns (address[] memory) {
        return tokensAcceptance.getTokens();
    }

    function isAllowList() external view returns (bool) {
        return tokensAcceptance.isAllowList();
    }

    function isDenyList() external view returns (bool) {
        return tokensAcceptance.isDenyList();
    }

    function setType(TokensAcceptance.Type acceptanceType) external {
        tokensAcceptance.set(acceptanceType);
    }

    function clean() external {
        tokensAcceptance.clean();
    }

    function remove(address token) external {
        tokensAcceptance.remove(token);
    }

    function add(address token) external {
        tokensAcceptance.add(token);
    }

    function addMany(address[] memory tokens) external {
        tokensAcceptance.add(tokens);
    }

    function setTokens(address[] memory tokens) external {
        tokensAcceptance.set(tokens);
    }

    function set(TokensAcceptance.Type acceptanceType, address[] memory tokens) external {
        tokensAcceptance.set(acceptanceType, tokens);
    }
}
