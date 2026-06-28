// api/bitquery-tx.js — Vercel Serverless (Node 18+)
// Looks up a blockchain transaction by hash/signature and returns:
//   sender, receiver, value, token, gas, block details, USD estimate
//
// POST /api/bitquery-tx  { "txHash": "0x...", "chain": "ETH" }
// Supported chains: ETH | BTC | TRX | SOL

export const config = { maxDuration: 30 };

// ── Token cache ──────────────────────────────────────────────────────────────
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
      grant_type: "client_credentials",
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

async function bqQuery(token, query, variables = {}) {
  const res = await fetch("https://streaming.bitquery.io/eap", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body:   JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(22000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`BitQuery query failed ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// ── Chain-specific transaction queries ──────────────────────────────────────

const ETH_TX_QUERY = `
query EthTx($hash: String!) {
  EVM(network: eth) {
    Transactions(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Number }
      Transaction {
        Hash
        From
        To
        Value
        Gas
        GasPrice
        GasUsed
        Nonce
        Type
        Status: Success
      }
      Fee { SenderFee }
    }
    Transfers(where: { Transaction: { Hash: { is: $hash } } }) {
      Transfer {
        Sender
        Receiver
        Amount
        Currency { Symbol Name Decimals SmartContract }
        Direction
      }
    }
  }
}`;

const BTC_TX_QUERY = `
query BtcTx($hash: String!) {
  BTC(network: bitcoin) {
    Inputs(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Height }
      Transaction { Hash }
      Input {
        Amount
        Address { Address }
      }
    }
    Outputs(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Height }
      Transaction { Hash }
      Output {
        Amount
        Address { Address }
      }
    }
  }
}`;

const TRX_TX_QUERY = `
query TrxTx($hash: String!) {
  Tron(network: tron) {
    Transfers(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Number }
      Transaction { Hash }
      Transfer {
        Sender
        Receiver
        Amount
        Currency { Symbol Name Decimals SmartContract }
        Direction
      }
    }
    Transactions(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Number }
      Transaction {
        Hash
        EnergyFee
        NetFee
        Result
      }
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
        Sender
        Receiver
        Amount
        Currency { Symbol Name Decimals MintAddress }
        Direction
      }
    }
  }
}`;

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseEthTx(data, hash) {
  const txList  = data?.EVM?.Transactions || [];
  const txfList = data?.EVM?.Transfers    || [];

  if (!txList.length && !txfList.length) return null;

  const tx = txList[0];
  const t  = tx?.Transaction || {};

  // Collect all token transfers for this tx
  const transfers = txfList.map(tf => ({
    sender:        tf.Transfer?.Sender   || "",
    receiver:      tf.Transfer?.Receiver || "",
    amount:        parseFloat(tf.Transfer?.Amount || 0),
    symbol:        tf.Transfer?.Currency?.Symbol || "ETH",
    tokenName:     tf.Transfer?.Currency?.Name   || "",
    contract:      tf.Transfer?.Currency?.SmartContract || "",
    direction:     tf.Transfer?.Direction || "",
  }));

  // Primary sender/receiver: native ETH tx > first token transfer
  const primarySender   = t.From || transfers[0]?.sender   || "—";
  const primaryReceiver = t.To   || transfers[0]?.receiver || "—";
  const nativeValue     = parseFloat(t.Value || 0);

  return {
    chain:      "ETH",
    hash:       t.Hash || hash,
    status:     t.Status === true ? "Success" : t.Status === false ? "Failed" : "Unknown",
    block:      tx?.Block?.Number || "—",
    timestamp:  tx?.Block?.Time ? new Date(tx.Block.Time).toISOString() : null,
    sender:     primarySender,
    receiver:   primaryReceiver,
    nativeValue:`${nativeValue.toFixed(8)} ETH`,
    gas:        t.Gas      || "—",
    gasPrice:   t.GasPrice ? `${(parseFloat(t.GasPrice) / 1e9).toFixed(4)} Gwei` : "—",
    gasUsed:    t.GasUsed  || "—",
    fee:        tx?.Fee?.SenderFee ? `${parseFloat(tx.Fee.SenderFee).toFixed(8)} ETH` : "—",
    nonce:      t.Nonce ?? "—",
    txType:     t.Type ?? "—",
    transfers,
    explorerUrl:`https://etherscan.io/tx/${hash}`,
  };
}

