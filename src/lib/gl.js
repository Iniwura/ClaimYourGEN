import { createClient } from 'genlayer-js'

// Chain config inline — avoids genlayer-js/chains subpath import issue with Rollup
const testnetBradbury = {
  id:   4221,
  name: 'GenLayer Bradbury',
  rpcUrls: {
    default: { http: ['https://rpc-bradbury.genlayer.com'] },
    public:  { http: ['https://rpc-bradbury.genlayer.com'] },
  },
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  blockExplorers: {
    default: { name: 'GenExplorer', url: 'https://explorer-bradbury.genlayer.com' },
  },
}

// TransactionStatus inline — avoids genlayer-js/types subpath import issue
const TransactionStatus = {
  PENDING:       'PENDING',
  ACCEPTED:      'ACCEPTED',
  FINALIZED:     'FINALIZED',
  CANCELED:      'CANCELED',
  UNDETERMINED:  'UNDETERMINED',
}

export const CHAIN_ID = '0x107D'
export const NET = {
  chainId:    CHAIN_ID,
  chainName:  'GenLayer Bradbury',
  rpcUrls:    ['https://rpc-bradbury.genlayer.com'],
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
}

function getClient(account = '0x0000000000000000000000000000000000000000') {
  return createClient({ chain: testnetBradbury, account })
}

// ── Read ──────────────────────────────────────────────────────────────────
const _cache = new Map()
const _TTL   = 60_000

export async function readContract(contractAddr, method, args = [], useCache = false) {
  const key = `${contractAddr}:${method}:${JSON.stringify(args)}`
  if (useCache) {
    const c = _cache.get(key)
    if (c && Date.now() - c.ts < _TTL) return c.val
  }

  const from   = window._glAccount || '0x0000000000000000000000000000000000000000'
  const client = getClient(from)

  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)))
    try {
      const result = await client.readContract({
        address:      contractAddr,
        functionName: method,
        args,
      })
      const val = typeof result === 'string' ? result : JSON.stringify(result)
      if (useCache) _cache.set(key, { val, ts: Date.now() })
      return val
    } catch(e) {
      lastErr = e
      const msg = (e.message || '').toLowerCase()
      if (msg.includes('rate limit') || msg.includes('429')) continue
      throw e
    }
  }
  throw lastErr
}

// ── Write ─────────────────────────────────────────────────────────────────
export async function writeContract(contractAddr, account, method, args = [], valueWei = 0n) {
  const client = getClient(account)
  await client.connect('testnetBradbury')
  return await client.writeContract({
    address:      contractAddr,
    functionName: method,
    args,
    value: BigInt(valueWei || 0),
  })
}

// ── Wait for tx ───────────────────────────────────────────────────────────
export async function waitTx(hash, onSlow, tries = 30) {
  const client = getClient(window._glAccount || '0x0000000000000000000000000000000000000000')
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, 3000))
    if (i === 8 && onSlow) onSlow()
    try {
      const receipt = await client.waitForTransactionReceipt({
        hash,
        status:   TransactionStatus.ACCEPTED,
        retries:  1,
        interval: 1000,
      })
      if (receipt) return receipt
    } catch(e) {
      const msg = (e.message || '').toLowerCase()
      if (msg.includes('timeout') || msg.includes('not found')) continue
      throw e
    }
  }
  throw new Error('Transaction timeout — check explorer-bradbury.genlayer.com')
}
