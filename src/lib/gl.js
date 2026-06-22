// GenLayer Bradbury — official genlayer-js SDK
// Using two-client pattern from official README:
// readClient: no wallet needed
// writeClient: provider: window.ethereum for MetaMask signing

let _createClient, _testnetBradbury, _TransactionStatus

async function loadSDK() {
  if (_createClient) return
  const gl    = await import('genlayer-js')
  const chains = await import('genlayer-js/chains')
  const types  = await import('genlayer-js/types')
  _createClient      = gl.createClient
  _testnetBradbury   = chains.testnetBradbury
  _TransactionStatus = types.TransactionStatus
}

export const CHAIN_ID = '0x107D'
export const NET = {
  chainId:           CHAIN_ID,
  chainName:         'GenLayer Bradbury',
  rpcUrls:           ['https://rpc-bradbury.genlayer.com'],
  nativeCurrency:    { name:'GEN', symbol:'GEN', decimals:18 },
  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
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

  await loadSDK()
  const client = _createClient({ chain: _testnetBradbury })

  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, Math.min(1500 * 2 ** attempt, 10000)))
    try {
      const result = await client.readContract({ address: contractAddr, functionName: method, args })
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
  await loadSDK()

  // Write client with provider: window.ethereum (official MetaMask pattern)
  const client = _createClient({
    chain:    _testnetBradbury,
    account:  account,
    provider: window.ethereum,
  })

  // Switch wallet to Bradbury
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
  await loadSDK()
  const client = _createClient({ chain: _testnetBradbury })

  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, 3000))
    if (i === 8 && onSlow) onSlow()
    try {
      const receipt = await client.waitForTransactionReceipt({
        hash,
        status:   _TransactionStatus.ACCEPTED,
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
