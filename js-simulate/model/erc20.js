const assert = require('assert');

exports.ERC20 = class {
    _ethBalance = BigInt(0);
    _totalSupply = BigInt(0);
    _balances = {};
    totalSupply() {
        return this._totalSupply;
    };
    balanceOf(address) {
        const balance = this._balances[address];
        if (balance === undefined) {
            return BigInt(0);
        } else {
            return balance;
        }
    };
    ethBalance() {
        return this._ethBalance;
    };
    _mint(account, amount) {
        assert(account, "ERC20: mint to the zero address");

        this._totalSupply += amount;
        this._balances[account] = this.balanceOf(account) + amount;
        //emit Transfer(address(0), account, amount);
    };
    _transfer(sender, recipient, amount) {
        assert(sender, "ERC20: transfer from the zero address");
        assert(recipient, "ERC20: transfer to the zero address");

        assert(this.balanceOf(sender) >= amount, "ERC20: transfer amount exceeds balance");
        this._balances[sender] = this.balanceOf(sender) - amount;
        this._balances[recipient] = this.balanceOf(recipient) + amount;
        //emit Transfer(sender, recipient, amount);
    };
    _burn(account, amount) {
        assert(account, "ERC20: burn from the zero address");

        assert(this.balanceOf(account) >= amount, "ERC20: burn amount exceeds balance");
        this._balances[account] = this.balanceOf(account) - amount;
        this._totalSupply -= amount;
        //emit Transfer(account, address(0), amount);
    };
};
