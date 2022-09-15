// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract WalletMock {
    address public priceOracle;
    address public feeCollector;
    address public wrappedNativeToken;

    event Withdraw(address token, uint256 amount, address recipient, bytes data);

    constructor(address _priceOracle, address _feeCollector, address _wrappedNativeToken) {
        priceOracle = _priceOracle;
        feeCollector = _feeCollector;
        wrappedNativeToken = _wrappedNativeToken;
    }

    function withdraw(address token, uint256 amount, address recipient, bytes memory data) external {
        emit Withdraw(token, amount, recipient, data);
    }
}
