// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

/**
 * @dev Library to operate tokens threshold configs.
 * Token threshold configs can be used to tell if a specific token amount is compliant with certain minimum or maximum
 * values. These values can be defined in foreign tokens in which case a price function must be used to compute rates.
 * Additionally, token threshold configs make use of a default threshold config as a fallback in case there is no
 * custom threshold defined for the token being evaluated.
 */
library TokensThreshold {
    using FixedPoint for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @dev Threshold defined by a token address and min/max values
     */
    struct Threshold {
        address token;
        uint256 min;
        uint256 max;
    }

    /**
     * @dev Threshold config defined by a default config and an enumerable map of custom thresholds per token
     */
    struct Config {
        Threshold defaultThreshold;
        TokenToThresholdMap tokensThresholds;
    }

    /**
     * @dev Reverts if the requested token and amount does not comply with the given threshold config
     * @param self Token threshold config to be evaluated
     * @param token Address of the token to be validated
     * @param amount Token amount to be validated
     * @param getPrice Function to be used in order to rate the requested token with the threshold to be evaluated
     */
    function validate(
        Config storage self,
        address token,
        uint256 amount,
        function(address, address) internal view returns (uint256) getPrice
    ) internal view {
        require(isValid(self, token, amount, getPrice), 'TOKEN_THRESHOLD_FORBIDDEN');
    }

    /**
     * @dev Tells if a token and amount are compliant with a threshold config.
     * @param self Threshold config to be evaluated
     * @param token Address of the token to be validated
     * @param amount Token amount to be validated
     * @param getPrice Function to be used in order to rate the requested token with the threshold to be evaluated
     */
    function isValid(
        Config storage self,
        address token,
        uint256 amount,
        function(address, address) internal view returns (uint256) getPrice
    ) internal view returns (bool) {
        return isValid(getThreshold(self, token), token, amount, getPrice);
    }

    /**
     * @dev Tells the threshold token applied for a given token. If there is a custom threshold set for the given token,
     * it will be prioritized over the default one. Otherwise, the default threshold is used.
     * @param self Threshold config being queried
     * @param token Address of the token being queried
     */
    function getThreshold(Config storage self, address token) internal view returns (Threshold memory) {
        (bool exists, Threshold memory threshold) = tryGet(self.tokensThresholds, token);
        return exists ? threshold : self.defaultThreshold;
    }

    /**
     * @dev Tells the default threshold for a config
     * @param self Threshold config being queried
     */
    function getDefault(Config storage self) internal view returns (Threshold memory) {
        return self.defaultThreshold;
    }

    /**
     * @dev Tells the list of custom thresholds set for a config
     * @param self Threshold config being queried
     */
    function getThresholds(Config storage self) internal view returns (address[] memory, Threshold[] memory) {
        return getPairs(self.tokensThresholds);
    }

    /**
     * @dev Sets a new default threshold config
     * @param self Threshold config to be updated
     * @param threshold Threshold config to be set as the default one. Threshold token cannot be zero and max amount
     * must be greater than or equal to the min amount, with the exception of max being set to zero in which case it
     * will be ignored.
     */
    function setDefault(Config storage self, Threshold memory threshold) internal {
        validate(threshold);
        self.defaultThreshold = threshold;
    }

    /**
     * @dev Drops a custom threshold set for a given token, ignored if there was no custom threshold set for the token
     * @param self Threshold config to be updated
     * @param token Address of the token whose custom threshold will be unset
     */
    function remove(Config storage self, address token) internal returns (bool) {
        return remove(self.tokensThresholds, token);
    }

    /**
     * @dev Sets a new threshold config for a given token
     * @param self Threshold config to be updated
     * @param token Address of the token to be set with a custom threshold config
     * @param threshold Threshold config to be set
     * @return True if the threshold was set, that is if it was not already present
     */
    function set(Config storage self, address token, Threshold memory threshold) internal returns (bool) {
        return set(self.tokensThresholds, token, threshold);
    }

    /**
     * @dev Sets a bunch threshold configs for a list of tokens
     * @param self Threshold config to be updated
     * @param tokens List of addresses of the tokens to be set with a custom threshold config
     * @param thresholds List of threshold configs to be set for each token
     */
    function set(Config storage self, address[] memory tokens, Threshold[] memory thresholds) internal {
        clean(self.tokensThresholds);
        set(self.tokensThresholds, tokens, thresholds);
    }

    ////////////////////////////////////////
    // Enumerable map for token threshold //
    ////////////////////////////////////////

    /**
     * @dev Enumerable map of tokens to threshold configs
     */
    struct TokenToThresholdMap {
        EnumerableSet.AddressSet _tokens;
        mapping (address => Threshold) _thresholds;
    }

    /**
     * @dev Returns the number of thresholds set in the map. O(1).
     */
    function length(TokenToThresholdMap storage map) private view returns (uint256) {
        return map._tokens.length();
    }

    /**
     * @dev Returns true if there is a threshold set for the requested token address. O(1).
     */
    function contains(TokenToThresholdMap storage map, address token) private view returns (bool) {
        return map._tokens.contains(token);
    }

    /**
     * @dev Returns the token-threshold pair stored at position `i` in the map. Note that there are no guarantees on
     * the ordering of entries inside the array, and it may change when more entries are added or removed. O(1).
     * @param i Index to be accessed in the enumerable map, must be strictly less than its length
     */
    function at(TokenToThresholdMap storage map, uint256 i) private view returns (address, Threshold memory) {
        address token = map._tokens.at(i);
        return (token, map._thresholds[token]);
    }

    /**
     * @dev Returns the threshold associated with `token`. Reverts if there is no threshold set. O(1).
     */
    function get(TokenToThresholdMap storage map, address token) private view returns (Threshold memory) {
        Threshold memory threshold = map._thresholds[token];
        require(threshold.token != address(0) || contains(map, token), 'MISSING_TOKEN_THRESHOLD');
        return threshold;
    }

    /**
     * @dev Tries to returns the threshold associated with `token`. Does not revert if there is no threshold set. O(1).
     */
    function tryGet(TokenToThresholdMap storage map, address token) private view returns (bool, Threshold memory) {
        Threshold memory threshold = map._thresholds[token];
        return (contains(map, token), threshold);
    }

    /**
     * @dev Returns the list of tokens that have a threshold config set. O(N)
     */
    function getTokens(TokenToThresholdMap storage map) private view returns (address[] memory tokens) {
        tokens = new address[](length(map));
        for (uint256 i = 0; i < tokens.length; i++) {
            (address token, ) = at(map, i);
            tokens[i] = token;
        }
    }

    /**
     * @dev Returns the list of thresholds. O(N)
     */
    function getThresholds(TokenToThresholdMap storage map) private view returns (Threshold[] memory thresholds) {
        thresholds = new Threshold[](length(map));
        for (uint256 i = 0; i < thresholds.length; i++) {
            (, Threshold memory threshold) = at(map, i);
            thresholds[i] = threshold;
        }
    }

    /**
     * @dev Returns the list of token-threshold pairs. O(N)
     */
    function getPairs(TokenToThresholdMap storage map)
        private
        view
        returns (address[] memory tokens, Threshold[] memory thresholds)
    {
        tokens = new address[](length(map));
        thresholds = new Threshold[](tokens.length);
        for (uint256 i = 0; i < thresholds.length; i++) {
            (address token, Threshold memory threshold) = at(map, i);
            tokens[i] = token;
            thresholds[i] = threshold;
        }
    }

    /**
     * @dev Removes all the thresholds set in a map. O(N).
     */
    function clean(TokenToThresholdMap storage map) private {
        address[] memory tokens = getTokens(map);
        for (uint256 i = 0; i < tokens.length; i++) remove(map, tokens[i]);
    }

    /**
     * @dev Removes a threshold for a token. O(1).
     * @return True if the threshold was removed from the map, that is if it was present.
     */
    function remove(TokenToThresholdMap storage map, address token) private returns (bool) {
        delete map._thresholds[token];
        return map._tokens.remove(token);
    }

    /**
     * @dev Sets a bunch of thresholds for a list of tokens. O(1).
     * @param tokens List of addresses of the tokens to be set with a threshold.
     * @param thresholds List of threshold to be set for each token. Length must be equal to the list of tokens.
     * Threshold token cannot be zero and max amount must be greater than or equal to the min amount, with the
     * exception of max being set to zero in which case it will be ignored.
     */
    function set(TokenToThresholdMap storage map, address[] memory tokens, Threshold[] memory thresholds) private {
        require(tokens.length == thresholds.length, 'TOKENS_THRESHOLD_BAD_INPUT_LEN');
        for (uint256 i = 0; i < tokens.length; i++) set(map, tokens[i], thresholds[i]);
    }

    /**
     * @dev Sets a threshold for a token. O(1).
     * @param token Address of the token to be set, cannot be zero
     * @param threshold Threshold to be set. Threshold token cannot be zero and max amount must be greater than
     * or equal to the min amount, with the exception of max being set to zero in which case it will be ignored.
     * @return True if the threshold was added to the map, that is if it was not already present.
     */
    function set(TokenToThresholdMap storage map, address token, Threshold memory threshold) private returns (bool) {
        require(token != address(0), 'THRESHOLD_TOKEN_ADDRESS_ZERO');
        validate(threshold);

        map._thresholds[token] = threshold;
        return map._tokens.add(token);
    }

    /**
     * @dev Reverts if a threshold is not considered valid, that is if the token is zero or if the max amount is greater
     * than zero but lower than the min amount.
     */
    function validate(Threshold memory threshold) private pure {
        require(threshold.token != address(0), 'INVALID_THRESHOLD_TOKEN_ZERO');
        require(threshold.max == 0 || threshold.max >= threshold.min, 'INVALID_THRESHOLD_MAX_LT_MIN');
    }

    /**
     * @dev Tells if a token and amount are compliant with a threshold, returns false if the threshold is not set
     * @param threshold Threshold to be evaluated
     * @param token Address of the token to be validated
     * @param amount Token amount to be validated
     * @param getPrice Function to be used in order to rate the requested token with the threshold to be evaluated
     */
    function isValid(
        Threshold memory threshold,
        address token,
        uint256 amount,
        function(address, address) internal view returns (uint256) getPrice
    ) internal view returns (bool) {
        if (threshold.token == address(0)) return false;
        uint256 price = token == threshold.token ? FixedPoint.ONE : getPrice(token, threshold.token);
        uint256 convertedAmount = amount.mulDown(price);
        return convertedAmount >= threshold.min && (threshold.max == 0 || convertedAmount <= threshold.max);
    }
}