function parseBtcTx(data, hash) {
  const inputs  = data?.BTC?.Inputs  || [];
  const outputs = data?.BTC?.Outputs || [];
  if (!inputs.length && !outputs.length) return null;

  const senders    = [...new Set(inputs.map(i  => i.Input?.Address?.Address).filter(Boolean))];
  const receivers  = [...new Set(outputs.map(o => o.Output?.Address?.Address).filter(Boolean))];
  const totalIn    = inputs.reduce((s, i)  => s + parseFloat(i.Input?.Amount  || 0), 0);
  const totalOut   = outputs.reduce((s, o) => s + parseFloat(o.Output?.Amount || 0), 0);
  const fee        = (totalIn - totalOut).toFixed(8);

  const blk  = inputs[0]?.Block || outputs[0]?.Block || {};

  const transfers = outputs.map(o => ({
    sender:    senders[0] || "—",
    receiver:  o.Output?.Address?.Address || "—",
    amount:    parseFloat(o.Output?.Amount || 0),
    symbol:    "BTC",
    tokenName: "Bitcoin",
    contract:  "",
    direction: "out",
  }));

  return {
    chain:      "BTC",
    hash,
    status:     "Confirmed",
    block:      blk.Height || "—",
    timestamp:  blk.Time   ? new Date(blk.Time).toISOString() : null,
    sender:     senders.join(", ") || "—",
    receiver:   receivers.join(", ") || "—",
    nativeValue:`${totalOut.toFixed(8)} BTC`,
    fee:        `${fee} BTC`,
    gas:        "—",
    gasPrice:   "—",
    gasUsed:    "—",
    nonce:      "—",
    txType:     "UTXO",
    transfers,
    explorerUrl:`https://blockstream.info/tx/${hash}`,
  };
}

function parseTrxTx(data, hash) {
  const txList  = data?.Tron?.Transactions || [];
  const tfList  = data?.Tron?.Transfers    || [];
  if (!txList.length && !tfList.length) return null;

  const tx = txList[0]?.Transaction || {};
  const blk = txList[0]?.Block || tfList[0]?.Block || {};

  const transfers = tfList.map(tf => ({
    sender:    tf.Transfer?.Sender   || "",
    receiver:  tf.Transfer?.Receiver || "",
    amount:    parseFloat(tf.Transfer?.Amount || 0),
    symbol:    tf.Transfer?.Currency?.Symbol || "TRX",
    tokenName: tf.Transfer?.Currency?.Name   || "",
    contract:  tf.Transfer?.Currency?.SmartContract || "",
    direction: tf.Transfer?.Direction || "",
  }));

  return {
    chain:      "TRX",
    hash:       tx.Hash || hash,
    status:     tx.Result === "SUCCESS" || !tx.Result ? "Success" : tx.Result,
    block:      blk.Number || "—",
    timestamp:  blk.Time   ? new Date(blk.Time).toISOString() : null,
    sender:     transfers[0]?.sender   || "—",
    receiver:   transfers[0]?.receiver || "—",
    nativeValue:transfers[0] ? `${transfers[0].amount.toFixed(6)} ${transfers[0].symbol}` : "—",
    fee:        tx.EnergyFee ? `${tx.EnergyFee} Energy / ${tx.NetFee || 0} Bandwidth` : "—",
    gas:        "—",
    gasPrice:   "—",
    gasUsed:    "—",
    nonce:      "—",
    txType:     "TRC20/TRX",
    transfers,
    explorerUrl:`https://tronscan.org/#/transaction/${hash}`,
  };
}

