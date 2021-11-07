// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IBinGov.sol";

contract BinGov is ERC20, ERC20Detailed, ReentrancyGuard, IBinGov {

    address public binPool;
    constructor(address _binPool) ERC20Detailed("BinomialGovernance", "BINGOV", 18) public {
        binPool = _binPool;
    }

    uint256 public airdropCounter = 0;

    uint256 constant INITIAL_HALVING = 500e18;

    function airdropState(uint256 x) private pure returns (uint256, uint256, uint256, uint256) {
        uint256 lastHalving = 0;
        uint256 nextHalving = INITIAL_HALVING;
        uint inverseMiningRate = 1;
        uint numberOfHalvings = 0;
        while (nextHalving < x) {
            inverseMiningRate = inverseMiningRate.mul(2);
            numberOfHalvings = numberOfHalvings.add(1);
            uint256 interval = (nextHalving.sub(lastHalving)).mul(2);
            lastHalving = nextHalving;
            nextHalving = lastHalving.add(interval);
        }
        return (lastHalving, nextHalving, inverseMiningRate, numberOfHalvings);
    }

    function getLastHalving() external view returns (uint256) {
        (uint256 lastHalving, , , ) = airdropState(airdropCounter);
        return lastHalving;
    }

    function getNextHalving() external view returns (uint256) {
        ( , uint256 nextHalving, , ) = airdropState(airdropCounter);
        return nextHalving;
    }

    function getInverseMiningRate() external view returns (uint256) {
        ( , , uint256 inverseMiningRate, ) = airdropState(airdropCounter);
        return inverseMiningRate;
    }

    function getNumberOfHalvings() external view returns (uint256) {
        ( , , , uint256 numberOfHalvings) = airdropState(airdropCounter);
        return numberOfHalvings;
    }

    function f(uint256 x) private pure returns (uint256) {
        (uint256 lastHalving, uint256 nextHalving, , uint256 numberOfHalvings) = airdropState(x);
        uint256 y = numberOfHalvings.mul(INITIAL_HALVING);
        return y.add(INITIAL_HALVING.mul(x.sub(lastHalving)) / (nextHalving.sub(lastHalving)));
    }

    function mintAirdrop(address to, uint256 dX) external nonReentrant returns (uint256) {
        require(msg.sender == binPool, "FORBIDDEN");

        uint256 xNew = airdropCounter.add(dX);
        uint256 oldSupply = totalSupply();
        uint256 newSupply = f(xNew);
        uint256 airdropAmount = newSupply.sub(oldSupply);

        airdropCounter = xNew;
        _mint(to, airdropAmount);
        return xNew;
    }
}
