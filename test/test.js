const expectThrow = require("./exceptions").expectThrow;
const errTypes = require("./exceptions").errTypes;
const BinPoolContract = artifacts.require("BinPool");
const BinGovContract = artifacts.require("BinGov");
const BinAttackContract = artifacts.require("BinAttack");

contract("BinPool", accounts => {

  async function deploy() {
    const pool = await BinPoolContract.deployed();
    const gov = await BinGovContract.deployed();
    return {pool, gov};
  }

  it("deposit without value", async () => {
    const {pool, gov} = await deploy();
    assert.equal(await pool.balanceOf(accounts[0]), 0);
    assert.equal(await pool.totalSupply(), 0);
    assert.equal(await gov.totalSupply(), 0);
    assert.equal((await web3.eth.getBalance(pool.address)), 0);

    await expectThrow(pool.deposit(), errTypes.emptyDeposit);
  });

  it("seed deposit withdraw", async () => {
    const {pool, gov} = await deploy();
    await pool.deposit({from: accounts[0], value: 17e10});
    assert.equal((await pool.balanceOf(accounts[0])).toNumber(), 17e10);
    assert.equal((await pool.totalSupply()).toNumber(), 17e10);
    assert.equal((await web3.eth.getBalance(pool.address)), 17e10);

    await pool.transfer(pool.address, 6e10, {from: accounts[0]}); // Withdraw
    assert.equal((await web3.eth.getBalance(pool.address)), 11e10 + 3e8);

    await pool.transfer(pool.address, 4e10, {from: accounts[0]}); // Withdraw
    assert.equal((await web3.eth.getBalance(pool.address)), 70391454546);

    assert.equal(await pool.balanceOf(accounts[0]), 7e10);
    assert.equal((await pool.totalSupply()).toNumber(), 7e10);

    await expectThrow(pool.withdraw({from: accounts[0]}), errTypes.notEnoughShares);
  });

  it("governance", async () => {
    const {pool, gov} = await deploy();

    await expectThrow(gov.mintAirdrop(accounts[0], 100), errTypes.forbidden);

    await expectThrow(pool.setHouseEdge(0, {from: accounts[0]}), errTypes.tooLow);
    await expectThrow(pool.setHouseEdge(100 * 3, {from: accounts[0]}), errTypes.tooHigh);
    await expectThrow(pool.setHouseEdge(100, {from: accounts[1]}), errTypes.forbidden);

    await expectThrow(pool.setPoolDivider(1000 - 1, {from: accounts[0]}), errTypes.tooLow);
    await expectThrow(pool.setPoolDivider(100000 + 1, {from: accounts[0]}), errTypes.tooHigh);
    await expectThrow(pool.setPoolDivider(5000, {from: accounts[1]}), errTypes.forbidden);

    await expectThrow(pool.setTaxRate(1000, {from: accounts[0]}), errTypes.tooHigh);
    await expectThrow(pool.setTaxRate(1000, {from: accounts[1]}), errTypes.forbidden);
    await expectThrow(pool.claimTaxes({from: accounts[0]}), errTypes.noUnclaimedTaxes);
    await expectThrow(pool.claimTaxes({from: accounts[1]}), errTypes.forbidden);

    await expectThrow(pool.changeGovernance(accounts[0], {from: accounts[1]}), errTypes.forbidden);
    await pool.changeGovernance(accounts[1], {from: accounts[0]});
    await expectThrow(pool.changeGovernance(accounts[1], {from: accounts[0]}), errTypes.forbidden);
    await pool.changeGovernance(accounts[0], {from: accounts[1]});
  });

  it("deposit bet", async () => {
    const {pool, gov} = await deploy();
    const ONE_PERCENT = 100;

    await pool.deposit({from: accounts[1], value: 3e10});
    assert.equal((await pool.balanceOf(accounts[0])).toNumber(), 7e10);
    assert.equal((await pool.balanceOf(accounts[1])).toNumber(), 29833166732);
    assert.equal((await pool.totalSupply()).toNumber(), 99833166732);
    assert.equal((await gov.totalSupply()).toNumber(), totalDeposits);

    await expectThrow(web3.eth.sendTransaction({ from: accounts[0], to: pool.address, value: 2e10 }), errTypes.betValueTooHigh);
    await expectThrow(pool.bet(50 * ONE_PERCENT, {from: accounts[1], value: 2e10}), errTypes.betValueTooHigh);
    await expectThrow(pool.bet(51 * ONE_PERCENT, {from: accounts[1], value: 3e10}), errTypes.betTooWeak);
    await expectThrow(pool.bet(ONE_PERCENT, {from: accounts[1], value: 0}), errTypes.emptyBet);
    await expectThrow(web3.eth.sendTransaction({ from: accounts[0], to: pool.address, value: 8e10 }), errTypes.unsupportedPaymentOp);

    await pool.setTaxRate(100, {from: accounts[0]});

    const poolBalanceBeforeBets = (await web3.eth.getBalance(pool.address));
    let wins = 0;
    const numBets = 100;
    for (let i = 0; i < numBets; i++) {
      let outcome = await doBet({pool, gov}, 50 * ONE_PERCENT, i);
      if (outcome) {
        wins++;
      }
    }
    console.log("Won " + wins + " out of " + numBets + " bets!");
    const poolBalanceAfterBets = (await web3.eth.getBalance(pool.address));
    const yieldP = 100 * (poolBalanceAfterBets - poolBalanceBeforeBets) / poolBalanceBeforeBets;
    console.log("Yield: " + yieldP.toFixed(6) + "%");
    const unclaimedTaxes = await pool.unclaimedTaxes();
    const taxYield = 100 * unclaimedTaxes / poolBalanceBeforeBets;
    console.log("Unclaimed taxes: " + taxYield.toFixed(6) + "%");

    await pool.claimTaxes({from: accounts[0]});
    const poolBalanceAfterTaxClaim = (await web3.eth.getBalance(pool.address));
    assert.equal(poolBalanceAfterBets - poolBalanceAfterTaxClaim, unclaimedTaxes);
    assert.equal((await pool.unclaimedTaxes()), 0);
    await expectThrow(pool.claimTaxes({from: accounts[0]}), errTypes.noUnclaimedTaxes);
  });

  it("larger bets", async () => {
    const {pool} = await deploy();
    await expectThrow(web3.eth.sendTransaction({ from: accounts[0], to: pool.address, value: 5e9 }), errTypes.betValueTooHigh); // Bet

    const depositGas = await web3.eth.estimateGas({ from: accounts[0], to: pool.address, value: 40000e9 + 9e9 })
    console.log("Estimated gas for deposits", depositGas);
    await web3.eth.sendTransaction({ from: accounts[0], to: pool.address, value: 40000e9 + 9e9, gas: 1e5 }); // Deposit

    const bettingGas = await web3.eth.estimateGas({ from: accounts[0], to: pool.address, value: 5e9 });
    console.log("Estimated gas for betting", bettingGas);
    await web3.eth.sendTransaction({ from: accounts[0], to: pool.address, value: 5e9, gas: 2e5 }); // Bet
  });

  it("attack", async () => {
    const {pool} = await deploy();
    const attacker = await BinAttackContract.deployed();
    await expectThrow(attacker.attack({ from: accounts[0], value: 1e10 }), errTypes.noContractBetting);
  });

  let totalWagers = 0;
  const totalDeposits = 20e10;

  async function doBet({pool, gov}, p, betNumber) {
    const oldPoolBalance = (await web3.eth.getBalance(pool.address));
    const houseEdge = (await pool.houseEdge.call());
    const poolDivider = (await pool.poolDivider.call());

    const wager = Math.floor((p / (100 * 100 - houseEdge)) * (oldPoolBalance / poolDivider));
    await pool.bet(p, {from: accounts[1], value: wager});

    totalWagers += wager;
    const newGovSupply = await gov.totalSupply();
    assert.equal(newGovSupply, totalDeposits + totalWagers);

    const newPoolBalance = (await web3.eth.getBalance(pool.address));
    if (newPoolBalance > oldPoolBalance) {
      console.log(betNumber + ") Player loss - newPoolBalance: " + newPoolBalance);
      return false;
    } else if (newPoolBalance < oldPoolBalance) {
      console.log(betNumber + ") Player win - newPoolBalance: " + newPoolBalance);
      return true;
    } else {
      throw Error("Unexpected pool balance " + newPoolBalance);
    }
  }
});
