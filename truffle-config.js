require('dotenv').config();
const path = require("path");
const HDWalletProvider = require('@truffle/hdwallet-provider');

// Dev address: 0x1419650898159D9A3Fc30e54DE9a4156bC2e525f
const bscMainnetProvider = new HDWalletProvider({
  mnemonic: process.env.DEV_MNEMONIC,
  providerOrUrl: 'https://bsc-dataseed.binance.org/'
});
const bscTestnetProvider = new HDWalletProvider({
  mnemonic: process.env.DEV_MNEMONIC,
  providerOrUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/'
});
const celoMainnetProvider = new HDWalletProvider({
  mnemonic: process.env.DEV_MNEMONIC,
  providerOrUrl: 'https://forno.celo.org/'
});

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  contracts_build_directory: path.join(__dirname, "app/src/contracts"),
  networks: {
    ganache: { // default with truffle unbox is 7545, but we can use develop to test changes, ex. truffle migrate --network develop
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },
    celoMainnet: {
      provider: () => celoMainnetProvider,
      network_id: "42220",
      gas: 10000000,
      gasPrice: 10000000000,
    },
    binanceMainnet: {
      provider: () => bscMainnetProvider,
      network_id: "56",
      gas: 10000000,
      gasPrice: 10000000000,
    },
    binanceTestnet: {
      provider: () => bscTestnetProvider,
      network_id: "97",
      gas: 10000000,
      gasPrice: 10000000000,
    }
  },
  mocha: {
    enableTimeouts: false,
    timeout: 100000000,
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: 'RFYMRGRGSJ9P8FH52EKAEI9P5FX12JIJHS'
  }
};
