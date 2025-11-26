"use client";

import { useEffect, useState } from "react";
import {
  fetchOnchainReserves,
  analyzeLPPosition,
  executeSwap,
  SwapDirection,
} from "../lib/web3";

// charts
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

// ----- AMM math -----
const FEE_NUM = 997; // 0.3% fee like Uniswap
const FEE_DEN = 1000;

function getSwapOutput(
  reserveIn: number,
  reserveOut: number,
  amountIn: number
) {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) {
    return 0;
  }

  const amountInWithFee = (amountIn * FEE_NUM) / FEE_DEN;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  const amountOut = numerator / denominator;

  return amountOut;
}

function getPriceImpactPercent(
  reserveIn: number,
  reserveOut: number,
  amountIn: number
) {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) {
    return 0;
  }

  const spotPrice = reserveOut / reserveIn;
  const amountOut = getSwapOutput(reserveIn, reserveOut, amountIn);
  const executionPrice = amountOut / amountIn;

  const impact = (executionPrice - spotPrice) / spotPrice;
  return impact * 100;
}

function getImpermanentLossPercent(priceChangePct: number) {
  // standard x*y=k IL approximation where token A moves vs token B
  const p = 1 + priceChangePct / 100; // new price = p
  if (p <= 0) return 0;

  const hodlValue = (p + 1) / 2;
  const lpValue = Math.sqrt(p);
  const il = (lpValue / hodlValue - 1) * 100;
  return il;
}

// ----- React component -----

