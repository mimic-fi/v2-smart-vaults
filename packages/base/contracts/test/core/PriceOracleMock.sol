// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract PriceOracleMock {
    uint256 public mockedRate;

    function mockRate(uint256 newMockedRate) external {
        mockedRate = newMockedRate;
    }

    function getPrice(address, address) external view returns (uint256) {
        return mockedRate;
    }
}
