// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

import '@mimic-fi/v2-helpers/contracts/utils/Denominations.sol';

import '../interfaces/IFeeClaimer.sol';

contract FeeClaimerMock is IFeeClaimer {
    bool public fail;

    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    function mockFail(bool _fail) external {
        fail = _fail;
    }

    function augustusSwapper() external pure override returns (address) {
        return address(0);
    }

    function getBalance(address token, address) external view override returns (uint256) {
        return token == Denominations.NATIVE_TOKEN ? address(this).balance : IERC20(token).balanceOf(address(this));
    }

    function registerFee(address, address, uint256) external override {
        // solhint-disable-previous-line no-empty-blocks
    }

    function withdrawAllERC20(address token, address recipient) external override returns (bool) {
        token == Denominations.NATIVE_TOKEN
            ? _transferTokens(token, recipient, address(this).balance)
            : _transferTokens(token, recipient, IERC20(token).balanceOf(address(this)));
        return !fail;
    }

    function withdrawSomeERC20(address token, uint256 amount, address recipient) external override returns (bool) {
        _transferTokens(token, recipient, amount);
        return !fail;
    }

    function _transferTokens(address token, address destination, uint256 amount) internal {
        if (amount == 0) return;
        if (token == Denominations.NATIVE_TOKEN) Address.sendValue(payable(destination), amount);
        else IERC20(token).transfer(destination, amount);
    }
}
