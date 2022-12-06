// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract HopL2AmmMock {
    address public immutable l2CanonicalToken;

    constructor(address token) {
        l2CanonicalToken = token;
    }
}
