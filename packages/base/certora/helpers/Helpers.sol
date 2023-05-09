// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

contract Helpers  {
    function castUint32ToBytes4(uint32 a) external view returns (bytes4) {
        return bytes4(a);
    }
}
