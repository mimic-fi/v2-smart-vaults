// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../../actions/base/config/RelayersConfig.sol';

contract RelayersConfigMock is RelayersConfig {
    // Cost in gas of a call op + emit event
    uint256 public constant override BASE_GAS = 21e3 + 2e3;

    mapping (address => uint256) internal mockedNativePrice;

    event TransactionCostPaid(address indexed token, uint256 amount, bytes data);

    constructor(uint256 txCostLimit, address[] memory relayers) RelayersConfig(txCostLimit, relayers) {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }

    function call(address token) external redeemGas(token) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function mockNativeTokenPrice(address token, uint256 price) external {
        mockedNativePrice[token] = price;
    }

    function _redeemGasCost(address token, uint256 amount, bytes memory data) internal override {
        emit TransactionCostPaid(token, amount, data);
    }

    function _getNativeTokenPrice(address token) internal view override returns (uint256) {
        uint256 price = mockedNativePrice[token];
        require(price > 0, 'MOCKED_NATIVE_PRICE_ZERO');
        return price;
    }
}
