// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

/**
 * @dev Library to operate tokens acceptance configs.
 * Token acceptance configs can be configured either as an allow list or as a deny list.
 * It consist basically on an enumerable set of tokens, which will consider a token valid if it is included
 * for allow lists or if its excluded for deny lists. By default tokens acceptance configs act as a deny list
 * to make sure any token can be compliant with it initially.
 */
library TokensAcceptance {
    using EnumerableSet for EnumerableSet.AddressSet;

    enum Type {
        DenyList,
        AllowList
    }

    /**
     * @dev Token acceptance config
     */
    struct Config {
        Type acceptanceType;
        EnumerableSet.AddressSet tokens;
    }

    /**
     * @dev Reverts if the requested token does not comply with the given acceptance config
     * @param self Token acceptance config to be evaluated
     * @param token Address of the token to be validated
     */
    function validate(Config storage self, address token) internal view {
        require(isValid(self, token), 'TOKEN_ACCEPTANCE_FORBIDDEN');
    }

    /**
     * @dev Tells if the requested token is compliant with the given acceptance config
     * @param self Token acceptance config to be evaluated
     * @param token Address of the token to be checked
     */
    function isValid(Config storage self, address token) internal view returns (bool) {
        return isAllowList(self) ? includes(self, token) : excludes(self, token);
    }

    /**
     * @dev Tells if the given token is included in the acceptance config
     * @param self Token acceptance config to be checked
     * @param token Address of the token to be checked
     */
    function includes(Config storage self, address token) internal view returns (bool) {
        return self.tokens.contains(token);
    }

    /**
     * @dev Tells if the given token is excluded in the acceptance config
     * @param self Token acceptance config to be checked
     * @param token Address of the token to be checked
     */
    function excludes(Config storage self, address token) internal view returns (bool) {
        return !self.tokens.contains(token);
    }

    /**
     * @dev Tells the length of an acceptance config
     * @param self Token acceptance config to be queried
     */
    function length(Config storage self) internal view returns (uint256) {
        return self.tokens.length();
    }

    /**
     * @dev Tells the token at a specific index of an acceptance config
     * @param self Token acceptance config to be queried
     * @param index Index being queried
     */
    function at(Config storage self, uint256 index) internal view returns (address) {
        return self.tokens.at(index);
    }

    /**
     * @dev Tells the list of tokens included in an acceptance config
     * @param self Token acceptance config querying the tokens of
     */
    function getTokens(Config storage self) internal view returns (address[] memory) {
        return self.tokens.values();
    }

    /**
     * @dev Tells if an acceptance config if an allow list or not
     */
    function isAllowList(Config storage self) internal view returns (bool) {
        return self.acceptanceType == Type.AllowList;
    }

    /**
     * @dev Tells if an acceptance config if a deny list or not
     */
    function isDenyList(Config storage self) internal view returns (bool) {
        return self.acceptanceType == Type.DenyList;
    }

    /**
     * @dev Sets the type of an acceptance list
     * @param self Token acceptance config to be updated
     * @param acceptanceType Type to be set, either allow list or deny list
     */
    function set(Config storage self, Type acceptanceType) internal {
        self.acceptanceType = acceptanceType;
    }

    /**
     * @dev Cleans the list of tokens of an acceptance list
     * @param self Token acceptance config to be updated
     */
    function clean(Config storage self) internal {
        address[] memory tokens = getTokens(self);
        for (uint256 i = 0; i < tokens.length; i++) remove(self, tokens[i]);
    }

    /**
     * @dev Removes a token from an acceptance list
     * @param self Token acceptance config to be updated
     * @param token Address of the token to be removed
     * @return True if the value was removed from the set, that is if it was present
     */
    function remove(Config storage self, address token) internal returns (bool) {
        return self.tokens.remove(token);
    }

    /**
     * @dev Adds a list of tokens to an acceptance list
     * @param self Token acceptance config to be updated
     * @param tokens List of token addresses to be added to the acceptance list, tokens cannot be zero
     */
    function add(Config storage self, address[] memory tokens) internal {
        for (uint256 i = 0; i < tokens.length; i++) add(self, tokens[i]);
    }

    /**
     * @dev Adds a token to an acceptance list
     * @param self Token acceptance config to be updated
     * @param token Address of the token to be added to the acceptance list, it cannot be zero
     * @return True if the value was added to the list, that is if it was not present
     */
    function add(Config storage self, address token) internal returns (bool) {
        require(token != address(0), 'ACCEPTANCE_TOKEN_ZERO');
        return self.tokens.add(token);
    }

    /**
     * @dev Sets the list of tokens of an acceptance list
     * @param self Token acceptance config to be updated
     * @param tokens List of addresses to be set as the tokens of an acceptance list
     */
    function set(Config storage self, address[] memory tokens) internal {
        clean(self);
        add(self, tokens);
    }

    /**
     * @dev Sets the type and list of tokens of an acceptance list
     * @param self Token acceptance config to be updated
     * @param acceptanceType Type to be set, either allow list or deny list
     * @param tokens List of addresses to be set as the tokens of an acceptance list
     */
    function set(Config storage self, Type acceptanceType, address[] memory tokens) internal {
        set(self, acceptanceType);
        set(self, tokens);
    }
}
