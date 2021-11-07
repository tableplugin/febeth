const assert = require('assert');

exports.expectThrow = function (fct, errType) {
    try {
        fct();
    } catch (error) {
        assert(error, "Expected an error but did not get one");
        const expectIncludes = errType;
        assert(error.message.includes(expectIncludes), "Expected an error with '" + expectIncludes + "' but got '" + error.message + "' instead");
        return;
    }
    assert.fail('Expected throw not received');
};
