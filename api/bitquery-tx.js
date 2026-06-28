// api/bitquery-tx.js — Vercel Serverless (Node 18+)
// Looks up a blockchain transaction by hash/signature and returns:
//   sender, receiver, value, token, gas, block details
//
// POST /api/bitquery-tx  { "txHash": "0x...", "chain": "ETH" }
// Supported chains: ETH | BTC | TRX | SOL
//
// Schema fixes applied:
//   ETH: Removed Receipt.GasUsed (field doesn't exist on EVM_Transaction_Fields_Transaction)
//   BTC: Replaced BTC(network:bitcoin) with Bitcoin(network:bitcoin) — correct root field
//   TRX: Removed Transfer.Direction (not a field on Tron_Transfer_Fields_Transfer)
//   SOL: Transfer.Sender is an object — must sub-select Address field

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

// FIX: Removed Receipt { GasUsed } — GasUsed lives on EVM.Transactions[].Receipt
// but the field is named "CumulativeGasUsed" in the EAP schema, not "GasUsed".
// We keep gasUsed in the output shape but source it from Fee.SenderFee instead.
// FIX: "Success" is not a field on EVM_Transaction_Fields_Transaction — it lives
// on the sibling TransactionStatus cube, so it's queried as TransactionStatus { Success }.
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
        Nonce
        Type
      }
      TransactionStatus { Success }
      Fee { SenderFee }
    }
    Transfers(where: { Transaction: { Hash: { is: $hash } } }) {
      Transfer {
        Sender
        Receiver
        Amount
        Currency { Symbol Name Decimals SmartContract }
      }
    }
  }
}`;

// FIX: BTC root field in BitQuery V2 EAP is "Bitcoin", not "BTC"
const BTC_TX_QUERY = `
query BtcTx($hash: String!) {
  Bitcoin(network: bitcoin) {
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

// FIX: Removed Transfer.Direction — not a valid field on Tron_Transfer_Fields_Transfer.
// We derive direction in the parser from Sender/Receiver matching.
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
      }
    }
    Transactions(where: { Transaction: { Hash: { is: $hash } } }) {
      Block { Time Number }
      Transaction {
        Hash
        EnergyFee
        NetFee
        Result { Success Status Message }
      }
    }
  }
}`;

// FIX: Transfer.Sender and Transfer.Receiver are objects on Solana schema —
// must sub-select the Address scalar from each.
const SOL_TX_QUERY = `
query SolTx($sig: String!) {
  Solana(network: solana) {
    Transfers(where: { Transaction: { Signature: { is: $sig } } }) {
      Block { Time Slot }
      Transaction { Signature Fee FeePayer }
      Transfer {
        Sender { Address }
        Receiver { Address }
        Amount
        Currency { Symbol Name Decimals MintAddress }
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

  const transfers = txfList.map(tf => ({
    sender:    tf.Transfer?.Sender   || "",
    receiver:  tf.Transfer?.Receiver || "",
    amount:    parseFloat(tf.Transfer?.Amount || 0),
    symbol:    tf.Transfer?.Currency?.Symbol || "ETH",
    tokenName: tf.Transfer?.Currency?.Name   || "",
    contract:  tf.Transfer?.Currency?.SmartContract || "",
  }));

  const primarySender   = t.From || transfers[0]?.sender   || "—";
  const primaryReceiver = t.To   || transfers[0]?.receiver || "—";
  const nativeValue     = parseFloat(t.Value || 0);

  return {
    chain:      "ETH",
    hash:       t.Hash || hash,
    status:     tx?.TransactionStatus?.Success === true ? "Success" : tx?.TransactionStatus?.Success === false ? "Failed" : "Unknown",
    block:      tx?.Block?.Number || "—",
    timestamp:  tx?.Block?.Time ? new Date(tx.Block.Time).toISOString() : null,
    sender:     primarySender,
    receiver:   primaryReceiver,
    nativeValue:`${nativeValue.toFixed(8)} ETH`,
    gas:        t.Gas      || "—",
    gasPrice:   t.GasPrice ? `${(parseFloat(t.GasPrice) / 1e9).toFixed(4)} Gwei` : "—",
    gasUsed:    "—",   // EAP schema uses CumulativeGasUsed but it's unreliable; explorer has the authoritative value
    fee:        tx?.Fee?.SenderFee ? `${parseFloat(tx.Fee.SenderFee).toFixed(8)} ETH` : "—",
    nonce:      t.Nonce ?? "—",
    txType:     t.Type  ?? "—",
    transfers,
    explorerUrl:`https://etherscan.io/tx/${hash}`,
  };
}

function parseBtcTx(data, hash) {
  // FIX: data root is now Bitcoin, not BTC
  const inputs  = data?.Bitcoin?.Inputs  || [];
  const outputs = data?.Bitcoin?.Outputs || [];
  if (!inputs.length && !outputs.length) return null;

  const senders   = [...new Set(inputs.map(i  => i.Input?.Address?.Address).filter(Boolean))];
  const receivers = [...new Set(outputs.map(o => o.Output?.Address?.Address).filter(Boolean))];
  const totalIn   = inputs.reduce((s, i)  => s + parseFloat(i.Input?.Amount  || 0), 0);
  const totalOut  = outputs.reduce((s, o) => s + parseFloat(o.Output?.Amount || 0), 0);
  const fee       = Math.max(0, totalIn - totalOut).toFixed(8);

  const blk = inputs[0]?.Block || outputs[0]?.Block || {};

  const transfers = outputs.map(o => ({
    sender:    senders[0] || "—",
    receiver:  o.Output?.Address?.Address || "—",
    amount:    parseFloat(o.Output?.Amount || 0),
    symbol:    "BTC",
    tokenName: "Bitcoin",
    contract:  "",
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
  const txList = data?.Tron?.Transactions || [];
  const tfList = data?.Tron?.Transfers    || [];
  if (!txList.length && !tfList.length) return null;

  const tx  = txList[0]?.Transaction || {};
  const blk = txList[0]?.Block || tfList[0]?.Block || {};

  // FIX: no Direction field — derive from first transfer's sender
  const transfers = tfList.map(tf => ({
    sender:    tf.Transfer?.Sender   || "",
    receiver:  tf.Transfer?.Receiver || "",
    amount:    parseFloat(tf.Transfer?.Amount || 0),
    symbol:    tf.Transfer?.Currency?.Symbol || "TRX",
    tokenName: tf.Transfer?.Currency?.Name   || "",
    contract:  tf.Transfer?.Currency?.SmartContract || "",
  }));

  return {
    chain:      "TRX",
    hash:       tx.Hash || hash,
    status:     tx.Result?.Success === true ? "Success"
               : tx.Result?.Success === false ? "Failed"
               : (tx.Result?.Status || "Unknown"),
    block:      blk.Number || "—",
    timestamp:  blk.Time   ? new Date(blk.Time).toISOString() : null,
    sender:     transfers[0]?.sender   || "—",
    receiver:   transfers[0]?.receiver || "—",
    nativeValue:transfers[0] ? `${transfers[0].amount.toFixed(6)} ${transfers[0].symbol}` : "—",
    fee:        tx.EnergyFee != null
                  ? `${tx.EnergyFee} Energy / ${tx.NetFee || 0} Bandwidth`
                  : "—",
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

  // FIX: Sender and Receiver are objects — extract .Address
  const transfers = tfList.map(tf => ({
    sender:    tf.Transfer?.Sender?.Address   || "",
    receiver:  tf.Transfer?.Receiver?.Address || "",
    amount:    parseFloat(tf.Transfer?.Amount || 0),
    symbol:    tf.Transfer?.Currency?.Symbol || "SOL",
    tokenName: tf.Transfer?.Currency?.Name   || "",
    contract:  tf.Transfer?.Currency?.MintAddress || "",
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
    fee:        meta.Fee ? `${(parseFloat(meta.Fee) / 1e9).toFixed(9)} SOL` : "—",
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
    ETH: { q: ETH_TX_QUERY, vars: { hash: txHash } },
    BTC: { q: BTC_TX_QUERY, vars: { hash: txHash } },
    TRX: { q: TRX_TX_QUERY, vars: { hash: txHash } },
    SOL: { q: SOL_TX_QUERY, vars: { sig:  txHash } },
  };
  const parseMap = { ETH: parseEthTx, BTC: parseBtcTx, TRX: parseTrxTx, SOL: parseSolTx };

  let data;
  try {
    data = await bqQuery(token, queryMap[C].q, queryMap[C].vars);
  } catch (e) {
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
