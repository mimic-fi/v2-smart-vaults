// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';
import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';

/**
 * @dev Action that can be used to redeem consumed gas costs based on an allow-list of relayers and cost limit.
 */
abstract contract RelayedAction is Authorizer {
    using FixedPoint for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    // Base gas amount charged to cover default amounts
    // solhint-disable-next-line func-name-mixedcase
    function BASE_GAS() external view virtual returns (uint256);

    // Note to be used to mark tx cost payments
    bytes private constant REDEEM_GAS_NOTE = bytes('RELAYER');

    // Variable used to allow a better developer experience to reimburse tx gas cost
    // solhint-disable-next-line var-name-mixedcase
    uint256 private __initialGas__;

    // Total transaction cost limit expressed in the native token
    uint256 private _txCostLimit;

    // List of allowed relayers
    EnumerableSet.AddressSet private _relayers;

    /**
     * @dev Emitted every time the tx cost limit is set
     */
    event TxCostLimitSet(uint256 txCostLimit);

    /**
     * @dev Emitted every time a relayer is added to the allow-list
     */
    event RelayerAllowed(address indexed relayer);

    /**
     * @dev Emitted every time a relayer is removed from the allow-list
     */
    event RelayerDisallowed(address indexed relayer);

    /**
     * @dev Modifier that can be used to reimburse the gas cost of the tagged function paying in a specific token
     */
    modifier redeemGas(address token) {
        _initRelayedTx();
        _;
        _payRelayedTx(token);
    }

    /**
     * @dev Creates a new relayed action
     * @param txCostLimit Transaction cost limit to be set
     * @param relayers List of relayers to be added to the allow-list
     */
    constructor(uint256 txCostLimit, address[] memory relayers) {
        _setTxCostLimit(txCostLimit);
        _addRelayers(relayers);
    }

    /**
     * @dev Sets the transaction cost limit
     * @param txCostLimit New transaction cost limit to be set
     */
    function setTxCostLimit(uint256 txCostLimit) external auth {
        _setTxCostLimit(txCostLimit);
    }

    /**
     * @dev Updates the list of allowed relayers
     * @param relayersToAdd List of relayers to be added to the allow-list
     * @param relayersToRemove List of relayers to be removed from the allow-list
     * @notice The list of relayers to be added will be processed first to make sure no undesired relayers are allowed
     */
    function setRelayers(address[] memory relayersToAdd, address[] memory relayersToRemove) external auth {
        _addRelayers(relayersToAdd);
        _removeRelayers(relayersToRemove);
    }

    /**
     * @dev Tells the transaction cost limit
     */
    function getTxCostLimit() public view returns (uint256) {
        return _txCostLimit;
    }

    /**
     * @dev Tells if a relayer is allowed or not
     * @param relayer Address of the relayer to be checked
     */
    function isRelayer(address relayer) public view returns (bool) {
        return _relayers.contains(relayer);
    }

    /**
     * @dev Tells the list of allowed relayers
     */
    function getRelayers() public view returns (address[] memory) {
        return _relayers.values();
    }

    /**
     * @dev Tells if a given transaction cost is compliant with the configured transaction cost limit
     * @param totalCost Transaction cost in native token to be checked
     */
    function _isTxCostValid(uint256 totalCost) internal view returns (bool) {
        return _txCostLimit == 0 || totalCost <= _txCostLimit;
    }

    /**
     * @dev Virtual function that must be overridden to quote the native token price in another token
     * @param token Address of the token to quote the native token price in
     */
    function _getNativeTokenPrice(address token) internal view virtual returns (uint256);

    /**
     * @dev Initializes relayed txs
     */
    function _initRelayedTx() internal {
        if (!isRelayer(msg.sender)) return;
        __initialGas__ = gasleft();
    }

    /**
     * @dev Internal after call hook where tx cost is reimbursed. Only when the sender is marked as a relayer.
     * @param token Address of the token to be used to pay the tx cost
     * @return Amount of tokens reimbursed to cover the tx cost
     */
    function _payRelayedTx(address token) internal returns (uint256) {
        if (!isRelayer(msg.sender)) return 0;
        require(__initialGas__ > 0, 'RELAYED_TX_NOT_INITIALIZED');

        uint256 totalGas = RelayedAction(this).BASE_GAS() + __initialGas__ - gasleft();
        uint256 totalCostNative = totalGas * tx.gasprice;
        require(_isTxCostValid(totalCostNative), 'TRANSACTION_COST_LIMIT_EXCEEDED');

        uint256 price = _getNativeTokenPrice(token);
        uint256 totalCostToken = totalCostNative.mulDown(price);
        _redeemGasCost(token, totalCostToken, REDEEM_GAS_NOTE);

        delete __initialGas__;
        return totalCostToken;
    }

    /**
     * @dev Virtual function that must be overridden to redeem gas costs
     * @param token Address of the token to be used to redeem gas costs
     * @param amount Amount of tokens to redeem to cover gas costs
     * @param data Redeem gas cost note
     */
    function _redeemGasCost(address token, uint256 amount, bytes memory data) internal virtual;

    /**
     * @dev Sets the transaction cost limit
     * @param txCostLimit New transaction cost limit to be set
     */
    function _setTxCostLimit(uint256 txCostLimit) private {
        _txCostLimit = txCostLimit;
        emit TxCostLimitSet(txCostLimit);
    }

    /**
     * @dev Adds a list of addresses to the relayers allow-list
     * @param relayers List of addresses to be added to the allow-list
     */
    function _addRelayers(address[] memory relayers) private {
        for (uint256 i = 0; i < relayers.length; i++) {
            address relayer = relayers[i];
            require(relayer != address(0), 'RELAYER_ADDRESS_ZERO');
            if (_relayers.add(relayer)) emit RelayerAllowed(relayer);
        }
    }

    /**
     * @dev Removes a list of addresses from the relayers allow-list
     * @param relayers List of addresses to be removed from the allow-list
     */
    function _removeRelayers(address[] memory relayers) private {
        for (uint256 i = 0; i < relayers.length; i++) {
            address relayer = relayers[i];
            if (_relayers.remove(relayer)) emit RelayerDisallowed(relayer);
        }
    }
}
