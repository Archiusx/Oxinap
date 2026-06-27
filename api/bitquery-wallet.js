// api/bitquery-wallet.js — Vercel Serverless (Node 18+)
// BitQuery V2 OAuth2 + GraphQL wallet intelligence
// POST /api/bitquery-wallet  { "address": "0x...", "chain": "ETH" }
// Returns: { chain, address, balance, recentTxs, fundFlow, caseId, scannedAt }

export const config = { maxDuration: 30 };

// ── Token cache (module-level, survives warm Lambda re-use) ──────────────────
let _token = null;
let _tokenExpiry = 0; // epoch ms

async function getBitQueryToken() {
  const now = Date.now();
  if (_token && now < _tokenExpiry - 60_000) return _token; // 1 min buffer

  const CLIENT_ID     = process.env.BITQUERY_CLIENT_ID;
  const CLIENT_SECRET = process.env.BITQUERY_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("BITQUERY_CLIENT_ID / BITQUERY_CLIENT_SECRET not set");

  const res = await fetch("https://oauth2.bitquery.io/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         "api",
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`BitQuery OAuth failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  _token       = data.access_token;
  // expires_in is in seconds; default 24h = 86400s
  _tokenExpiry = now + (data.expires_in ?? 86400) * 1000;
  return _token;
}

// ── BitQuery GraphQL helper ──────────────────────────────────────────────────
async function bqQuery(token, query, variables = {}) {
  const res = await fetch("https://streaming.bitquery.io/eap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`BitQuery query failed ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// ── Chain-specific queries ───────────────────────────────────────────────────

// ETH (EVM)
const ETH_QUERY = `
query EthWallet($addr: String!) {
  EVM(network: eth) {
    TokenHolderStatistics(
      where: { Holder: { Address: { is: $addr } } }
      limit: { count: 1 }
    ) {
      Holder { Address }
      Balance { Amount Currency { Symbol Name } }
    }
    Transfers(
      where: {
        any: [
          { Transfer: { Sender: { is: $addr } } }
          { Transfer: { Receiver: { is: $addr } } }
        ]
      }
      limit: { count: 10 }
      orderBy: { descending: Block_Time }
    ) {
      Block { Time }
      Transaction { Hash }
      Transfer {
        Sender Receiver
        Amount
        Currency { Symbol }
        Direction
      }
    }
  }
}`;

// BTC
const BTC_QUERY = `
query BtcWallet($addr: String!) {
  BTC(network: bitcoin) {
    Inputs(
      where: { Input: { Address: { Address: { is: $addr } } } }
      limit: { count: 10 }
      orderBy: { descending: Block_Time }
    ) {
      Block { Time }
      Transaction { Hash }
      Input { Amount Address { Address } }
    }
    Outputs(
      where: { Output: { Address: { Address: { is: $addr } } } }
      limit: { count: 10 }
      orderBy: { descending: Block_Time }
    ) {
      Block { Time }
      Transaction { Hash }
      Output { Amount Address { Address } }
    }
  }
}`;

// TRX
const TRX_QUERY = `
query TrxWallet($addr: String!) {
  Tron(network: tron) {
    Transfers(
      where: {
        any: [
          { Transfer: { Sender: { is: $addr } } }
          { Transfer: { Receiver: { is: $addr } } }
        ]
      }
      limit: { count: 10 }
      orderBy: { descending: Block_Time }
    ) {
      Block { Time }
      Transaction { Hash }
      Transfer {
        Sender Receiver
        Amount
        Currency { Symbol }
        Direction
      }
    }
  }
}`;

// SOL
const SOL_QUERY = `
query SolWallet($addr: String!) {
  Solana(network: solana) {
    Transfers(
      where: {
        any: [
          { Transfer: { Sender: { is: $addr } } }
          { Transfer: { Receiver: { is: $addr } } }
        ]
      }
      limit: { count: 10 }
      orderBy: { descending: Block_Time }
    ) {
      Block { Time }
      Transaction { Signature }
      Transfer {
        Sender Receiver
        Amount
        Currency { Symbol }
        Direction
      }
    }
  }
}`;

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseEth(data, address) {
  const transfers = data?.EVM?.Transfers || [];
  const tokenStats = data?.EVM?.TokenHolderStatistics || [];

  // Balance from TokenHolderStatistics (native ETH)
  const ethBal = tokenStats.find(t => t?.Balance?.Currency?.Symbol === "ETH");
  const balance = ethBal ? `${parseFloat(ethBal.Balance.Amount).toFixed(6)} ETH` : "See Etherscan";

  const txs = transfers.map(t => ({
    hash:      t.Transaction?.Hash || "",
    time:      t.Block?.Time ? new Date(t.Block.Time).toLocaleString() : "—",
    from:      t.Transfer?.Sender || "",
    to:        t.Transfer?.Receiver || "",
    value:     `${parseFloat(t.Transfer?.Amount || 0).toFixed(6)} ${t.Transfer?.Currency?.Symbol || "ETH"}`,
    direction: t.Transfer?.Direction || (t.Transfer?.Sender?.toLowerCase() === address.toLowerCase() ? "out" : "in"),
    url:       `https://etherscan.io/tx/${t.Transaction?.Hash}`,
  }));

  // Fund flow: unique counterparties
  const fundFlow = buildFundFlow(txs, address);
  return { balance, txs, fundFlow };
}

function parseBtc(data, address) {
  const inputs  = data?.BTC?.Inputs  || [];
  const outputs = data?.BTC?.Outputs || [];

  // Combine and sort by time
  const all = [
    ...inputs.map(i  => ({ hash: i.Transaction?.Hash, time: i.Block?.Time, amount: i.Input?.Amount,  direction: "in",  from: i.Input?.Address?.Address,  to: address })),
    ...outputs.map(o => ({ hash: o.Transaction?.Hash, time: o.Block?.Time, amount: o.Output?.Amount, direction: "out", from: address, to: o.Output?.Address?.Address })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

  const totalIn  = inputs.reduce((s, i)  => s + parseFloat(i.Input?.Amount  || 0), 0);
  const totalOut = outputs.reduce((s, o) => s + parseFloat(o.Output?.Amount || 0), 0);
  const balance  = `${(totalIn - totalOut).toFixed(8)} BTC`;

  const txs = all.map(t => ({
    hash:      t.hash || "",
    time:      t.time ? new Date(t.time).toLocaleString() : "—",
    from:      t.from || "",
    to:        t.to   || "",
    value:     `${parseFloat(t.amount || 0).toFixed(8)} BTC`,
    direction: t.direction,
    url:       `https://blockstream.info/tx/${t.hash}`,
  }));

  const fundFlow = buildFundFlow(txs, address);
  return { balance, txs, fundFlow };
}

function parseTrx(data, address) {
  const transfers = data?.Tron?.Transfers || [];
  const txs = transfers.map(t => ({
    hash:      t.Transaction?.Hash || "",
    time:      t.Block?.Time ? new Date(t.Block.Time).toLocaleString() : "—",
    from:      t.Transfer?.Sender   || "",
    to:        t.Transfer?.Receiver || "",
    value:     `${parseFloat(t.Transfer?.Amount || 0).toFixed(2)} ${t.Transfer?.Currency?.Symbol || "TRX"}`,
    direction: t.Transfer?.Direction || (t.Transfer?.Sender === address ? "out" : "in"),
    url:       `https://tronscan.org/#/transaction/${t.Transaction?.Hash}`,
  }));
  const fundFlow = buildFundFlow(txs, address);
  return { balance: "See Tronscan", txs, fundFlow };
}

function parseSol(data, address) {
  const transfers = data?.Solana?.Transfers || [];
  const txs = transfers.map(t => ({
    hash:      t.Transaction?.Signature || "",
    time:      t.Block?.Time ? new Date(t.Block.Time).toLocaleString() : "—",
    from:      t.Transfer?.Sender   || "",
    to:        t.Transfer?.Receiver || "",
    value:     `${parseFloat(t.Transfer?.Amount || 0).toFixed(6)} ${t.Transfer?.Currency?.Symbol || "SOL"}`,
    direction: t.Transfer?.Direction || (t.Transfer?.Sender === address ? "out" : "in"),
    url:       `https://solscan.io/tx/${t.Transaction?.Signature}`,
  }));
  const fundFlow = buildFundFlow(txs, address);
  return { balance: "See Solscan", txs, fundFlow };
}

// Build fund flow graph nodes + edges from tx list
function buildFundFlow(txs, address) {
  const addr = address.toLowerCase();
  const counterparties = {};

  for (const tx of txs) {
    const other = tx.direction === "out" ? tx.to : tx.from;
    if (!other || other.toLowerCase() === addr) continue;
    const key = other.toLowerCase();
    if (!counterparties[key]) counterparties[key] = { address: other, sent: 0, received: 0, txCount: 0 };
    if (tx.direction === "out") counterparties[key].sent     += 1;
    else                         counterparties[key].received += 1;
    counterparties[key].txCount += 1;
  }

  const nodes = [
    { id: "target", label: address.slice(0, 8) + "…" + address.slice(-6), type: "target" },
    ...Object.values(counterparties).slice(0, 12).map((cp, i) => ({
      id:    `cp_${i}`,
      label: cp.address.slice(0, 6) + "…" + cp.address.slice(-4),
      full:  cp.address,
      type:  cp.txCount > 3 ? "high" : "normal",
      txCount: cp.txCount,
    })),
  ];

  const edges = Object.values(counterparties).slice(0, 12).map((cp, i) => ({
    from:   cp.sent > 0     ? "target" : `cp_${i}`,
    to:     cp.received > 0 ? "target" : `cp_${i}`,
    source: "target",
    target: `cp_${i}`,
    sent:     cp.sent,
    received: cp.received,
  }));

  return { nodes, edges };
}

// Generate unique case ID
function genCaseId(address, chain) {
  const ts   = Date.now().toString(36).toUpperCase();
  const slug = address.slice(0, 4).toUpperCase();
  return `CW-${chain}-${slug}-${ts}`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { address, chain } = req.body || {};
  if (!address || !chain) {
    return res.status(400).json({ error: "address and chain required" });
  }

  const SUPPORTED = ["ETH", "BTC", "TRX", "SOL"];
  if (!SUPPORTED.includes(chain)) {
    return res.status(400).json({
      error: `Chain ${chain} not yet supported via BitQuery. Use explorer links.`,
      explorerOnly: true,
    });
  }

  let token;
  try {
    token = await getBitQueryToken();
  } catch (e) {
    return res.status(500).json({ error: `Auth failed: ${e.message}` });
  }

  const queryMap = { ETH: ETH_QUERY, BTC: BTC_QUERY, TRX: TRX_QUERY, SOL: SOL_QUERY };
  const parseMap = { ETH: parseEth,  BTC: parseBtc,  TRX: parseTrx,  SOL: parseSol  };

  let data;
  try {
    data = await bqQuery(token, queryMap[chain], { addr: address });
  } catch (e) {
    // Token may have been revoked mid-session — force refresh once
    if (e.message.includes("401") || e.message.includes("403")) {
      _token = null;
      try {
        token = await getBitQueryToken();
        data  = await bqQuery(token, queryMap[chain], { addr: address });
      } catch (e2) {
        return res.status(502).json({ error: `BitQuery error: ${e2.message}` });
      }
    } else {
      return res.status(502).json({ error: `BitQuery error: ${e.message}` });
    }
  }

  const { balance, txs, fundFlow } = parseMap[chain](data, address);
  const caseId = genCaseId(address, chain);

  return res.status(200).json({
    caseId,
    chain,
    address,
    balance,
    recentTxs:  txs,
    fundFlow,
    scannedAt:  new Date().toISOString(),
    txCount:    txs.length,
  });
}
