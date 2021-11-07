const {BinPool} = require("./model/bin-pool");
const {errTypes} = require("./../test/exceptions");
const {expectThrow} = require("./test-util");
var expect = require('chai').expect;

const initialEth = BigInt(10e18);
const self = 0x111;
const other = 0x3;

const targetGov = BigInt(2000e18);
const targetDx = BigInt(7500e18);

/**
 * As long as the pool is still small, the airdrop can be "cheated" with repeated deposits and withdrawals.
 * This is acceptable to a limited degree, but don't overuse this strategy!
 * A governance-token can become worthless if it is too centralized among early investors,
 * and therefore early investors should not be too greedy.
 */

function seedTest() {
    const pool = new BinPool();
    const gov = pool.binGov;
    let myEth = initialEth;
    function assertConsistency(msg) {
        expect([self, other]).contains(msg.from);
        let total = 0n;
        for (const key of Object.keys(pool._balances)) {
            total += pool.balanceOf(key);
        }
        expect(total - pool.totalSupply()).to.eq(0n);
    }
    function deposit(msg) {
        if (msg.from === self) {
            expect(msg.value <= myEth).to.eq(true);
            myEth -= msg.value;
        }
        assertConsistency(msg);
        pool.deposit(msg);
        assertConsistency(msg);
    }
    function withdraw(shares, msg) {
        const ethBeforeWithdraw = pool.ethBalance();

        assertConsistency(msg);
        pool.transfer(pool, shares, msg); // withdraw
        assertConsistency(msg);

        const ethAfterWithdraw = pool.ethBalance();
        expect(ethAfterWithdraw < ethBeforeWithdraw).to.eq(true);
        if (msg.from === self) {
            myEth += (ethBeforeWithdraw - ethAfterWithdraw);
        }
    }
    function eval(args) {
        if (typeof args.complete !== "boolean" || args.complete) {
            expect(gov.totalSupply()).to.eq(targetGov, "Strategy incomplete");
        }
        const sharePriceBeforeWithdraw = pool.totalSupply() > 0 ?
            Number(pool.ethBalance()) / Number(pool.totalSupply())
            : "Infinity";

        const otherRemainingShares = pool.balanceOf(other);
        if (otherRemainingShares) {
            withdraw(otherRemainingShares, {from: other});
        }
        const myRemainingShares = pool.balanceOf(self);
        if (myRemainingShares) {
            withdraw(myRemainingShares, {from: self});
        }
        expect(pool.totalSupply()).to.eq(0n);

        const ethYield = Number(myEth - initialEth) / 1e18;
        const govSupply = gov.totalSupply();
        const earlyGovFraction = (100 * Number(gov.balanceOf(self))) / Number(govSupply);

        console.log("Share price before last withdraws: " + sharePriceBeforeWithdraw);
        console.log("GOVs minted: " + Number(govSupply) / 1e18);

        console.log("Early Gov Fraction: " + earlyGovFraction + "%");
        console.log("ETH Yield: " + ethYield);
        return {ethYield, govShare: earlyGovFraction};
    }

    expect(gov.totalSupply()).to.equal(0n);
    expect(pool.totalSupply()).to.equal(0n);
    expect(pool.ethBalance()).to.equal(0n);
    return {deposit, withdraw, pool, gov, eval};
}

