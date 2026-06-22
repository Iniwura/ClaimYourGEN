// GenLayer Bradbury — custom encoding (same pattern as Bluff + GRumble)
// CONS address confirmed from genlayer-js@1.1.7 source

export const CHAIN_ID = '0x107D'
export const NET = {
  chainId:           CHAIN_ID,
  chainName:         'GenLayer Bradbury',
  rpcUrls:           ['https://rpc-bradbury.genlayer.com'],
  nativeCurrency:    { name:'GEN', symbol:'GEN', decimals:18 },
  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
}

const RPC  = 'https://rpc-bradbury.genlayer.com'
const CONS = '0x0112Bf6e83497965A5fdD6Dad1E447a6E004271D'

// ── Calldata encoding ────────────────────────────────────────────────────
function encodeValue(val) {
  if (val === null || val === undefined) return { _glEncode: 'null',  value: null }
  if (typeof val === 'boolean')  return { _glEncode: 'bool',   value: val }
  if (typeof val === 'number')   return { _glEncode: 'int',    value: val }
  if (typeof val === 'bigint')   return { _glEncode: 'int',    value: Number(val) }
  if (typeof val === 'string')   return { _glEncode: 'str',    value: val }
  if (Array.isArray(val))        return { _glEncode: 'list',   value: val.map(encodeValue) }
  return { _glEncode: 'dict', value: Object.fromEntries(Object.entries(val).map(([k,v]) => [k, encodeValue(v)])) }
}

function encodeCalldata(method, args = []) {
  const obj = { method, args: args.map(encodeValue) }
  const buf = new TextEncoder().encode(JSON.stringify(obj))
  return '0x' + Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join('')
}

// ── Network switch ───────────────────────────────────────────────────────
async function switchToBradbury() {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] })
  } catch(e) {
    if (e.code === 4902 || e.code === -32603) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [NET] })
    } else throw e
  }
}

// ── Read ─────────────────────────────────────────────────────────────────
const _cache = new Map()
const _TTL   = 60_000

export async function readContract(addr, method, args = [], useCache = false) {
  const key = `${addr}:${method}:${JSON.stringify(args)}`
  if (useCache) {
    const c = _cache.get(key)
    if (c && Date.now() - c.ts < _TTL) return c.val
  }
  const from = window._glAccount || '0x0000000000000000000000000000000000000000'
  let lastErr
  for (let i = 0; i < 4; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, Math.min(1500 * 2**i, 10000)))
    try {
      const res  = await fetch(RPC, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'gen_call',
          params:[{ From:from, To:addr, Data:encodeCalldata(method,args), Type:'read' }] })
      })
      const json = await res.json()
      if (json.error) {
        if ((json.error.message||'').toLowerCase().includes('rate')) { lastErr = new Error(json.error.message); continue }
        throw new Error(json.error.message)
      }
      const val = json.result ?? ''
      if (useCache) _cache.set(key, { val, ts: Date.now() })
      return val
    } catch(e) {
      lastErr = e
      if ((e.message||'').toLowerCase().includes('fetch')) continue
      throw e
    }
  }
  throw lastErr
}

// ── Write ────────────────────────────────────────────────────────────────
export async function writeContract(contractAddr, account, method, args = [], valueWei = 0n) {
  await switchToBradbury()
  const cd  = encodeCalldata(method, args)
  const hex = cd.startsWith('0x') ? cd.slice(2) : cd
  const pad  = v => v.toString(16).padStart(64, '0')
  const padA = a => a.toLowerCase().replace('0x','').padStart(64,'0')
  const data = '0xe71d5196'
    + padA(account) + padA(contractAddr)
    + pad(1) + pad(3) + pad(192)
    + pad(Math.floor(Date.now()/1000) + 3600)
    + pad(hex.length / 2)
    + hex.padEnd(Math.ceil(hex.length/64)*64, '0')
  const params = { from: account, to: CONS, data, gas: '0x7A120' }
  if (valueWei && BigInt(valueWei) > 0n) params.value = '0x' + BigInt(valueWei).toString(16)
  return window.ethereum.request({ method: 'eth_sendTransaction', params: [params] })
}

// ── Wait for tx ──────────────────────────────────────────────────────────
export async function waitTx(hash, onSlow, tries = 40) {
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, 3000))
    if (i === 8 && onSlow) onSlow()
    try {
      const res  = await fetch(RPC, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'gen_getTransactionStatus', params:[hash] })
      })
      const json = await res.json()
      const st   = (json.result||'').toUpperCase()
      if (st === 'ACCEPTED' || st === 'FINALIZED') return st
      if (st === 'CANCELED' || st === 'UNDETERMINED') throw new Error('Transaction ' + st)
    } catch(e) {
      if ((e.message||'').match(/CANCELED|UNDETERMINED/)) throw e
    }
  }
  throw new Error('Timeout — check explorer-bradbury.genlayer.com')
}
