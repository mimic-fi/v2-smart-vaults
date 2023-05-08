// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract Helpers  {
    function castUint32ToBytes4(uint32 a) external view returns (bytes4) {
        return bytes4(a);
    }

    function getTokenBalanceOf(address t, address a) external view returns (uint256) {
        return IERC20(t).balanceOf(a);
    }

    function getNativeTokenBalanceOf(address a) external view returns (uint256) {
        return a.balance;
    }
}
