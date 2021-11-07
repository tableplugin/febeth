const assert = require('assert');
const {BinPool} = require("./model/bin-pool");
const {errTypes} = require("./../test/exceptions");
const {expectThrow} = require("./test-util");


describe("BinPool", () => {
    const accounts = [0xF1, 0xF2]; const pool = new BinPool();
    function deploy() {

        const gov = pool.binGov;
        return {pool, gov};
    }

    it("deposit without value", async () => {
        const {pool, gov} = await deploy();
        assert.strictEqual(await pool.balanceOf(accounts[0]), 0n);
        assert.strictEqual(await pool.totalSupply(), 0n);
        assert.strictEqual(await gov.totalSupply(), 0n);
        assert.strictEqual((await pool.ethBalance()), 0n);

        expectThrow(() => pool.deposit({value: 0n}), errTypes.emptyDeposit);
    });

    it("seed deposit withdraw", async () => {
        const {pool, gov} = await deploy();
        await pool.deposit({from: accounts[0], value: BigInt(17e10)});
        assert.strictEqual((await pool.balanceOf(accounts[0])), BigInt(17e10));
        assert.strictEqual((await pool.totalSupply()), BigInt(17e10));
        assert.strictEqual((await pool.ethBalance()), BigInt(17e10));

        await pool.transfer(pool, BigInt(6e10), {from: accounts[0]}); // Withdraw
        assert.strictEqual((await pool.ethBalance()), BigInt(11e10) + BigInt(3e8));

        await pool.transfer(pool, BigInt(4e10), {from: accounts[0]}); // Withdraw
        assert.strictEqual(await pool.ethBalance(), BigInt(70391454546));

        assert.strictEqual(await pool.balanceOf(accounts[0]), BigInt(7e10));
        assert.strictEqual((await pool.totalSupply()), BigInt(7e10));

        await expectThrow(() => pool.withdraw({from: accounts[0]}), errTypes.notEnoughShares);
    });

    it("governance", async () => {
        const {pool, gov} = await deploy();

        //await expectThrow(() => gov.mintAirdrop(accounts[0], 100n, {from: accounts[0]}), errTypes.forbidden);

        await expectThrow(() => pool.setHouseEdge(0n, {from: accounts[0]}), errTypes.tooLow);
        await expectThrow(() => pool.setHouseEdge(100n * 3n, {from: accounts[0]}), errTypes.tooHigh);
        await expectThrow(() => pool.setHouseEdge(100n, {from: accounts[1]}), errTypes.forbidden);

        await expectThrow(() => pool.setPoolDivider(1000n - 1n, {from: accounts[0]}), errTypes.tooLow);
        await expectThrow(() => pool.setPoolDivider(100000n + 1n, {from: accounts[0]}), errTypes.tooHigh);
        await expectThrow(() => pool.setPoolDivider(5000n, {from: accounts[1]}), errTypes.forbidden);

        await expectThrow(() => pool.setTaxRate(1000n, {from: accounts[0]}), errTypes.tooHigh);
        await expectThrow(() => pool.setTaxRate(1000n, {from: accounts[1]}), errTypes.forbidden);
        await expectThrow(() => pool.claimTaxes({from: accounts[0]}), errTypes.noUnclaimedTaxes);
        await expectThrow(() => pool.claimTaxes({from: accounts[1]}), errTypes.forbidden);

        await expectThrow(() => pool.changeGovernance(accounts[0], {from: accounts[1]}), errTypes.forbidden);
        await pool.changeGovernance(accounts[1], {from: accounts[0]});
        await expectThrow(() => pool.changeGovernance(accounts[1], {from: accounts[0]}), errTypes.forbidden);
        await pool.changeGovernance(accounts[0], {from: accounts[1]});
    });

    it("deposit bet", async () => {
        const {pool, gov} = await deploy();
        const ONE_PERCENT = 100n;

        await pool.deposit({from: accounts[1], value: BigInt(3e10)});
        assert.strictEqual((await pool.balanceOf(accounts[0])), BigInt(7e10));
        assert.strictEqual(await pool.balanceOf(accounts[1]), BigInt(29833166732));
        assert.strictEqual(await pool.totalSupply(), BigInt(99833166732));
        assert.strictEqual((await gov.totalSupply()), totalDeposits);

        await expectThrow(() => pool.fallbackPayable({ from: accounts[0], value: BigInt(2e10) }), errTypes.betValueTooHigh);
        await expectThrow(() => pool.bet(50n * ONE_PERCENT, {from: accounts[1], value: BigInt(2e10)}), errTypes.betValueTooHigh);
        await expectThrow(() => pool.bet(51n * ONE_PERCENT, {from: accounts[1], value: BigInt(3e10)}), errTypes.betTooWeak); pool._ethBalance -= BigInt(7e10);
        await expectThrow(() => pool.bet(ONE_PERCENT, {from: accounts[1], value: 0n}), errTypes.emptyBet);
        await expectThrow(() => pool.fallbackPayable({ from: accounts[0], value: BigInt(8e10) }), errTypes.unsupportedPaymentOp);

        await pool.setTaxRate(100n, {from: accounts[0]});

        const poolBalanceBeforeBets = pool.ethBalance();
        let wins = 0;
        const numBets = 100;
        for (let i = 0; i < numBets; i++) {
            let outcome = await doBet({pool, gov}, 50n * ONE_PERCENT, i);
            if (outcome) {
                wins++;
            }
        }
        console.log("Won " + wins + " out of " + numBets + " bets!");
        const poolBalanceAfterBets = pool.ethBalance();
        const yieldP = 100 * (Number(poolBalanceAfterBets) - Number(poolBalanceBeforeBets)) / Number(poolBalanceBeforeBets);
        console.log("Yield: " + yieldP.toFixed(6) + "%");
        const unclaimedTaxes = pool.unclaimedTaxes;
        const taxYield = 100 * Number(unclaimedTaxes) / Number(poolBalanceBeforeBets);
        console.log("Unclaimed taxes: " + taxYield.toFixed(6) + "%");

        await pool.claimTaxes({from: accounts[0]});
        const poolBalanceAfterTaxClaim = pool.ethBalance();
        assert.strictEqual(poolBalanceAfterBets - poolBalanceAfterTaxClaim, unclaimedTaxes);
        assert.strictEqual(pool.unclaimedTaxes, 0n);
        await expectThrow(() => pool.claimTaxes({from: accounts[0]}), errTypes.noUnclaimedTaxes);
    });

    it("larger bets", async () => {
        const {pool} = await deploy();
        await expectThrow(() => pool.fallbackPayable({ from: accounts[0], value: BigInt(5e9) }), errTypes.betValueTooHigh); // Bet

        // const depositGas = await web3.eth.estimateGas({ from: accounts[0], to: pool.address, value: 40000e9 + 9e9 })
        // console.log("Estimated gas for deposits", depositGas);
        await pool.fallbackPayable({ from: accounts[0], value: BigInt(40000e9) + BigInt(9e9), gas: BigInt(1e5) }); // Deposit

        // const bettingGas = await web3.eth.estimateGas({ from: accounts[0], to: pool.address, value: 5e9 });
        // console.log("Estimated gas for betting", bettingGas);
        await pool.fallbackPayable({ from: accounts[0], value: BigInt(5e9), gas: BigInt(2e5) }); // Bet
    });

    // it("attack", async () => {
    //     const {pool} = await deploy();
    //     const attacker = await BinAttackContract.deployed();
    //     await expectThrow(attacker.attack({ from: accounts[0], value: 1e10 }), errTypes.noContractBetting);
    // });

    let totalWagers = 0n;
    const totalDeposits = BigInt(20e10);

    async function doBet({pool, gov}, p, betNumber) {
        const oldPoolBalance = pool.ethBalance();
        const houseEdge = pool.houseEdge;
        const poolDivider = pool.poolDivider;

        const wager = ((oldPoolBalance * p) / (100n * 100n - houseEdge)) / poolDivider;
        await pool.bet(p, {from: accounts[1], value: wager});

        totalWagers += wager;
        const newGovSupply = await gov.totalSupply();
        assert.strictEqual(newGovSupply, totalDeposits + totalWagers);

        const newPoolBalance = pool.ethBalance();
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