export default function Home() {
  // pool state
  const [reserve0, setReserve0] = useState(101131);
  const [reserve1, setReserve1] = useState(99493);
  const [k, setK] = useState(reserve0 * reserve1);
  const [totalSupply, setTotalSupply] = useState(0);
  const [reserveSource, setReserveSource] = useState<
    "demo" | "onchain" | "error"
  >("onchain");

  // swap inputs
  const [direction, setDirection] = useState<SwapDirection>("0to1");
  const [amountIn, setAmountIn] = useState("100");
  const [amountOut, setAmountOut] = useState<number | null>(null);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);

  // IL scenario
  const [priceChangePct, setPriceChangePct] = useState("50");
  const [ilResult, setIlResult] = useState<number | null>(null);

  // LP analyzer
  const [lpAddress, setLpAddress] = useState(
    "0x581EE242cF8e8889E2fa37Bd7C2716d788f051af"
  );
  const [lpBalance, setLpBalance] = useState<number | null>(null);
  const [lpSharePct, setLpSharePct] = useState<number | null>(null);
  const [lpUnderlying0, setLpUnderlying0] = useState<number | null>(null);
  const [lpUnderlying1, setLpUnderlying1] = useState<number | null>(null);
  const [lpStatus, setLpStatus] = useState<string>("");

  // wallet + swap execution
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<string>("");
  const [swapStatus, setSwapStatus] = useState<string>("");
  const [swapLoading, setSwapLoading] = useState(false);

  // ----- load reserves on mount -----
  useEffect(() => {
    async function loadReserves() {
      try {
        const r = await fetchOnchainReserves();
        setReserve0(r.reserve0);
        setReserve1(r.reserve1);
        setK(r.k);
        setTotalSupply(r.totalSupply);
        setReserveSource("onchain");
      } catch (err) {
        console.error(err);
        setReserveSource("error");
      }
    }
    loadReserves();
  }, []);

  // ----- swap calculator (local) -----
  function handleCalculateRisk() {
    const amt = Number(amountIn);
    if (isNaN(amt) || amt <= 0) {
      setAmountOut(null);
      setPriceImpact(null);
      return;
    }

    const [reserveIn, reserveOut] =
      direction === "0to1" ? [reserve0, reserve1] : [reserve1, reserve0];

    const out = getSwapOutput(reserveIn, reserveOut, amt);
    const impact = getPriceImpactPercent(reserveIn, reserveOut, amt);

    setAmountOut(out);
    setPriceImpact(impact);
  }

  const safetyLabel = (() => {
    if (priceImpact === null) return "";
    const absImpact = Math.abs(priceImpact);
    if (absImpact < 1) return "Excellent";
    if (absImpact < 3) return "Good";
    if (absImpact < 10) return "Caution";
    return "High Risk";
  })();

  // ----- wallet connect + swap execution -----

  async function handleConnectWallet() {
    setWalletStatus("");
    try {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        setWalletStatus("MetaMask not found in this browser.");
        return;
      }

      const ethereum = (window as any).ethereum;
      const accounts: string[] = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        setWalletStatus("No accounts found in MetaMask.");
        return;
      }

      setWalletAddress(accounts[0]);
      setWalletStatus("Connected to MetaMask.");
    } catch (err: any) {
      console.error(err);
      setWalletStatus(err?.message ?? "Failed to connect wallet.");
    }
  }

  async function handleExecuteSwap() {
    setSwapStatus("");
    const amt = Number(amountIn);
    if (isNaN(amt) || amt <= 0) {
      setSwapStatus("Enter a valid amount first.");
      return;
    }

    try {
      setSwapLoading(true);
      setSwapStatus("Sending transaction... (approve + swap)");

      // 1% max slippage
      const result = await executeSwap(direction, amt, 1.0);
      setSwapStatus(
        `Swap executed! Tx: ${result.hash.slice(0, 10)}... (check Etherscan)`
      );
    } catch (err: any) {
      console.error(err);
      setSwapStatus(`Swap failed: ${err?.message ?? String(err)}`);
    } finally {
      setSwapLoading(false);
    }
  }

  // ----- IL calculator -----
  function handleCalculateIL() {
    const pct = Number(priceChangePct);
    if (isNaN(pct)) {
      setIlResult(null);
      return;
    }
    const il = getImpermanentLossPercent(pct);
    setIlResult(il);
  }

  // ----- LP analyzer -----
  async function handleAnalyzeLP() {
    setLpStatus("");
    try {
      const res = await analyzeLPPosition(lpAddress.trim());
      if (!res) {
        setLpStatus("Enter a valid wallet address.");
        return;
      }

      setLpBalance(res.lpBalance);
      setLpSharePct(res.poolSharePct);
      setLpUnderlying0(res.underlying0);
      setLpUnderlying1(res.underlying1);
      setLpStatus("");
    } catch (err: any) {
      console.error(err);
      setLpStatus(err?.message ?? "Failed to analyze LP position.");
    }
  }

  // ----- chart data -----

  // price impact vs trade size (Token A -> B, up to 30% of reserve0)
  const impactLabels: string[] = [];
  const impactValues: number[] = [];
  if (reserve0 > 0 && reserve1 > 0) {
    const maxTrade = reserve0 * 0.3;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const amt = (maxTrade * i) / steps;
      impactLabels.push(amt.toFixed(0));
      impactValues.push(
        getPriceImpactPercent(reserve0, reserve1, amt)
      );
    }
  }
  const priceImpactData = {
    labels: impactLabels,
    datasets: [
      {
        label: "Price impact (%)",
        data: impactValues,
      },
    ],
  };

  // IL vs price change
  const ilLabels: string[] = [];
  const ilValues: number[] = [];
  for (let pct = -50; pct <= 200; pct += 25) {
    ilLabels.push(`${pct}%`);
    ilValues.push(getImpermanentLossPercent(pct));
  }
  const ilChartData = {
    labels: ilLabels,
    datasets: [
      {
        label: "Impermanent loss (%)",
        data: ilValues,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-black text-white flex justify-center px-4 py-10">
      <div className="w-full max-w-4xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">
            DeFi Risk Dashboard – Swap Risk Analyzer
          </h1>
          <p className="text-sm text-gray-300">
            Constant-product AMM math (x · y = k) with a 0.3% fee. Reserves
            are pulled from your FinePool on Sepolia when available.
          </p>
        </header>

        {/* Pool reserves */}
        <section className="border border-gray-700 rounded-xl p-4 space-y-4 bg-zinc-900">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">Pool Reserves</h2>
            <div className="text-xs text-right text-gray-400">
              <div>
                k = x · y ≈ {k.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div>Total LP Supply: {totalSupply}</div>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Source:{" "}
            {reserveSource === "onchain"
              ? "On-chain (Sepolia)"
              : reserveSource === "error"
              ? "Local demo (failed to load on-chain reserves)"
              : "Local demo"}
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex flex-col gap-1">
              <label className="text-gray-300">Reserve0 (Token A)</label>
              <input
                className="bg-zinc-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                value={reserve0}
                onChange={(e) =>
                  setReserve0(Number(e.target.value) || 0)
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-300">Reserve1 (Token B)</label>
              <input
                className="bg-zinc-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                value={reserve1}
                onChange={(e) =>
                  setReserve1(Number(e.target.value) || 0)
                }
              />
            </div>
          </div>
        </section>

        {/* Swap inputs */}
        <section className="border border-gray-700 rounded-xl p-4 space-y-4 bg-zinc-900">
          <div className="flex justify-between items-center gap-4">
            <h2 className="font-semibold text-lg">Swap Inputs</h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={handleConnectWallet}
                className="px-3 py-1 rounded-lg border border-emerald-500 text-emerald-300 text-xs hover:bg-emerald-700/30"
              >
                {walletAddress
                  ? `Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(
                      -4
                    )}`
                  : "Connect Wallet"}
              </button>
            </div>
          </div>

          {walletStatus && (
            <p className="text-xs text-amber-300">{walletStatus}</p>
          )}

          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">
                Direction (which way are you swapping?)
              </label>
              <div className="flex gap-3 text-sm">
                <button
                  className={`px-3 py-1 rounded-lg border ${
                    direction === "0to1"
                      ? "bg-emerald-600 border-emerald-500"
                      : "border-gray-600"
                  }`}
                  onClick={() => setDirection("0to1")}
                >
                  Token A → Token B
                </button>
                <button
                  className={`px-3 py-1 rounded-lg border ${
                    direction === "1to0"
                      ? "bg-emerald-600 border-emerald-500"
                      : "border-gray-600"
                  }`}
                  onClick={() => setDirection("1to0")}
                >
                  Token B → Token A
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-300">Amount In</label>
              <input
                className="bg-zinc-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="100"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCalculateRisk}
                className="mt-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold"
              >
                Calculate Risk
              </button>
              <button
                onClick={handleExecuteSwap}
                disabled={swapLoading || !walletAddress}
                className={`mt-1 px-4 py-2 rounded-lg text-sm font-semibold ${
                  swapLoading || !walletAddress
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {swapLoading ? "Swapping..." : "Execute Swap On-Chain"}
              </button>
            </div>

            {swapStatus && (
              <p className="text-xs text-gray-200 mt-2">{swapStatus}</p>
            )}
          </div>
        </section>

        {/* Risk output */}
        <section className="border border-gray-700 rounded-xl p-4 space-y-4 bg-zinc-900">
          <h2 className="font-semibold text-lg">Risk Output</h2>

          {amountOut === null && priceImpact === null && (
            <p className="text-sm text-gray-400">
              Enter an amount and click <strong>Calculate Risk</strong> to
              see expected output and price impact.
            </p>
          )}

          {amountOut !== null && (
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-gray-400">Expected Output</div>
                <div className="font-mono text-base">
                  {amountOut.toFixed(6)}
                </div>
              </div>
              {priceImpact !== null && (
                <>
                  <div>
                    <div className="text-gray-400">Price Impact</div>
                    <div className="font-mono text-base">
                      {priceImpact.toFixed(4)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Swap Safety</div>
                    <div className="font-semibold">{safetyLabel}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Impermanent loss */}
        <section className="border border-gray-700 rounded-xl p-4 space-y-4 bg-zinc-900">
          <h2 className="font-semibold text-lg">
            Impermanent Loss Scenario (Token A price change)
          </h2>
          <p className="text-xs text-gray-400">
            Enter a hypothetical percentage change in Token A price relative to
            Token B (e.g. +50, -30). This approximates IL for a standard x·y=k
            AMM.
          </p>

          <div className="flex flex-col gap-2 max-w-md">
            <label className="text-sm text-gray-300">
              Token A price change (%)
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-zinc-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                value={priceChangePct}
                onChange={(e) => setPriceChangePct(e.target.value)}
              />
              <button
                onClick={handleCalculateIL}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold"
              >
                Calculate IL
              </button>
            </div>
          </div>

          {ilResult !== null && (
            <p className="text-sm text-gray-200">
              Impermanent Loss vs HODL:{" "}
              <span className="font-mono">
                {ilResult.toFixed(4)}%
              </span>
            </p>
          )}
        </section>

        {/* LP Position Analyzer */}
        <section className="border border-gray-700 rounded-xl p-4 space-y-4 bg-zinc-900">
          <h2 className="font-semibold text-lg">LP Position Analyzer</h2>
          <p className="text-xs text-gray-400">
            Enter any wallet address that holds F5F6-LP tokens on your
            FinePool contract. This estimates the underlying Token A and
            Token B in that position.
          </p>

          <div className="flex flex-col gap-2 max-w-2xl">
            <label className="text-sm text-gray-300">Wallet address</label>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-zinc-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                value={lpAddress}
                onChange={(e) => setLpAddress(e.target.value)}
                placeholder="0x..."
              />
              <button
                onClick={handleAnalyzeLP}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold"
              >
                Analyze LP Position
              </button>
            </div>
          </div>

          {lpStatus && (
            <p className="text-xs text-amber-300">{lpStatus}</p>
          )}

          {lpBalance !== null && (
            <div className="grid md:grid-cols-3 gap-4 text-sm mt-4">
              <div>
                <div className="text-gray-400">LP Token Balance</div>
                <div className="font-mono text-base">
                  {lpBalance.toFixed(6)}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Pool Share</div>
                <div className="font-mono text-base">
                  {lpSharePct?.toFixed(6)}%
                </div>
              </div>
              <div>
                <div className="text-gray-400">Underlying Tokens</div>
                <div className="font-mono text-base">
                  {lpUnderlying0?.toFixed(6)} A /{" "}
                  {lpUnderlying1?.toFixed(6)} B
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Visualizations */}
        <section className="border border-gray-700 rounded-xl p-4 space-y-4 bg-zinc-900">
          <h2 className="font-semibold text-lg">Visualizations</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Price Impact vs Trade Size (Token A → Token B)
              </h3>
              {impactValues.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Provide non-zero reserves to see this chart.
                </p>
              ) : (
                <Line
                  data={priceImpactData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      x: {
                        title: { display: true, text: "Trade size (Token A)" },
                      },
                      y: {
                        title: {
                          display: true,
                          text: "Price impact (%)",
                        },
                      },
                    },
                  }}
                />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Impermanent Loss vs Token A Price Change
              </h3>
              <Line
                data={ilChartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    x: {
                      title: {
                        display: true,
                        text: "Token A price change (%)",
                      },
                    },
                    y: {
                      title: {
                        display: true,
                        text: "Impermanent loss (%)",
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
