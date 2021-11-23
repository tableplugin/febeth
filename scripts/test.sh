#!/bin/bash
set -ex

/usr/bin/node node_modules/mocha/bin/mocha js-simulate/*.js

truffle test

# Operations:
#truffle console --network binanceMainnet
#truffle console --network celoMainnet
#pool = await BinPool.deployed()

#await pool.sendTransaction({value: 9e16}) // deposit
#await pool.transfer(pool.address, web3.utils.toBN("1000000000000000000"), {from: accounts[0]}) // withdraw
#await pool.sendTransaction({value: 5e12}) // bet

#Value locked: await web3.eth.getBalance(pool.address)
#Number of shares: await pool.totalSupply()
#Transfer Binance: await web3.eth.sendTransaction({from:"0x1419650898159D9A3Fc30e54DE9a4156bC2e525f",to:"0x1e20014ef9a4ca5a888bb025c78e84fea7069995",value:100000000000000000})
#Transfer Celo: await web3.eth.sendTransaction({from:"0x1419650898159D9A3Fc30e54DE9a4156bC2e525f",to:"0x2fa630a3a8ab99e760d6dc56d5c436f4fb8a42bb",value:900000000000000})
