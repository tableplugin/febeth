// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IBinGov.sol";

contract BinPool is ERC20, ERC20Detailed, ReentrancyGuard {
    using Address for address payable;

    address public governance;
    IBinGov public binGov;
    constructor() ERC20Detailed("BinomialPool", "BINSHARE", 18) public {
        governance = msg.sender;
    }
    function setBinGov(IBinGov _binGov) external nonReentrant {
        require(msg.sender == governance, "FORBIDDEN");
        binGov = _binGov;
    }
    function changeGovernance(address newGovernance) external nonReentrant {
        require(msg.sender == governance, "FORBIDDEN");
        governance = newGovernance;
    }

    uint256 constant ONE_PERCENT = 100; // We use base points with 100 = 1%
    uint256 constant HUNDRED_PERCENT = ONE_PERCENT * 100;

    uint256 public stopLoss = ONE_PERCENT * 90;
    function increaseStopLoss() private {
        uint256 poolValue = getPoolValue();
        uint256 newStopLoss = poolValue.mul(ONE_PERCENT * 90) / totalSupply();
        if (newStopLoss > stopLoss) {
            stopLoss = newStopLoss;
        }
    }

    uint256 public houseEdge = ONE_PERCENT - (ONE_PERCENT / 5); // 0.8%
    function setHouseEdge(uint256 newHouseEdge) external nonReentrant {
        require(msg.sender == governance, "FORBIDDEN");
        require(newHouseEdge <= ONE_PERCENT * 2, "TOO_HIGH");
        require(newHouseEdge >= ONE_PERCENT / 10, "TOO_LOW");
        houseEdge = newHouseEdge;
    }

    uint256 public taxRate = 0;
    function setTaxRate(uint256 newTaxRate) external nonReentrant {
        require(msg.sender == governance, "FORBIDDEN");
        require(newTaxRate <= ONE_PERCENT, "TOO_HIGH");
        taxRate = newTaxRate;
    }

    function getPoolValue() public view returns (uint256) {
        return address(this).balance.sub(unclaimedTaxes);
    }

    uint256 public poolDivider = 4000;
    function setPoolDivider(uint256 newPoolDivider) external nonReentrant {
        require(msg.sender == governance, "FORBIDDEN");
        require(newPoolDivider >= 1000, "TOO_LOW");
        require(newPoolDivider <= 10000, "TOO_HIGH");
        poolDivider = newPoolDivider;
    }

    event Win(uint256 wager, uint256 p, uint256 dice, uint256 payout);
    event Loss(uint256 wager, uint256 p, uint256 dice);

    function extractOpCode(uint256 value) private pure returns (uint) {
        uint256 gwei = (value % 1e18) / 1e9;
        while (gwei > 0) {
            uint lastDigit = gwei % 10;
            if (lastDigit > 0) {
                return lastDigit;
            } else {
                gwei = gwei / 10;
            }
        }
        return 0;
    }

    function() external payable {
        uint opCode = extractOpCode(msg.value);
        if (opCode == 9) {
            deposit();
        } else if (1 <= opCode && opCode <= 5) {
            bet(opCode * ONE_PERCENT * 10);
        } else {
            revert("VALUE_LAST_DIGIT_UNSUPPORTED");
        }
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        super.transfer(recipient, amount);
        if (recipient == address(this)) {
            withdraw();
        }
        return true;
    }

    function bet(uint256 p) public nonReentrant payable {
        require(tx.origin == msg.sender, "NO_CONTRACT_BETTING");
        require(p >= 1, "INVALID_BET");
        require(p <= (HUNDRED_PERCENT / 2), "BET_TOO_WEAK");

        uint256 wager = msg.value;
        require(wager >= 1, "EMPTY_BET");

        uint256 winValueBeforeTaxes = wager.mul(HUNDRED_PERCENT.sub(houseEdge)) / p;
        uint256 winValue = winValueBeforeTaxes.mul(HUNDRED_PERCENT.sub(taxRate)) / HUNDRED_PERCENT;
        uint256 poolValue = getPoolValue().sub(wager);

        uint256 winLimit = poolValue / poolDivider;
        require(winValue <= winLimit, "BET_VALUE_TOO_HIGH");

        uint256 shareValue = poolValue.mul(HUNDRED_PERCENT) / totalSupply();
        require(shareValue >= stopLoss, "STOP_LOSS_REACHED");

        uint256 nonce = binGov.mintAirdrop(msg.sender, wager);

        bytes32 hash = keccak256(abi.encodePacked(
                    nonce,
                    blockhash(block.number - 1),
                    blockhash(block.number),
                    block.coinbase,
                    block.timestamp,
                    msg.sender
            ));
        uint256 dice = (uint256(hash) % HUNDRED_PERCENT).add(1);
        if (dice <= p) {
            uint256 taxes = winValueBeforeTaxes.sub(winValue);
            if (taxes > 0) {
                unclaimedTaxes = unclaimedTaxes.add(taxes);
            }
            msg.sender.sendValue(winValue);
            emit Win(wager, p, dice, winValue);
        } else {
            // Security-critical: Losing a bet must not consume more gas than winning a bet!
            emit Loss(wager, p, dice);
        }
        increaseStopLoss();
    }

    uint256 public unclaimedTaxes = 0;
    function claimTaxes() external nonReentrant {
        require(msg.sender == governance, "FORBIDDEN");
        require(unclaimedTaxes > 0, "NO_UNCLAIMED_TAXES");
        uint256 taxPayout = unclaimedTaxes;
        unclaimedTaxes = 0;
        msg.sender.sendValue(taxPayout);
    }

    uint256 constant WITHDRAWAL_FEE = ONE_PERCENT / 2;
    function withdraw() public nonReentrant {
        uint256 shares = balanceOf(address(this));
        require(shares >= 1, "NOT_ENOUGH_SHARES");
        uint256 withdrawValueBeforeFees = (getPoolValue().mul(shares)) / totalSupply();
        uint256 withdrawValue = withdrawValueBeforeFees.mul(HUNDRED_PERCENT.sub(WITHDRAWAL_FEE)) / HUNDRED_PERCENT;

        _burn(address(this), shares);
        msg.sender.sendValue(withdrawValue);
        increaseStopLoss();
    }

    function deposit() public nonReentrant payable {
        uint256 depositValue = msg.value;
        require(depositValue >= 1, "EMPTY_DEPOSIT");

        uint256 newPoolValue = getPoolValue();
        uint256 oldPoolValue = newPoolValue.sub(depositValue);

        uint256 oldShares = totalSupply();
        uint256 newShares;
        if (oldPoolValue == 0) {
            newShares = depositValue;
        } else {
            newShares = (depositValue.mul(oldShares)) / oldPoolValue;
        }

        require(newShares >= 1, "DEPOSIT_TOO_LOW");
        binGov.mintAirdrop(msg.sender, depositValue);
        _mint(msg.sender, newShares);
    }
}
