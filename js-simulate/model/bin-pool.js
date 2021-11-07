const assert = require('assert');
const {ERC20} = require("./erc20");
const {BinGov} = require("./bin-gov");






exports.BinPool = class extends ERC20 {


  governance = 0xF1;
  binGov = new BinGov();
  // constructor() ERC20Detailed("BinomialPool", "BINSHARE", 18) public {
  //   governance = msg.sender;
  // }
  setBinGov(_binGov, msg) {
    assert(this.governance === msg.from, "FORBIDDEN");
    this.binGov = _binGov;
  };
  changeGovernance(newGovernance, msg) {
    assert(msg.from === this.governance, "FORBIDDEN");
    this.governance = newGovernance;
  };

  ONE_PERCENT = 100n; // We use base points with 100 = 1%
  HUNDRED_PERCENT = 100n * 100n;

  stopLoss = 100n * 90n;
  increaseStopLoss() {
    const poolValue = this.getPoolValue();
    const newStopLoss = poolValue * (this.ONE_PERCENT * 90n) / this.totalSupply();
    if (newStopLoss > this.stopLoss) {
      this.stopLoss = newStopLoss;
    }
  };

  houseEdge = 100n - 100n / 5n; // 0.8%
  setHouseEdge(newHouseEdge, msg) {
    assert(msg.from === this.governance, "FORBIDDEN");
    assert(newHouseEdge <= this.ONE_PERCENT * 2n, "TOO_HIGH");
    assert(newHouseEdge >= this.ONE_PERCENT / 10n, "TOO_LOW");
    this.houseEdge = newHouseEdge;
  };

  taxRate = 0n;
  setTaxRate(newTaxRate, msg) {
    assert(msg.from === this.governance, "FORBIDDEN");
    assert(newTaxRate <= this.ONE_PERCENT, "TOO_HIGH");
    this.taxRate = newTaxRate;
  };

  getPoolValue() {
    return this.ethBalance() - this.unclaimedTaxes;
  }

  poolDivider = 4000n;
  setPoolDivider(newPoolDivider, msg) {
    assert(msg.from === this.governance, "FORBIDDEN");
    assert(newPoolDivider >= 1000n, "TOO_LOW");
    assert(newPoolDivider <= 10000n, "TOO_HIGH");
    this.poolDivider = newPoolDivider;
  };

  //event Win(uint256 wager, uint256 p, uint256 dice, uint256 payout);
  //event Loss(uint256 wager, uint256 p, uint256 dice);

  extractOpCode(value) {
    let gwei = (value % BigInt(1e18)) / BigInt(1e9);
    while (gwei > 0n) {
      const lastDigit = gwei % 10n;
      if (lastDigit > 0n) {
        return lastDigit;
      } else {
        gwei = gwei / 10n;
      }
    }
    return 0n;
  };

  fallbackPayable(msg) {
    const opCode = this.extractOpCode(msg.value);
    if (opCode === 9n) {
      this.deposit(msg);
    } else if (1n <= opCode && opCode <= 5n) {
      this.bet(opCode * this.ONE_PERCENT * 10n, msg);
    } else {
      throw Error("VALUE_LAST_DIGIT_UNSUPPORTED");
    }
  };

  transfer(recipient, amount, msg) {
    this._transfer(msg.from, recipient, amount);
    if (recipient === this) {
      this.withdraw(msg);
    }
    return true;
  };

  bet(p, msg) { this._ethBalance += msg.value;
    //assert(tx.origin == msg.sender, "NO_CONTRACT_BETTING");
    assert(p >= 1n, "INVALID_BET");
    assert(p <= (this.HUNDRED_PERCENT / 2n), "BET_TOO_WEAK");

    const wager = msg.value;
    assert(wager >= 1n, "EMPTY_BET");

    const winValueBeforeTaxes = wager * (this.HUNDRED_PERCENT - this.houseEdge) / p;
    const winValue = winValueBeforeTaxes * (this.HUNDRED_PERCENT - this.taxRate) / this.HUNDRED_PERCENT;
    const poolValue = this.getPoolValue() - wager;

    const winLimit = poolValue / this.poolDivider;
    assert(winValue <= winLimit, "BET_VALUE_TOO_HIGH");

    const shareValue = poolValue * this.HUNDRED_PERCENT / this.totalSupply();
    assert(shareValue >= this.stopLoss, "STOP_LOSS_REACHED");

    this.binGov.mintAirdrop(msg.from, wager, {from: 0x111});

    // bytes32 hash = keccak256(abi.encodePacked(
    //     nonce,
    //     blockhash(block.number - 1),
    //     blockhash(block.number),
    //     block.coinbase,
    //     block.timestamp,
    //     msg.sender
    // ));
    const dice = BigInt(Math.ceil(Math.random() * Number(this.HUNDRED_PERCENT)));
    if (dice <= p) {
      const taxes = winValueBeforeTaxes - winValue;
      if (taxes > 0n) {
        this.unclaimedTaxes += taxes;
      }
      this._ethBalance -= winValue; //msg.sender.sendValue(winValue);
      //emit Win(wager, p, dice, winValue);
    } else {
      // Security-critical: Losing a bet must not consume more gas than winning a bet!
      //emit Loss(wager, p, dice);
    }
    this.increaseStopLoss();
  };

  unclaimedTaxes = 0n;
  claimTaxes(msg) {
    assert(msg.from === this.governance, "FORBIDDEN");
    assert(this.unclaimedTaxes > 0n, "NO_UNCLAIMED_TAXES");
    const taxPayout = this.unclaimedTaxes;
    this.unclaimedTaxes = 0n;
    this._ethBalance -= taxPayout; //msg.sender.sendValue(taxPayout);
  };

  WITHDRAWAL_FEE = this.ONE_PERCENT / 2n;
  withdraw(msg) {
    const shares = this.balanceOf(this);
    assert(shares >= 1, "NOT_ENOUGH_SHARES");
    const withdrawValueBeforeFees = (this.getPoolValue() * shares) / this.totalSupply();
    const withdrawValue = withdrawValueBeforeFees * (this.HUNDRED_PERCENT - this.WITHDRAWAL_FEE) / this.HUNDRED_PERCENT;

    this._burn(this, shares);
    this._ethBalance -= withdrawValue; //msg.from.sendValue(withdrawValue);
    if (this.totalSupply()) this.increaseStopLoss();
  };

  deposit(msg) { this._ethBalance += msg.value;
    const depositValue = msg.value;
    assert(depositValue >= 1, "EMPTY_DEPOSIT");

    const newPoolValue = this.getPoolValue();
    const oldPoolValue = newPoolValue - depositValue;

    const oldShares = this.totalSupply();
    let newShares;
    if (oldPoolValue === 0n) {
      newShares = depositValue;
    } else {
      newShares = (depositValue * oldShares) / oldPoolValue;
    }

    assert(newShares >= 1, "DEPOSIT_TOO_LOW");
    this.binGov.mintAirdrop(msg.from, depositValue, {from: msg.from});
    this._mint(msg.from, newShares);
  }
};
