// lib/abi.ts

// Minimal ERC-20 ABI (just what we need)
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// Minimal FinePool ABI matching your FinePool.sol
export const FINEPOOL_ABI = [
  "function reserve0() view returns (uint112)",
  "function reserve1() view returns (uint112)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",

  // swaps
  "function swapExact0For1(uint256 amount0In, uint256 min1Out) returns (uint256)",
  "function swapExact1For0(uint256 amount1In, uint256 min0Out) returns (uint256)",
];
