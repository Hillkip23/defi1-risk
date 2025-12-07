DeFi Risk Dashboard — Live Swaps, LP Analytics & On-Chain Risk Metrics

A complete DeFi visual dashboard built with Next.js + TypeScript, connected to deployed smart contracts on Ethereum Sepolia Testnet.
It provides real-time swap execution, liquidity analytics, and risk metrics for DeFi positions.

🚀 Live App:
https://defi1-risk-3s82-j18d9d8ie-hillkip25s-projects.vercel.app/

🔗 Smart Contracts (Verified on Routescan):

Token Contract: 0x0FB987BEE67FD839cb1158B0712d5e4Be483dd2E

Swap / Liquidity Contract: 0xe051C1eA47b246c79f3bac4e58E459cF2Aa20692

Risk Manager Contract: 0x0Bf78f76c86153E433dAA5Ac6A88453D30968e27

🌐 Project Overview

This dashboard visualizes a user’s DeFi exposure across liquidity pools, swaps, and strategy allocations.

Core Features

🔄 Live token swap interface

📊 Real-time risk dashboard

📈 Charts for LP positions, PnL, exposure, token allocation

🧮 Price updates from smart contract reserves

🛠 Built using Next.js App Router + TypeScript

🧱 Architecture Overview
Frontend (Next.js / TS)
│
├─ Reads smart contract state (balances, reserves, LP ratios)
├─ Executes swaps via AMM contract
├─ Shows risk analytics (PnL, exposure, IL)
└─ Uses wagmi + ethers for on-chain data

Smart Contracts (Solidity)
│
├─ ERC-20 Token Contract
├─ Liquidity & Swap Contract (AMM)
└─ Risk Manager Contract (position accounting & analytics)

📂 Repository Structure
app/
  ├─ dashboard UI
  ├─ swap UI
  ├─ charts & visualizations
lib/
  ├─ blockchain helpers (ethers / wagmi)
  ├─ contract ABIs
public/
  ├─ static assets

🔧 Running Locally
1. Install dependencies
npm install

2. Create .env.local
NEXT_PUBLIC_RPC_URL="https://sepolia.infura.io/v3/ec868129390f4ee3b4c27d2a93ffb796"
NEXT_PUBLIC_TOKEN_ADDRESS="0x0FB987BEE67FD839cb1158B0712d5e4Be483dd2E"
NEXT_PUBLIC_SWAP_ADDRESS="0xe051C1eA47b246c79f3bac4e58E459cF2Aa20692"
NEXT_PUBLIC_RISK_ADDRESS="0x0Bf78f76c86153E433dAA5Ac6A88453D30968e27"

4. Start dev server
npm run dev

📊 Risk Dashboard Features

Portfolio allocation visualization

Exposure % and leverage equivalents

PnL tracking

LP impermanent loss estimation

Slippage & price impact analysis

🔄 Swap Engine

Supports:

Exact input swaps

Slippage control

Price updates using AMM reserves

Wallet-connected execution

📦 Tech Stack

Next.js 14

TypeScript

Ethers.js + Wagmi

TailwindCSS

Recharts

🚀 Deployment

Automatic Vercel deployment on every git push:

git push origin main

🗺️ Roadmap

LP Impermanent Loss calculator

Multi-strategy simulations

Event-based real-time updates

Dark mode

🤝 Contributing

Pull requests and issues welcome.

📜 License

MIT
