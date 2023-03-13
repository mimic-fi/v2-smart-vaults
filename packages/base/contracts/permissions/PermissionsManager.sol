// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';
import '@mimic-fi/v2-helpers/contracts/auth/IAuthorizer.sol';

import { Permission, PermissionChange, PermissionChangeRequest } from './PermissionsData.sol';

contract PermissionsManager is Authorizer {
    constructor(address admin) {
        _authorize(admin, Authorizer.authorize.selector);
        _authorize(admin, Authorizer.unauthorize.selector);
    }

    function executeMany(PermissionChangeRequest[] memory requests) external auth {
        for (uint256 i = 0; i < requests.length; i++) execute(requests[i]);
    }

    function execute(PermissionChangeRequest memory request) public auth {
        IAuthorizer target = request.target;
        for (uint256 i = 0; i < request.changes.length; i++) {
            PermissionChange memory change = request.changes[i];
            (change.grant ? target.authorize : target.unauthorize)(change.permission.who, change.permission.what);
        }
    }

    function grantAdminPermissions(IAuthorizer target, address account) external auth {
        require(account != address(0), 'GRANT_ADDRESS_ZERO');
        _grantAdminPermissions(target, account);
    }

    function revokeAdminPermissions(IAuthorizer target, address account) external auth {
        require(account != address(0), 'REVOKE_ADDRESS_ZERO');
        _revokeAdminPermissions(target, account);
    }

    function transferAdminPermissions(IAuthorizer target, address account) external auth {
        require(account != address(0), 'TRANSFER_ADDRESS_ZERO');
        require(account != address(this), 'REDUNDANT_TRANSFER_ADDRESS');
        _grantAdminPermissions(target, account);
        _revokeAdminPermissions(target, address(this));
    }

    function _grantAdminPermissions(IAuthorizer target, address account) private {
        target.authorize(account, IAuthorizer.authorize.selector);
        target.authorize(account, IAuthorizer.unauthorize.selector);
    }

    function _revokeAdminPermissions(IAuthorizer target, address account) private {
        target.unauthorize(account, IAuthorizer.authorize.selector);
        target.unauthorize(account, IAuthorizer.unauthorize.selector);
    }
}