function parseSolTx(data, sig) {
  const tfList = data?.Solana?.Transfers || [];
  if (!tfList.length) return null;

  const blk  = tfList[0]?.Block || {};
  const meta = tfList[0]?.Transaction || {};

  const transfers = tfList.map(tf => ({
    sender:    tf.Transfer?.Sender   || "",
    receiver:  tf.Transfer?.Receiver || "",
    amount:    parseFloat(tf.Transfer?.Amount || 0),
    symbol:    tf.Transfer?.Currency?.Symbol || "SOL",
    tokenName: tf.Transfer?.Currency?.Name   || "",
    contract:  tf.Transfer?.Currency?.MintAddress || "",
    direction: tf.Transfer?.Direction || "",
  }));

  return {
    chain:      "SOL",
    hash:       meta.Signature || sig,
    status:     "Confirmed",
    block:      blk.Slot || "—",
    timestamp:  blk.Time  ? new Date(blk.Time).toISOString() : null,
    sender:     meta.FeePayer || transfers[0]?.sender   || "—",
    receiver:   transfers[0]?.receiver || "—",
    nativeValue:transfers[0] ? `${transfers[0].amount.toFixed(9)} ${transfers[0].symbol}` : "—",
    fee:        meta.Fee    ? `${(parseFloat(meta.Fee) / 1e9).toFixed(9)} SOL` : "—",
    gas:        "—",
    gasPrice:   "—",
    gasUsed:    "—",
    nonce:      "—",
    txType:     "SPL/SOL",
    transfers,
    explorerUrl:`https://solscan.io/tx/${sig}`,
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { txHash, chain } = req.body || {};
  if (!txHash || !chain)
    return res.status(400).json({ error: "txHash and chain are required" });

  const SUPPORTED = ["ETH", "BTC", "TRX", "SOL"];
  if (!SUPPORTED.includes(chain.toUpperCase()))
    return res.status(400).json({ error: `Chain ${chain} not supported. Use: ${SUPPORTED.join(", ")}` });

  const C = chain.toUpperCase();

  let token;
  try {
    token = await getBitQueryToken();
  } catch (e) {
    return res.status(500).json({ error: `Auth failed: ${e.message}` });
  }

  const queryMap = {
    ETH: { q: ETH_TX_QUERY,  vars: { hash: txHash } },
    BTC: { q: BTC_TX_QUERY,  vars: { hash: txHash } },
    TRX: { q: TRX_TX_QUERY,  vars: { hash: txHash } },
    SOL: { q: SOL_TX_QUERY,  vars: { sig:  txHash } },
  };
  const parseMap = { ETH: parseEthTx, BTC: parseBtcTx, TRX: parseTrxTx, SOL: parseSolTx };

  let data;
  try {
    data = await bqQuery(token, queryMap[C].q, queryMap[C].vars);
  } catch (e) {
    // Force token refresh on auth errors
    if (e.message.includes("401") || e.message.includes("403")) {
      _token = null;
      try {
        token = await getBitQueryToken();
        data  = await bqQuery(token, queryMap[C].q, queryMap[C].vars);
      } catch (e2) {
        return res.status(502).json({ error: `BitQuery error: ${e2.message}` });
      }
    } else {
      return res.status(502).json({ error: `BitQuery error: ${e.message}` });
    }
  }

  let parsed;
  try {
    parsed = parseMap[C](data, txHash);
  } catch (e) {
    console.error("[bitquery-tx] parse error:", e);
    return res.status(502).json({ error: `Failed to parse BitQuery response: ${e.message}` });
  }
  if (!parsed) {
    return res.status(404).json({
      error:  "Transaction not found or not yet indexed by BitQuery.",
      txHash,
      chain:  C,
    });
  }

  return res.status(200).json({ ...parsed, queriedAt: new Date().toISOString() });
}
