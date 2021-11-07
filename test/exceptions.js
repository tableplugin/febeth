module.exports.errTypes = {
    emptyDeposit: "EMPTY_DEPOSIT",
    depositTooLow: "DEPOSIT_TOO_LOW",
    notEnoughShares: "NOT_ENOUGH_SHARES",
    betTooWeak: "BET_TOO_WEAK",
    tooHigh: "TOO_HIGH",
    tooLow: "TOO_LOW",
    forbidden: "FORBIDDEN",
    noUnclaimedTaxes: "NO_UNCLAIMED_TAXES",
    betValueTooHigh: "BET_VALUE_TOO_HIGH",
    unsupportedPaymentOp: "VALUE_LAST_DIGIT_UNSUPPORTED",
    noContractBetting: "NO_CONTRACT_BETTING",
    emptyBet: "EMPTY_BET",
    outOfGas: "out of gas",
    invalidJump: "invalid JUMP",
    invalidOpcode: "invalid opcode",
    stackOverflow: "stack overflow",
    stackUnderflow: "stack underflow",
    staticStateChange: "static state change"
};

module.exports.expectThrow = async function (promise, errType) {
    try {
        await promise;
    } catch (error) {
        assert(error, "Expected an error but did not get one");
        const expectIncludes = errType;
        assert(error.message.includes(expectIncludes), "Expected an error with '" + expectIncludes + "' but got '" + error.message + "' instead");
        return;
    }
    assert.fail('Expected throw not received');
};
