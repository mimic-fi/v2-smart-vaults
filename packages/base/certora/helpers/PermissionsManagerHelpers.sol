// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@mimic-fi/v2-helpers/contracts/auth/IAuthorizer.sol';

import '../../contracts/permissions/PermissionsData.sol';
import '../../contracts/permissions/PermissionsManager.sol';

contract PermissionsManagerHelpers  {
    function request(IAuthorizer target, PermissionChange memory change)
        external
        pure
        returns (PermissionChangeRequest[] memory requests)
    {
        requests = new PermissionChangeRequest[](1);
        requests[0].target = target;
        requests[0].changes = new PermissionChange[](1);
        requests[0].changes[0] = change;
    }
}
