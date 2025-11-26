// lib/web3.ts
import { ethers } from "ethers";
import { FINEPOOL_ABI, ERC20_ABI } from "./abi";

// ===== Addresses =====
export const FINE5_ADDRESS =
  "0x0FB987BEE67FD839cb1158B0712d5e4Be483dd2E";
export const FINE6_ADDRESS =
  "0xe051C1eA47b246c79f3bac4e58E459cF2Aa20692";
export const POOL_ADDRESS =
  "0x0Bf78f76c86153E433dAA5Ac6A88453D30968e27";

// RPC from .env.local
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

function ensureRpcUrl(): string {
  if (!RPC_URL) {
    throw new Error("NEXT_PUBLIC_RPC_URL is not set in .env.local");
  }
  return RPC_URL;
}

// ===== Providers & Contracts =====

export function getRpcProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(ensureRpcUrl());
}

export function getPoolContract(
  providerOrSigner: ethers.Provider | ethers.Signer
) {
  return new ethers.Contract(POOL_ADDRESS, FINEPOOL_ABI, providerOrSigner);
}

export function getErc20(
  address: string,
  providerOrSigner: ethers.Provider | ethers.Signer
) {
  return new ethers.Contract(address, ERC20_ABI, providerOrSigner);
}

// Browser provider for MetaMask
export function getBrowserProvider(): ethers.BrowserProvider {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("No injected Ethereum provider (MetaMask not found)");
  }
  return new ethers.BrowserProvider((window as any).ethereum);
}

export async function getSigner(): Promise<ethers.JsonRpcSigner> {
  const provider = getBrowserProvider();
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

// ===== Data types =====

export type Reserves = {
  reserve0: number;
  reserve1: number;
  k: number;
  totalSupply: number;
};

export type LPAnalysis = {
  lpBalance: number;
  poolSharePct: number;
  underlying0: number;
  underlying1: number;
};

export type SwapDirection = "0to1" | "1to0";

export type SwapResult = {
  hash: string;
};

// ===== Read functions (for dashboard) =====

export async function fetchOnchainReserves(): Promise<Reserves> {
  const provider = getRpcProvider();
  const pool = getPoolContract(provider);

  const [r0, r1, totalSupply] = await Promise.all([
    pool.reserve0(),
    pool.reserve1(),
    pool.totalSupply(),
  ]);

  const reserve0 = Number(r0);
  const reserve1 = Number(r1);
  const k = reserve0 * reserve1;

  return {
    reserve0,
    reserve1,
    k,
    totalSupply: Number(totalSupply),
  };
}

export async function analyzeLPPosition(
  wallet: string
): Promise<LPAnalysis | null> {
  if (!wallet) return null;

  const provider = getRpcProvider();
  const pool = getPoolContract(provider);

  const [lpBalanceBN, totalSupplyBN, r0, r1] = await Promise.all([
    pool.balanceOf(wallet),
    pool.totalSupply(),
    pool.reserve0(),
    pool.reserve1(),
  ]);

  const lpBalance = Number(lpBalanceBN);
  const totalSupply = Number(totalSupplyBN);

  if (lpBalance === 0 || totalSupply === 0) {
    return {
      lpBalance: 0,
      poolSharePct: 0,
      underlying0: 0,
      underlying1: 0,
    };
  }

  const share = lpBalance / totalSupply;
  const reserve0 = Number(r0);
  const reserve1 = Number(r1);

  return {
    lpBalance,
    poolSharePct: share * 100,
    underlying0: reserve0 * share,
    underlying1: reserve1 * share,
  };
}

// ===== Live swap function =====

export async function executeSwap(
  direction: SwapDirection,
  amountIn: number,
  maxSlippagePct: number
): Promise<SwapResult> {
  if (amountIn <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  const signer = await getSigner();
  const signerAddress = await signer.getAddress();

  const pool = getPoolContract(signer);
  const readOnlyPool = getPoolContract(await signer.provider!);

  // assume 18 decimals for FINE5/FINE6
  const amountInWei = ethers.parseUnits(amountIn.toString(), 18);

  // figure out which token is input
  const inTokenAddress = direction === "0to1" ? FINE5_ADDRESS : FINE6_ADDRESS;
  const inToken = getErc20(inTokenAddress, signer);

  // 1) ensure allowance
  const currentAllowance: bigint = await inToken.allowance(
    signerAddress,
    POOL_ADDRESS
  );

  if (currentAllowance < amountInWei) {
    const approveTx = await inToken.approve(POOL_ADDRESS, amountInWei);
    await approveTx.wait();
  }

  // 2) compute minOut based on current reserves & slippage
  const [r0, r1] = await Promise.all([
    readOnlyPool.reserve0(),
    readOnlyPool.reserve1(),
  ]);

  const reserveIn: bigint = direction === "0to1" ? r0 : r1;
  const reserveOut: bigint = direction === "0to1" ? r1 : r0;

  const feeNum = 997n;
  const feeDen = 1000n;

  const amountInWithFee = (amountInWei * feeNum) / feeDen;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  const amountOut = numerator / denominator;

  if (amountOut <= 0n) {
    throw new Error("Amount out is zero – check reserves and amount");
  }

  const slippageBps = Math.round(maxSlippagePct * 100); // 1% => 100 bps
  const minOut = (amountOut * BigInt(10000 - slippageBps)) / 10000n;

  // 3) call the correct swap function
  let tx;
  if (direction === "0to1") {
    tx = await pool.swapExact0For1(amountInWei, minOut);
  } else {
    tx = await pool.swapExact1For0(amountInWei, minOut);
  }

  await tx.wait();
  return { hash: tx.hash };
}
