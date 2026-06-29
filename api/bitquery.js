// api/bitquery.js — Vercel Serverless (Node 18+)
// Merged: bitquery-token + bitquery-tx + bitquery-wallet → single function
//
// Routes via query param ?action=
//   POST /api/bitquery?action=token   { force? }
//   POST /api/bitquery?action=tx      { txHash, chain }
//   POST /api/bitquery?action=wallet  { address, chain }

export const config = { maxDuration: 300 };

// ── Shared token cache ────────────────────────────────────────────────────────
let _token       = null;
let _tokenExpiry = 0;

async function getBitQueryToken() {
  const now = Date.now();
  if (_token && now < _tokenExpiry - 60_000) return _token;

  const CLIENT_ID     = process.env.BITQUERY_CLIENT_ID;
  const CLIENT_SECRET = process.env.BITQUERY_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET)
    throw new Error("BITQUERY_CLIENT_ID / BITQUERY_CLIENT_SECRET not set");

  const res = await fetch("https://oauth2.bitquery.io/oauth2/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         "api",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`BitQuery OAuth failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data   = await res.json();
  _token       = data.access_token;
  _tokenExpiry = now + (data.expires_in ?? 86400) * 1000;
  return _token;
}

async function bqQuery(token, query, variables = {}, timeout = 22000) {
  const res = await fetch("https://streaming.bitquery.io/eap", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body:   JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`BitQuery query failed ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

async function withTokenRetry(fn) {
  try {
    const token = await getBitQueryToken();
    return await fn(token);
  } catch (e) {
    if (e.message.includes("401") || e.message.includes("403")) {
      _token = null;
      const token = await getBitQueryToken();
      return await fn(token);
    }
    throw e;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ACTION: token
// ════════════════════════════════════════════════════════════════════════════
async function handleToken(req, res) {
  const force = req.body?.force === true;
  const now   = Date.now();

  if (!process.env.BITQUERY_CLIENT_ID || !process.env.BITQUERY_CLIENT_SECRET) {
    return res.status(500).json({
      error: "BITQUERY_CLIENT_ID / BITQUERY_CLIENT_SECRET not configured.",
    });
  }

  if (!force && _token && now < _tokenExpiry - 120_000) {
    return res.status(200).json({
      access_token: _token,
      expires_in:   Math.round((_tokenExpiry - now) / 1000),
      obtained_at:  new Date(_tokenExpiry - 86400 * 1000).toISOString(),
      cached:       true,
    });
  }

  try {
    const token = await getBitQueryToken();
    return res.status(200).json({
      access_token: token,
      expires_in:   Math.round((_tokenExpiry - now) / 1000),
      obtained_at:  new Date(now).toISOString(),
      cached:       false,
    });
  } catch (e) {
    return res.status(502).json({ error: `Token request failed: ${e.message}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ACTION: tx
// ════════════════════════════════════════════════════════════════════════════

const ETH_TX_QUERY = `
query EthTx($hash: String!) {
  EVM(network: eth) {
    Transactions(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Number }
      Transaction { Hash From To Value Gas GasPrice Nonce Type }
      TransactionStatus { Success }
      Fee { SenderFee }
    }
    Transfers(where: { Transaction: { Hash: { is: $hash } } }) {
      Transfer {
        Sender Receiver Amount
        Currency { Symbol Name Decimals SmartContract }
      }
    }
  }
}`;

const BTC_TX_QUERY = `
query BtcTx($hash: String!) {
  Bitcoin(network: bitcoin) {
    Inputs(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Height }
      Transaction { Hash }
      Input { Amount Address { Address } }
    }
    Outputs(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Height }
      Transaction { Hash }
      Output { Amount Address { Address } }
    }
  }
}`;

const TRX_TX_QUERY = `
query TrxTx($hash: String!) {
  Tron(network: tron) {
    Transfers(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Number }
      Transaction { Hash }
      Transfer { Sender Receiver Amount Currency { Symbol Name Decimals SmartContract } }
    }
    Transactions(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Number }
      Transaction { Hash EnergyFee NetFee Result { Success Status Message } }
    }
  }
}`;

const SOL_TX_QUERY = `
query SolTx($sig: String!) {
  Solana(network: solana) {
    Transfers(where: { Transaction: { Signature: { is: $sig } } }) {
      Block { Time Slot }
      Transaction { Signature Fee FeePayer }
      Transfer {
        Sender { Address } Receiver { Address } Amount
        Currency { Symbol Name Decimals MintAddress }
      }
    }
  }
}`;

function parseEthTx(data, hash) {
  const txList  = data?.EVM?.Transactions || [];
  const txfList = data?.EVM?.Transfers    || [];
  if (!txList.length && !txfList.length) return null;
  const tx = txList[0]; const t = tx?.Transaction || {};
  const transfers = txfList.map(tf => ({
    sender:    tf.Transfer?.Sender   || "",
    receiver:  tf.Transfer?.Receiver || "",
    amount:    parseFloat(tf.Transfer?.Amount || 0),
    symbol:    tf.Transfer?.Currency?.Symbol || "ETH",
    tokenName: tf.Transfer?.Currency?.Name   || "",
    contract:  tf.Transfer?.Currency?.SmartContract || "",
  }));
  return {
    chain: "ETH", hash: t.Hash || hash,
    status:     tx?.TransactionStatus?.Success === true ? "Success" : tx?.TransactionStatus?.Success === false ? "Failed" : "Unknown",
    block:      tx?.Block?.Number || "—",
    timestamp:  tx?.Block?.Time ? new Date(tx.Block.Time).toISOString() : null,
    sender:     t.From || transfers[0]?.sender   || "—",
    receiver:   t.To   || transfers[0]?.receiver || "—",
    nativeValue:`${parseFloat(t.Value || 0).toFixed(8)} ETH`,
    gas:        t.Gas      || "—",
    gasPrice:   t.GasPrice ? `${(parseFloat(t.GasPrice) / 1e9).toFixed(4)} Gwei` : "—",
    gasUsed:    "—",
    fee:        tx?.Fee?.SenderFee ? `${parseFloat(tx.Fee.SenderFee).toFixed(8)} ETH` : "—",
    nonce:      t.Nonce ?? "—", txType: t.Type ?? "—",
    transfers, explorerUrl: `https://etherscan.io/tx/${hash}`,
  };
}

function parseBtcTx(data, hash) {
  const inputs  = data?.Bitcoin?.Inputs  || [];
  const outputs = data?.Bitcoin?.Outputs || [];
  if (!inputs.length && !outputs.length) return null;
  const senders   = [...new Set(inputs.map(i  => i.Input?.Address?.Address).filter(Boolean))];
  const receivers = [...new Set(outputs.map(o => o.Output?.Address?.Address).filter(Boolean))];
  const totalIn   = inputs.reduce((s, i)  => s + parseFloat(i.Input?.Amount  || 0), 0);
  const totalOut  = outputs.reduce((s, o) => s + parseFloat(o.Output?.Amount || 0), 0);
  const blk = inputs[0]?.Block || outputs[0]?.Block || {};
  return {
    chain: "BTC", hash, status: "Confirmed",
    block: blk.Height || "—", timestamp: blk.Time ? new Date(blk.Time).toISOString() : null,
    sender: senders.join(", ") || "—", receiver: receivers.join(", ") || "—",
    nativeValue: `${totalOut.toFixed(8)} BTC`,
    fee: `${Math.max(0, totalIn - totalOut).toFixed(8)} BTC`,
    gas: "—", gasPrice: "—", gasUsed: "—", nonce: "—", txType: "UTXO",
    transfers: outputs.map(o => ({
      sender: senders[0] || "—", receiver: o.Output?.Address?.Address || "—",
      amount: parseFloat(o.Output?.Amount || 0), symbol: "BTC", tokenName: "Bitcoin", contract: "",
    })),
    explorerUrl: `https://blockstream.info/tx/${hash}`,
  };
}

function parseTrxTx(data, hash) {
  const txList = data?.Tron?.Transactions || [];
  const tfList = data?.Tron?.Transfers    || [];
  if (!txList.length && !tfList.length) return null;
  const tx = txList[0]?.Transaction || {}; const blk = txList[0]?.Block || tfList[0]?.Block || {};
  const transfers = tfList.map(tf => ({
    sender: tf.Transfer?.Sender || "", receiver: tf.Transfer?.Receiver || "",
    amount: parseFloat(tf.Transfer?.Amount || 0),
    symbol: tf.Transfer?.Currency?.Symbol || "TRX", tokenName: tf.Transfer?.Currency?.Name || "",
    contract: tf.Transfer?.Currency?.SmartContract || "",
  }));
  return {
    chain: "TRX", hash: tx.Hash || hash,
    status: tx.Result?.Success === true ? "Success" : tx.Result?.Success === false ? "Failed" : (tx.Result?.Status || "Unknown"),
    block: blk.Number || "—", timestamp: blk.Time ? new Date(blk.Time).toISOString() : null,
    sender: transfers[0]?.sender || "—", receiver: transfers[0]?.receiver || "—",
    nativeValue: transfers[0] ? `${transfers[0].amount.toFixed(6)} ${transfers[0].symbol}` : "—",
    fee: tx.EnergyFee != null ? `${tx.EnergyFee} Energy / ${tx.NetFee || 0} Bandwidth` : "—",
    gas: "—", gasPrice: "—", gasUsed: "—", nonce: "—", txType: "TRC20/TRX",
    transfers, explorerUrl: `https://tronscan.org/#/transaction/${hash}`,
  };
}

function parseSolTx(data, sig) {
  const tfList = data?.Solana?.Transfers || [];
  if (!tfList.length) return null;
  const blk = tfList[0]?.Block || {}; const meta = tfList[0]?.Transaction || {};
  const transfers = tfList.map(tf => ({
    sender: tf.Transfer?.Sender?.Address || "", receiver: tf.Transfer?.Receiver?.Address || "",
    amount: parseFloat(tf.Transfer?.Amount || 0),
    symbol: tf.Transfer?.Currency?.Symbol || "SOL", tokenName: tf.Transfer?.Currency?.Name || "",
    contract: tf.Transfer?.Currency?.MintAddress || "",
  }));
  return {
    chain: "SOL", hash: meta.Signature || sig, status: "Confirmed",
    block: blk.Slot || "—", timestamp: blk.Time ? new Date(blk.Time).toISOString() : null,
    sender: meta.FeePayer || transfers[0]?.sender || "—", receiver: transfers[0]?.receiver || "—",
    nativeValue: transfers[0] ? `${transfers[0].amount.toFixed(9)} ${transfers[0].symbol}` : "—",
    fee: meta.Fee ? `${(parseFloat(meta.Fee) / 1e9).toFixed(9)} SOL` : "—",
    gas: "—", gasPrice: "—", gasUsed: "—", nonce: "—", txType: "SPL/SOL",
    transfers, explorerUrl: `https://solscan.io/tx/${sig}`,
  };
}

async function handleTx(req, res) {
  const { txHash, chain } = req.body || {};
  if (!txHash || !chain) return res.status(400).json({ error: "txHash and chain are required" });
  const SUPPORTED = ["ETH","BTC","TRX","SOL"];
  const C = chain.toUpperCase();
  if (!SUPPORTED.includes(C)) return res.status(400).json({ error: `Chain ${chain} not supported. Use: ${SUPPORTED.join(", ")}` });

  const queryMap = {
    ETH: { q: ETH_TX_QUERY, vars: { hash: txHash } },
    BTC: { q: BTC_TX_QUERY, vars: { hash: txHash } },
    TRX: { q: TRX_TX_QUERY, vars: { hash: txHash } },
    SOL: { q: SOL_TX_QUERY, vars: { sig:  txHash } },
  };
  const parseMap = { ETH: parseEthTx, BTC: parseBtcTx, TRX: parseTrxTx, SOL: parseSolTx };

  let data;
  try {
    data = await withTokenRetry(token => bqQuery(token, queryMap[C].q, queryMap[C].vars));
  } catch (e) {
    return res.status(502).json({ error: `BitQuery error: ${e.message}` });
  }

  let parsed;
  try { parsed = parseMap[C](data, txHash); }
  catch (e) { return res.status(502).json({ error: `Failed to parse BitQuery response: ${e.message}` }); }

  if (!parsed) return res.status(404).json({ error: "Transaction not found or not yet indexed.", txHash, chain: C });
  return res.status(200).json({ ...parsed, queriedAt: new Date().toISOString() });
}

// ════════════════════════════════════════════════════════════════════════════
// ACTION: wallet
// ════════════════════════════════════════════════════════════════════════════

const ETH_WALLET_QUERY = `
query EthWallet($addr: String!) {
  EVM(network: eth) {
    TokenHolderStatistics(
      where: { Holder: { Address: { is: $addr } } }
      limit: { count: 1 }
    ) { Holder { Address } Balance { Amount Currency { Symbol Name } } }
    Transfers(
      where: { any: [{ Transfer: { Sender: { is: $addr } } },{ Transfer: { Receiver: { is: $addr } } }] }
      limit: { count: 10 } orderBy: { descending: Block_Time }
    ) {
      Block { Time } Transaction { Hash }
      Transfer { Sender Receiver Amount Currency { Symbol } }
    }
  }
}`;

const BTC_WALLET_QUERY = `
query BtcWallet($addr: String!) {
  Bitcoin(network: bitcoin) {
    Inputs(where: { Input: { Address: { Address: { is: $addr } } } } limit: { count: 10 } orderBy: { descending: Block_Time }) {
      Block { Time } Transaction { Hash } Input { Amount Address { Address } }
    }
    Outputs(where: { Output: { Address: { Address: { is: $addr } } } } limit: { count: 10 } orderBy: { descending: Block_Time }) {
      Block { Time } Transaction { Hash } Output { Amount Address { Address } }
    }
  }
}`;

const TRX_WALLET_QUERY = `
query TrxWallet($addr: String!) {
  Tron(network: tron) {
    Transfers(
      where: { any: [{ Transfer: { Sender: { is: $addr } } },{ Transfer: { Receiver: { is: $addr } } }] }
      limit: { count: 10 } orderBy: { descending: Block_Time }
    ) {
      Block { Time } Transaction { Hash }
      Transfer { Sender Receiver Amount Currency { Symbol } }
    }
  }
}`;

const SOL_WALLET_QUERY = `
query SolWallet($addr: String!) {
  Solana(network: solana) {
    Transfers(
      where: { any: [{ Transfer: { Sender: { Address: { is: $addr } } } },{ Transfer: { Receiver: { Address: { is: $addr } } } }] }
      limit: { count: 10 } orderBy: { descending: Block_Time }
    ) {
      Block { Time } Transaction { Signature }
      Transfer { Sender { Address } Receiver { Address } Amount Currency { Symbol } }
    }
  }
}`;

function buildFundFlow(txs, address) {
  const addr = address.toLowerCase();
  const cps = {};
  for (const tx of txs) {
    const other = tx.direction === "out" ? tx.to : tx.from;
    if (!other || other.toLowerCase() === addr) continue;
    const key = other.toLowerCase();
    if (!cps[key]) cps[key] = { address: other, sent: 0, received: 0, txCount: 0 };
    if (tx.direction === "out") cps[key].sent++; else cps[key].received++;
    cps[key].txCount++;
  }
  const nodes = [
    { id: "target", label: address.slice(0,8)+"…"+address.slice(-6), type: "target" },
    ...Object.values(cps).slice(0,12).map((cp,i) => ({
      id: `cp_${i}`, label: cp.address.slice(0,6)+"…"+cp.address.slice(-4),
      full: cp.address, type: cp.txCount > 3 ? "high" : "normal", txCount: cp.txCount,
    })),
  ];
  const edges = Object.values(cps).slice(0,12).map((cp,i) => ({
    source: "target", target: `cp_${i}`, sent: cp.sent, received: cp.received,
  }));
  return { nodes, edges };
}

function parseEthWallet(data, address) {
  const transfers  = data?.EVM?.Transfers || [];
  const tokenStats = data?.EVM?.TokenHolderStatistics || [];
  const ethBal = tokenStats.find(t => t?.Balance?.Currency?.Symbol === "ETH");
  const balance = ethBal ? `${parseFloat(ethBal.Balance.Amount).toFixed(6)} ETH` : "See Etherscan";
  const txs = transfers.map(t => {
    const sender = t.Transfer?.Sender || ""; const receiver = t.Transfer?.Receiver || "";
    const dir = sender.toLowerCase() === address.toLowerCase() ? "out" : "in";
    return { hash: t.Transaction?.Hash||"", time: t.Block?.Time ? new Date(t.Block.Time).toLocaleString() : "—",
      from: sender, to: receiver, value: `${parseFloat(t.Transfer?.Amount||0).toFixed(6)} ${t.Transfer?.Currency?.Symbol||"ETH"}`,
      direction: dir, url: `https://etherscan.io/tx/${t.Transaction?.Hash}` };
  });
  return { balance, txs, fundFlow: buildFundFlow(txs, address) };
}

function parseBtcWallet(data, address) {
  const inputs  = data?.Bitcoin?.Inputs  || [];
  const outputs = data?.Bitcoin?.Outputs || [];
  const all = [
    ...inputs.map(i  => ({ hash: i.Transaction?.Hash, time: i.Block?.Time, amount: i.Input?.Amount,  direction: "in",  from: i.Input?.Address?.Address,  to: address })),
    ...outputs.map(o => ({ hash: o.Transaction?.Hash, time: o.Block?.Time, amount: o.Output?.Amount, direction: "out", from: address, to: o.Output?.Address?.Address })),
  ].sort((a,b) => new Date(b.time)-new Date(a.time)).slice(0,10);
  const totalIn  = inputs.reduce((s,i)  => s+parseFloat(i.Input?.Amount||0), 0);
  const totalOut = outputs.reduce((s,o) => s+parseFloat(o.Output?.Amount||0), 0);
  const txs = all.map(t => ({
    hash: t.hash||"", time: t.time ? new Date(t.time).toLocaleString() : "—",
    from: t.from||"", to: t.to||"", value: `${parseFloat(t.amount||0).toFixed(8)} BTC`,
    direction: t.direction, url: `https://blockstream.info/tx/${t.hash}`,
  }));
  return { balance: `${Math.max(0,totalIn-totalOut).toFixed(8)} BTC`, txs, fundFlow: buildFundFlow(txs, address) };
}

function parseTrxWallet(data, address) {
  const transfers = data?.Tron?.Transfers || [];
  const txs = transfers.map(t => {
    const sender = t.Transfer?.Sender||""; const receiver = t.Transfer?.Receiver||"";
    return { hash: t.Transaction?.Hash||"", time: t.Block?.Time ? new Date(t.Block.Time).toLocaleString() : "—",
      from: sender, to: receiver, value: `${parseFloat(t.Transfer?.Amount||0).toFixed(2)} ${t.Transfer?.Currency?.Symbol||"TRX"}`,
      direction: sender===address?"out":"in", url: `https://tronscan.org/#/transaction/${t.Transaction?.Hash}` };
  });
  return { balance: "See Tronscan", txs, fundFlow: buildFundFlow(txs, address) };
}

function parseSolWallet(data, address) {
  const transfers = data?.Solana?.Transfers || [];
  const txs = transfers.map(t => {
    const sender = t.Transfer?.Sender?.Address||""; const receiver = t.Transfer?.Receiver?.Address||"";
    return { hash: t.Transaction?.Signature||"", time: t.Block?.Time ? new Date(t.Block.Time).toLocaleString() : "—",
      from: sender, to: receiver, value: `${parseFloat(t.Transfer?.Amount||0).toFixed(6)} ${t.Transfer?.Currency?.Symbol||"SOL"}`,
      direction: sender===address?"out":"in", url: `https://solscan.io/tx/${t.Transaction?.Signature}` };
  });
  return { balance: "See Solscan", txs, fundFlow: buildFundFlow(txs, address) };
}

async function handleWallet(req, res) {
  const { address, chain } = req.body || {};
  if (!address || !chain) return res.status(400).json({ error: "address and chain required" });
  const SUPPORTED = ["ETH","BTC","TRX","SOL"];
  if (!SUPPORTED.includes(chain)) return res.status(400).json({ error: `Chain ${chain} not supported. Use: ${SUPPORTED.join(", ")}`, explorerOnly: true });

  const queryMap = { ETH: ETH_WALLET_QUERY, BTC: BTC_WALLET_QUERY, TRX: TRX_WALLET_QUERY, SOL: SOL_WALLET_QUERY };
  const parseMap = { ETH: parseEthWallet, BTC: parseBtcWallet, TRX: parseTrxWallet, SOL: parseSolWallet };

  let data;
  try {
    data = await withTokenRetry(token => bqQuery(token, queryMap[chain], { addr: address }, 20000));
  } catch (e) {
    return res.status(502).json({ error: `BitQuery error: ${e.message}` });
  }

  let balance, txs, fundFlow;
  try { ({ balance, txs, fundFlow } = parseMap[chain](data, address)); }
  catch (e) { return res.status(502).json({ error: `Failed to parse BitQuery response: ${e.message}` }); }

  const ts   = Date.now().toString(36).toUpperCase();
  const slug = address.slice(0,4).toUpperCase();
  return res.status(200).json({
    caseId: `CW-${chain}-${slug}-${ts}`,
    chain, address, balance,
    recentTxs: txs, fundFlow,
    scannedAt: new Date().toISOString(),
    txCount: txs.length,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Main router
// ════════════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const action = req.query?.action || req.body?.action;
  if (action === "token")  return handleToken(req, res);
  if (action === "tx")     return handleTx(req, res);
  if (action === "wallet") return handleWallet(req, res);

  return res.status(400).json({ error: "Missing ?action=token|tx|wallet" });
}
