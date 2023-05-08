import "./General.spec";

// METHODS

methods {
    function isAuthorized(address,bytes4) external returns (bool) envfree;
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
