// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

/**
 * @dev TODO
 */
library TokensAcceptance {
    using EnumerableSet for EnumerableSet.AddressSet;

    enum Type {
        AllowList,
        DenyList
    }

    struct Config {
        Type acceptanceType;
        EnumerableSet.AddressSet tokens;
    }

    function validate(Config storage self, address token) internal view {
        require(isValid(self, token), 'TOKEN_ACCEPTANCE_FORBIDDEN');
    }

    function isValid(Config storage self, address token) internal view returns (bool) {
        return isAllowList(self) ? includes(self, token) : excludes(self, token);
    }

    function includes(Config storage self, address token) internal view returns (bool) {
        return self.tokens.contains(token);
    }

    function excludes(Config storage self, address token) internal view returns (bool) {
        return !self.tokens.contains(token);
    }

    function length(Config storage self) internal view returns (uint256) {
        return self.tokens.length();
    }

    function at(Config storage self, uint256 index) internal view returns (address) {
        return self.tokens.at(index);
    }

    function values(Config storage self) internal view returns (address[] memory) {
        return self.tokens.values();
    }

    function isAllowList(Config storage self) internal view returns (bool) {
        return self.acceptanceType == Type.AllowList;
    }

    function isDenyList(Config storage self) internal view returns (bool) {
        return self.acceptanceType == Type.DenyList;
    }

    function add(Config storage self, address token) internal returns (bool) {
        return self.tokens.add(token);
    }

    function add(Config storage self, address[] memory tokens) internal {
        for (uint256 i = 0; i < tokens.length; i++) add(self, tokens[i]);
    }

    function remove(Config storage self, address token) internal returns (bool) {
        return self.tokens.remove(token);
    }

    function remove(Config storage self, address[] memory tokens) internal {
        for (uint256 i = 0; i < tokens.length; i++) remove(self, tokens[i]);
    }

    function set(Config storage self, Type acceptanceType) internal {
        self.acceptanceType = acceptanceType;
    }

    function set(Config storage self, address[] memory tokens) internal {
        address[] memory currentTokens = values(self);
        for (uint256 i = 0; i < currentTokens.length; i++) remove(self, currentTokens[i]);
        uint256 newLength = tokens.length;
        for (uint256 j = 0; j < newLength; j++) add(self, tokens[j]);
    }

    function set(Config storage self, Type acceptanceType, address[] memory tokens) internal {
        set(self, acceptanceType);
        set(self, tokens);
    }
}
