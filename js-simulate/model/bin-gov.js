const assert = require('assert');
const {ERC20} = require("./erc20");






exports.BinGov = class extends ERC20 {

    // address public binPool;
    // constructor(address _binPool) ERC20Detailed("BinomialGovernance", "BINGOV", 18) public {
    //     binPool = _binPool;
    // }

    airdropCounter = 0n;

    INITIAL_HALVING = BigInt(500e18);

    airdropState(x) {
        let lastHalving = 0n;
        let nextHalving = this.INITIAL_HALVING;
        let inverseMiningRate = 1n;
        let numberOfHalvings = 0n;
        while (nextHalving < x) {
            inverseMiningRate = inverseMiningRate * 2n;
            numberOfHalvings = numberOfHalvings + 1n;
            const interval = (nextHalving - lastHalving) * 2n;
            lastHalving = nextHalving;
            nextHalving = lastHalving + interval;
        }
        return {lastHalving, nextHalving, inverseMiningRate, numberOfHalvings};
    }

    getLastHalving() {
        const { lastHalving } = this.airdropState(this.airdropCounter);
        return lastHalving;
    }

    getNextHalving() {
        const { nextHalving } = this.airdropState(this.airdropCounter);
        return nextHalving;
    }

    getInverseMiningRate() {
        const { inverseMiningRate } = this.airdropState(this.airdropCounter);
        return inverseMiningRate;
    }

    getNumberOfHalvings() {
        const { numberOfHalvings } = this.airdropState(this.airdropCounter);
        return numberOfHalvings;
    }

    f(x) {
        const {lastHalving, nextHalving, numberOfHalvings} = this.airdropState(x);
        const y = numberOfHalvings * this.INITIAL_HALVING;
        return y + this.INITIAL_HALVING * (x - lastHalving) / (nextHalving - lastHalving);
    }

    mintAirdrop(to, dX, msg) {
        //assert(msg.from === 0x111, "FORBIDDEN");

        const xNew = this.airdropCounter + dX;
        const oldSupply = this.totalSupply();
        const newSupply = this.f(xNew);
        const airdropAmount = newSupply - oldSupply;

        this.airdropCounter = xNew;
        this._mint(to, airdropAmount);
        return xNew;
    };
};
