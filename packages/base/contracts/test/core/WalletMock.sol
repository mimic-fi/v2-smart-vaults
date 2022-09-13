// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@mimic-fi/v2-registry/contracts/implementations/IImplementation.sol';

contract WalletMock is IImplementation {
    bytes32 public constant override NAMESPACE = keccak256('PRICE_ORACLE');

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
