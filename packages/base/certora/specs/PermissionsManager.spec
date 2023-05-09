import "./General.spec";

using PermissionsManagerHelpers as permissionsManagerHelpers;

// METHODS

methods {
    function isAuthorized(address,bytes4) external returns (bool) envfree;

    function permissionsManagerHelpers.request(address, PermissionsManager.PermissionChange) external returns (PermissionsManager.PermissionChangeRequest[]) envfree;
}

// RULES

use rule sanity;

use rule doNotForgetAuthModifier filtered { f -> !f.isView }

use rule reentrancyGuard filtered {
    f ->
        !f.isView &&
        f.selector != sig:authorize(address,bytes4).selector &&
        f.selector != sig:unauthorize(address,bytes4).selector
}

rule grantDoesNotRevoke(env e, address target, PermissionsManager.PermissionChange change) {
    execute(e, permissionsManagerHelpers.request(target, change));

    bool isGrant = change.grant;
    bool isAuthorized = isAuthorized(change.permission.who, change.permission.what);
    assert (isGrant && isAuthorized) || (!isGrant && !isAuthorized);
}
