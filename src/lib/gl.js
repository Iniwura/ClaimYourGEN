// GenLayer Bradbury — custom calldata encoding (same as Bluff, GRumble, all working apps)

export const CHAIN_ID = '0x107D'
export const NET = {
  chainId:           CHAIN_ID,
  chainName:         'GenLayer Bradbury',
  rpcUrls:           ['https://rpc-bradbury.genlayer.com'],
  nativeCurrency:    { name:'GEN', symbol:'GEN', decimals:18 },
  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
}

const RPC  = 'https://rpc-bradbury.genlayer.com'
const CONS = '0x4F33a39DC5Ac7c5B9F2E7aB137F7c50b8f9B9339'

// ── Calldata encoding ─────────────────────────────────────────────────────
function encodeValue(val) {
  if (val === null || val === undefined) return { _glEncode: 'null', value: null }
  if (typeof val === 'boolean')  return { _glEncode: 'bool',   value: val }
  if (typeof val === 'number')   return { _glEncode: 'int',    value: val }
  if (typeof val === 'bigint')   return { _glEncode: 'int',    value: Number(val) }
  if (typeof val === 'string')   return { _glEncode: 'str',    value: val }
  if (Array.isArray(val))        return { _glEncode: 'list',   value: val.map(encodeValue) }
  return { _glEncode: 'dict', value: Object.fromEntries(Object.entries(val).map(([k,v]) => [k, encodeValue(v)])) }
}

function encodeCalldata(method, args = []) {
  const obj = { method, args: args.map(encodeValue) }
  const raw = JSON.stringify(obj)
  const enc = new TextEncoder()
  const buf = enc.encode(raw)
  let hex = ''
  for (const b of buf) hex += b.toString(16).padStart(2, '0')
  return '0x' + hex
}

// ── Read (via gen_call RPC) ───────────────────────────────────────────────
const _cache = new Map()
const _TTL   = 60_000

export async function readContract(addr, method, args = [], useCache = false) {
  const key = `${addr}:${method}:${JSON.stringify(args)}`
  if (useCache) {
    const c = _cache.get(key)
    if (c && Date.now() - c.ts < _TTL) return c.val
  }

  const cd   = encodeCalldata(method, args)
  const from = window._glAccount || '0x0000000000000000000000000000000000000000'

  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, Math.min(1500 * 2 ** attempt, 10000)))
    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method:  'gen_call',
          params:  [{ From: from, To: addr, Data: cd, Type: 'read' }],
        }),
      })
      const json = await res.json()
      if (json.error) {
        const msg = (json.error.message || '').toLowerCase()
        if (msg.includes('rate limit') || msg.includes('429')) { lastErr = new Error(json.error.message); continue }
        throw new Error(json.error.message)
      }
      const val = json.result ?? ''
      if (useCache) _cache.set(key, { val, ts: Date.now() })
      return val
    } catch(e) {
      lastErr = e
      const msg = (e.message || '').toLowerCase()
      if (msg.includes('rate limit') || msg.includes('fetch')) continue
      throw e
    }
  }
  throw lastErr
}

// ── Write (via eth_sendTransaction to consensus contract) ─────────────────
async function switchToBradbury() {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] })
  } catch(e) {
    if (e.code === 4902 || e.code === -32603) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [NET] })
    } else { throw e }
  }
}

export async function writeContract(contractAddr, account, method, args = [], valueWei = 0n) {
  await switchToBradbury()
  const cd = encodeCalldata(method, args)
  const pad  = v => v.toString(16).padStart(64, '0')
  const padA = a => a.toLowerCase().replace('0x', '').padStart(64, '0')
  const ch = cd.startsWith('0x') ? cd.slice(2) : cd
  const txData = '0xe71d5196' +
    padA(account) + padA(contractAddr) +
    pad(1) + pad(3) + pad(192) +
    pad(Math.floor(Date.now() / 1000) + 3600) +
    pad(ch.length / 2) +
    ch.padEnd(Math.ceil(ch.length / 64) * 64, '0')
  const txParams = { from: account, to: CONS, data: txData, gas: '0x7A120' }
  if (valueWei && BigInt(valueWei) > 0n) txParams.value = '0x' + BigInt(valueWei).toString(16)
  return window.ethereum.request({ method: 'eth_sendTransaction', params: [txParams] })
}

// ── Wait for tx ───────────────────────────────────────────────────────────
export async function waitTx(hash, onSlow, tries = 40) {
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, 3000))
    if (i === 8 && onSlow) onSlow()
    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method:  'gen_getTransactionStatus',
          params:  [hash],
        }),
      })
      const json = await res.json()
      const status = (json.result || '').toUpperCase()
      if (status === 'ACCEPTED' || status === 'FINALIZED') return status
      if (status === 'CANCELED' || status === 'UNDETERMINED') throw new Error('Transaction ' + status)
    } catch(e) {
      const msg = (e.message || '').toLowerCase()
      if (msg.includes('canceled') || msg.includes('undetermined')) throw e
    }
  }
  throw new Error('Transaction timeout — check explorer-bradbury.genlayer.com')
}
