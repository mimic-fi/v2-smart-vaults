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

import '@mimic-fi/v2-helpers/contracts/auth/IAuthorizer.sol';

import './Arrays.sol';
import './PermissionsManager.sol';
import { Permission, PermissionChange, PermissionChangeRequest } from './PermissionsData.sol';

library PermissionsHelpers {
    function permission(address who, bytes4 what) internal pure returns (Permission memory) {
        return Permission(what, who);
    }

    function change(bool grant, address who, bytes4 what) internal pure returns (PermissionChange memory) {
        return PermissionChange(grant, permission(who, what));
    }

    function authorize(PermissionsManager self, IAuthorizer where, address who, bytes4 what) internal {
        authorize(self, where, Arrays.from(who), Arrays.from(what));
    }

    function unauthorize(PermissionsManager self, IAuthorizer where, address who, bytes4 what) internal {
        unauthorize(self, where, Arrays.from(who), Arrays.from(what));
    }

    function authorize(PermissionsManager self, IAuthorizer where, address[] memory whos, bytes4 what) internal {
        authorize(self, where, whos, Arrays.from(what));
    }

    function unauthorize(PermissionsManager self, IAuthorizer where, address[] memory whos, bytes4 what) internal {
        unauthorize(self, where, whos, Arrays.from(what));
    }

    function authorize(PermissionsManager self, IAuthorizer where, address who, bytes4[] memory whats) internal {
        authorize(self, where, Arrays.from(who), whats);
    }

    function unauthorize(PermissionsManager self, IAuthorizer where, address who, bytes4[] memory whats) internal {
        unauthorize(self, where, Arrays.from(who), whats);
    }

    function authorize(PermissionsManager self, IAuthorizer where, address[] memory whos, bytes4[] memory whats)
        internal
    {
        execute(self, where, whos, whats, true);
    }

    function unauthorize(PermissionsManager self, IAuthorizer where, address[] memory whos, bytes4[] memory whats)
        internal
    {
        execute(self, where, whos, whats, false);
    }

    function execute(
        PermissionsManager self,
        IAuthorizer where,
        address[] memory whos,
        bytes4[] memory whats,
        bool grant
    ) private {
        PermissionChangeRequest[] memory requests = new PermissionChangeRequest[](whos.length);
        for (uint256 i = 0; i < whos.length; i++) {
            requests[i].target = where;
            requests[i].changes = new PermissionChange[](whats.length);
            for (uint256 j = 0; j < whats.length; j++) {
                requests[i].changes[j] = change(grant, whos[i], whats[j]);
            }
        }
        self.executeMany(requests);
    }
}
