using Helpers as generalHelpers;
using WrappedNativeToken as wrappedNativeToken;

methods {
    function generalHelpers.castUint32ToBytes4(uint32) external returns (bytes4) envfree;
}

function requireValidSender(env e) {
    require e.msg.sender != wrappedNativeToken;
}

// SANITY

rule sanity(method f) good_description "Sanity" {
    env e;
    calldataarg args;
    f(e, args);
    assert false;
}

// REENTRANCY GUARD

ghost uint256 ghostReentrancyStatus;

ghost mathint ghostReentrancyChangedTimes;

hook Sload uint256 status currentContract._status STORAGE {
    require ghostReentrancyStatus == status;
}

hook Sstore currentContract._status uint256 newStatus STORAGE {
    ghostReentrancyChangedTimes = ghostReentrancyChangedTimes + 1;
}

rule 
    reentrancyGuard(env e, method f, calldataarg args) filtered { f -> !f.isView } 
    good_description "Ensure external methods cannot be reentered"
{
    require ghostReentrancyChangedTimes == 0;

    f(e, args);

    bool hasChangedTwice = ghostReentrancyChangedTimes == 2;
    assert hasChangedTwice;
}

// AUTHENTICATION

rule 
    doNotForgetAuthModifier(env e, method f) filtered { f -> !f.isView } 
    good_description "Ensure external methods can only be called by authorized users" 
{
    bool isAuthorizedBefore = isAuthorized(e.msg.sender, generalHelpers.castUint32ToBytes4(f.selector));

    calldataarg args;
    f(e, args);

    assert isAuthorizedBefore;
}

// SMART VAULT SETTER

rule
    smartVaultCannotBeChangedOnceSet(env e, method f, calldataarg args) filtered { f -> !f.isView }
    good_description "Ensure smart vault dependency cannot be changed once set"
{
    address smartVaultBefore = smartVault();

    f(e, args);

    address smartVaultAfter = smartVault();
    assert smartVaultBefore == 0 || smartVaultAfter == smartVaultBefore;
}
