// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';
import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';

import './interfaces/ITokenAmountConfig.sol';

/**
 * @dev Token amount config for actions. It mainly works with token threshold configs that can be used to tell if
 * a specific token amount is compliant with certain minimum or maximum values. These values can be defined in
 * foreign tokens in which case a price function must be used to compute rates. Additionally, token threshold configs
 * make use of a default threshold config as a fallback in case there is no custom threshold defined for the token
 * being evaluated.
 */
abstract contract TokenAmountConfig is Authorizer, ITokenAmountConfig {
    using FixedPoint for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @dev Enumerable map of tokens to threshold configs
     */
    struct TokenToThresholdMap {
        EnumerableSet.AddressSet tokens;
        mapping (address => Threshold) thresholds;
    }

    // Default threshold
    Threshold private _defaultThreshold;

    // Custom thresholds per token
    TokenToThresholdMap private _tokensThresholds;

    /**
     * @dev Creates a new token amount config
     * @param defaultThreshold Default threshold to be set
     * @param tokens List of tokens to define a custom threshold for
     * @param thresholds List of custom thresholds to define for each token
     */
    constructor(Threshold memory defaultThreshold, address[] memory tokens, Threshold[] memory thresholds) {
        if (defaultThreshold.token != address(0)) _setDefaultTokenThreshold(defaultThreshold);
        _setTokenThresholds(tokens, thresholds);
    }

    /**
     * @dev Tells if there is a default token threshold set
     */
    function hasDefaultTokenThreshold() public view override returns (bool) {
        return _defaultThreshold.token != address(0);
    }

    /**
     * @dev Tells the default token threshold
     */
    function getDefaultTokenThreshold() public view override returns (Threshold memory) {
        return _defaultThreshold;
    }

    /**
     * @dev Tells the token threshold defined for a specific token
     * @param token Address of the token being queried
     */
    function getTokenThreshold(address token) public view override returns (bool exists, Threshold memory threshold) {
        threshold = _tokensThresholds.thresholds[token];
        return (_tokensThresholds.tokens.contains(token), threshold);
    }

    /**
     * @dev Tells the list of custom token thresholds set
     */
    function getTokenThresholds()
        public
        view
        override
        returns (address[] memory tokens, Threshold[] memory thresholds)
    {
        tokens = new address[](_tokensThresholds.tokens.length());
        thresholds = new Threshold[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            (address token, Threshold memory threshold) = _getTokenThresholdAt(i);
            tokens[i] = token;
            thresholds[i] = threshold;
        }
    }

    /**
     * @dev Allows defining a list of amount values that should be processed for a given token. This default
     * implementation simply returns an empty array, which should be ignored since there are no values to try out.
     * However, each action developer should override this function to customize how their action should be executed.
     */
    function getTokenAmountHint(address) public view virtual override returns (uint256[] memory) {
        return new uint256[](0);
    }

    /**
     * @dev Sets a new default threshold config
     * @param threshold Threshold config to be set as the default one. Threshold token cannot be zero and max amount
     * must be greater than or equal to the min amount, with the exception of max being set to zero in which case it
     * will be ignored.
     */
    function setDefaultTokenThreshold(Threshold memory threshold) external override auth {
        _setDefaultTokenThreshold(threshold);
    }

    /**
     * @dev Unsets the default threshold, it ignores the request if it was not set
     */
    function unsetDefaultTokenThreshold() external override auth {
        _unsetDefaultTokenThreshold();
    }

    /**
     * @dev Sets a list of tokens thresholds
     * @param tokens List of token addresses to set its custom thresholds
     * @param thresholds Lists of thresholds be set for each token. Threshold token cannot be zero and max amount
     * must be greater than or equal to the min amount, with the exception of max being set to zero in which case it
     * will be ignored.
     */
    function setTokenThresholds(address[] memory tokens, Threshold[] memory thresholds) external override auth {
        _setTokenThresholds(tokens, thresholds);
    }

    /**
     * @dev Unsets a list of custom threshold tokens, it ignores nonexistent custom thresholds
     * @param tokens List of token addresses to unset its custom thresholds
     */
    function unsetTokenThresholds(address[] memory tokens) external override auth {
        _unsetTokenThresholds(tokens);
    }

    /**
     * @dev Defines how a token amount parameter should be processed. This implementation simply returns it as it is,
     * meaning no extra logic is added. However, each action developer should override it if they need to customize
     * any dynamic value that should not be given from the outside.
     * @param amount Token amount to be validated
     */
    function _processTokenAmount(address, uint256 amount) internal view virtual returns (uint256) {
        return amount;
    }

    /**
     * @dev Reverts if the requested token amount does not comply with the threshold config. This function can be
     * overridden by action developers to customize how token amounts should be validated.
     * @param token Address of the token to be validated
     * @param amount Token amount to be validated
     * @param getPrice Function to be used in order to rate the requested token with the threshold to be evaluated
     */
    function _validateTokenAmount(
        address token,
        uint256 amount,
        function(address, address) internal view returns (uint256) getPrice
    ) internal view virtual returns (uint256) {
        amount = _processTokenAmount(token, amount);
        _validateTokenThreshold(token, amount, getPrice);
        return amount;
    }

    /**
     * @dev Reverts if the requested token and amount does not comply with the given threshold config
     * @param token Address of the token to be validated
     * @param amount Token amount to be validated
     * @param getPrice Function to be used in order to rate the requested token with the threshold to be evaluated
     */
    function _validateTokenThreshold(
        address token,
        uint256 amount,
        function(address, address) internal view returns (uint256) getPrice
    ) private view {
        Threshold memory threshold = _getApplicableTokenThreshold(token);
        require(_isThresholdValid(threshold, token, amount, getPrice), 'TOKEN_THRESHOLD_FORBIDDEN');
    }

    /**
     * @dev Returns the token-threshold that should be applied for a token. If there is a custom threshold set it will
     * prioritized over the default threshold. If non of them are defined a null threshold is returned.
     * @param token Address of the token querying the threshold of
     */
    function _getApplicableTokenThreshold(address token) internal view returns (Threshold memory) {
        (bool exists, Threshold memory threshold) = getTokenThreshold(token);
        return exists ? threshold : getDefaultTokenThreshold();
    }

    /**
     * @dev Tells if a token and amount are compliant with a threshold, returns true if the threshold is not set
     * @param threshold Threshold to be evaluated
     * @param token Address of the token to be validated
     * @param amount Token amount to be validated
     * @param getPrice Function to be used in order to rate the requested token with the threshold to be evaluated
     */
    function _isThresholdValid(
        Threshold memory threshold,
        address token,
        uint256 amount,
        function(address, address) internal view returns (uint256) getPrice
    ) private view returns (bool) {
        if (threshold.token == address(0)) return true;
        uint256 price = token == threshold.token ? FixedPoint.ONE : getPrice(token, threshold.token);
        uint256 convertedAmount = amount.mulDown(price);
        return convertedAmount >= threshold.min && (threshold.max == 0 || convertedAmount <= threshold.max);
    }

    /**
     * @dev Returns the token-threshold pair stored at position `i` in the map. Note that there are no guarantees on
     * the ordering of entries inside the array, and it may change when more entries are added or removed. O(1).
     * @param i Index to be accessed in the enumerable map, must be strictly less than its length
     */
    function _getTokenThresholdAt(uint256 i) private view returns (address, Threshold memory) {
        address token = _tokensThresholds.tokens.at(i);
        return (token, _tokensThresholds.thresholds[token]);
    }

    /**
     * @dev Reverts if a threshold is not considered valid, that is if the token is zero or if the max amount is greater
     * than zero but lower than the min amount.
     */
    function _validateThreshold(Threshold memory threshold) private pure {
        require(threshold.token != address(0), 'INVALID_THRESHOLD_TOKEN_ZERO');
        require(threshold.max == 0 || threshold.max >= threshold.min, 'INVALID_THRESHOLD_MAX_LT_MIN');
    }

    /**
     * @dev Sets a new default threshold config
     * @param threshold Threshold config to be set as the default one. Threshold token cannot be zero and max amount
     * must be greater than or equal to the min amount, with the exception of max being set to zero in which case it
     * will be ignored.
     */
    function _setDefaultTokenThreshold(Threshold memory threshold) private {
        _validateThreshold(threshold);
        _defaultThreshold = threshold;
        emit DefaultTokenThresholdSet(threshold);
    }

    /**
     * @dev Unsets a the default threshold config
     */
    function _unsetDefaultTokenThreshold() private {
        delete _defaultThreshold;
        emit DefaultTokenThresholdUnset();
    }

    /**
     * @dev Sets a list of tokens thresholds
     * @param tokens List of token addresses to set its custom thresholds
     * @param thresholds Lists of thresholds be set for each token. Threshold token cannot be zero and max amount
     * must be greater than or equal to the min amount, with the exception of max being set to zero in which case it
     * will be ignored.
     */
    function _setTokenThresholds(address[] memory tokens, Threshold[] memory thresholds) private {
        require(tokens.length == thresholds.length, 'TOKEN_THRESHOLDS_INPUT_INV_LEN');
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            require(token != address(0), 'THRESHOLD_TOKEN_ADDRESS_ZERO');

            Threshold memory threshold = thresholds[i];
            _validateThreshold(threshold);

            _tokensThresholds.thresholds[token] = threshold;
            _tokensThresholds.tokens.add(token);
            emit TokenThresholdSet(token, threshold);
        }
    }

    /**
     * @dev Unsets a list of custom threshold tokens, it ignores nonexistent custom thresholds
     * @param tokens List of token addresses to unset its custom thresholds
     */
    function _unsetTokenThresholds(address[] memory tokens) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            delete _tokensThresholds.thresholds[token];
            if (_tokensThresholds.tokens.remove(token)) emit TokenThresholdUnset(token);
        }
    }
}
