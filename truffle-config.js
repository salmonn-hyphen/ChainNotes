const path = require("path");

module.exports = {
  // This automatically links the compiled JSON ABI to the React /src folder
  contracts_build_directory: path.join(__dirname, "client/src/contracts"),

  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545, // Ganache CLI uses 8545, GUI usually uses 7545
      network_id: "*", // Match any network id
    },
    // sepolia: {
    //   provider: () => new HDWalletProvider(MNEMONIC, `https://sepolia.infura.io/v3/${PROJECT_ID}`),
    //   network_id: 11155111,
    //   confirmations: 2,
    //   timeoutBlocks: 200,
    //   skipDryRun: true
    // }
  },

  compilers: {
    solc: {
      version: "0.8.19", // Fetch exact version from solc-bin
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        evmVersion: "paris",
      },
    },
  },
};