describe("Seed Strategy", () => {

    it("validate config", async() => {
        const pool = new BinPool();
        const gov = pool.binGov;
        expect(gov.f(targetDx)).to.eql(targetGov);

        expect(gov.f(BigInt(0))).to.eql(BigInt(0));
        expect(gov.f(BigInt(250e18))).to.eql(BigInt(250e18));
        expect(gov.f(BigInt(500e18))).to.eql(BigInt(gov.INITIAL_HALVING));
        expect(gov.f(BigInt(1000e18))).to.eql(BigInt(750e18));
        expect(gov.f(BigInt(1500e18))).to.eql(BigInt(gov.INITIAL_HALVING * 2n));
        expect(gov.f(BigInt(2500e18))).to.eql(BigInt(1250e18));
        expect(gov.f(BigInt(3500e18))).to.eql(BigInt(gov.INITIAL_HALVING * 3n));
        expect(gov.f(BigInt(5500e18))).to.eql(BigInt(1750e18));
        expect(gov.f(targetDx)).to.eql(BigInt(gov.INITIAL_HALVING * 4n));
        expect(gov.f(11500000000000000000000n)).to.eql(BigInt(2250e18));
        expect(gov.f(15500000000000000000000n)).to.eql(BigInt(gov.INITIAL_HALVING * 5n));
    });

    it("simple overbid", async () => {
        const {deposit, pool, eval} = seedTest();
        deposit({value: initialEth, from: self});

        deposit({value: targetDx - initialEth, from: other });
        expect(eval({complete: true})).to.eql({ethYield: 37.21275, govShare: 0.5});
    });

    function doInitialCycles({deposit, withdraw, pool, gov, eval}) {
        deposit({value: initialEth, from: self});
        const numCycles = 50;
        const withdrawDivider = 3n;
        for (let cycle = 0; cycle < numCycles; cycle++) {
            withdraw(pool.balanceOf(self) / withdrawDivider, {from: self});
            deposit({value: initialEth - pool.ethBalance(), from: self});
        }
        expect(Number(gov.balanceOf(self))).to.gte(Number(gov.INITIAL_HALVING) * 0.35);
        expect(Number(gov.balanceOf(self))).to.lte(Number(gov.INITIAL_HALVING) * 0.36);
        expect(pool.ethBalance()).to.equal(initialEth);
    }

    it("withdraw cycles - large buy", async () => {
        const {deposit, withdraw, pool, gov, eval} = seedTest();
        doInitialCycles({deposit, withdraw, pool, gov, eval});

        deposit({value: targetDx - gov.airdropCounter, from: other });
        expect(eval({complete: true})).to.eql({ethYield: 36.38772916666667, govShare: 8.791666666666666});
    });

    it("sequential withdraw cycles", async () => {
        const {deposit, withdraw, pool, gov, eval} = seedTest();
        doInitialCycles({deposit, withdraw, pool, gov, eval});

        const otherCycles = 1444;
        const otherWithdrawDivider = 20n;
        const otherInitialEth = BigInt(100e18);
        deposit({value: otherInitialEth, from: other});
        for (let cycle = 0; cycle < otherCycles; cycle++) {
            withdraw(pool.balanceOf(other) / otherWithdrawDivider, {from: other});
            deposit({value: initialEth + otherInitialEth - pool.ethBalance(), from: other});
        }
        expect(pool.ethBalance()).to.equal(initialEth + otherInitialEth);

        expect(Number(targetGov - gov.airdropCounter)).to.lt(Number(otherInitialEth / otherWithdrawDivider));
        deposit({value: targetDx - gov.airdropCounter, from: other });
        expect(eval({complete: true})).to.eql({ethYield: 5.294556510107339, govShare: 8.791666666666666});
    });

    it("overspend", async () => {
        const {deposit} = seedTest();
        deposit({value: BigInt(2000e18), from: other});
        expectThrow(() => deposit({value: BigInt(2000e18), from: self}), "expected false to equal true");
    });

    it("deposit withdraw everything - brick contract", async () => {
        const {deposit, withdraw, pool, gov, eval} = seedTest();

        deposit({value: BigInt(10e18), from: self});
        expect(gov.totalSupply()).to.equal(BigInt(10e18));
        expect(pool.totalSupply()).to.equal(BigInt(10e18));
        expect(pool.ethBalance()).to.equal(BigInt(10e18));

        withdraw(BigInt(10e18), {from: self});
        expect(gov.totalSupply()).to.equal(BigInt(10e18));
        expect(pool.totalSupply()).to.equal(0n);
        expect(pool.ethBalance()).to.equal(BigInt(0.05e18));

        expect(eval({complete: false})).to.eql({ethYield: -0.05, govShare: 100});

        // depositTooLow -> Contract is bricked
        expectThrow(() => pool.deposit({value: BigInt(1000e18)}), errTypes.depositTooLow);
        expectThrow(() => pool.deposit({value: 0n}), errTypes.emptyDeposit);
    });
});

// Geometric series:
// let q=2; let n =9; (1-Math.pow(q,n+1))/(1-q)
// let n=9; (Math.pow(2,n+1)-1)
