# ChainNotes - Decentralized Notes App

A premium, decentralized note-taking application built with Solidity, React, Ethers.js, and Tailwind CSS.

## Project Structure

- `/contracts` - Solidity smart contracts
- `/migrations` - Truffle deployment scripts
- `/client` - React frontend application

## Prerequisites

- Node.js
- Truffle (`npm install -g truffle`)
- Ganache (CLI or GUI)
- MetaMask browser extension

## Smart Contract Setup

1. Start your local blockchain (Ganache) on port 8545 (or update `truffle-config.js` to match your port).
2. Compile and deploy the smart contracts:
   ```bash
   truffle migrate --reset
   ```

### Linking the ABI to React

The `truffle-config.js` is configured with `contracts_build_directory: path.join(__dirname, "client/src/contracts")`.
This means that when you run `truffle compile` or `truffle migrate`, the compiled JSON ABI files are automatically saved directly into the React frontend's `src/contracts` folder.

In `App.jsx`, we simply import it like this:

```javascript
import ChainNotesABI from "./contracts/ChainNotes.json";
```

Ethers.js uses this ABI and the dynamically fetched network ID to connect to the deployed contract.

## Frontend Setup

1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

## Usage

1. Open `http://localhost:3000` in your browser.
2. Connect your MetaMask wallet (ensure it's connected to your local Ganache network or Sepolia if deployed there).
3. Start creating, editing, and deleting your decentralized notes!
