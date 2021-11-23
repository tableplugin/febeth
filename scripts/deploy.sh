#!/bin/bash
set -ex

# Deploy
truffle migrate --reset --network celoMainnet

# Verify code on bscscan.com
#truffle run verify BinPool --network binanceMainnet --debug
#truffle run verify BinGov --network binanceMainnet --debug
