#!/bin/bash
set -ex

/usr/bin/node node_modules/mocha/bin/mocha js-simulate/*.js

truffle test

# Operations:
#truffle console --network binanceMainnet
#pool = await BinPool.deployed()

#await pool.sendTransaction({value: 9e16}) // deposit
#await pool.transfer(pool.address, web3.utils.toBN("1000000000000000000"), {from: accounts[0]}) // withdraw
#await pool.sendTransaction({value: 5e12}) // bet

#Value locked: await web3.eth.getBalance(pool.address)
#Number of shares: await pool.totalSupply()
#Transfer to Binance HotWallet: await web3.eth.sendTransaction({from:"0x1419650898159D9A3Fc30e54DE9a4156bC2e525f",to:"0x1e20014ef9a4ca5a888bb025c78e84fea7069995",value:100000000000000000})
