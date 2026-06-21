export const CONTRACT_ADDR = '0x4e985b22c33ba39cD1Dc020797efA4524e62A856'
export const FAUCET = 'https://testnet-faucet.genlayer.foundation'
export const EXPLORER = 'https://explorer-bradbury.genlayer.com'
export const sh = a => a?.length > 10 ? a.slice(0, 6) + '...' + a.slice(-4) : (a || '')

export const weiToGen = (wei) => {
  try {
    const n   = BigInt(String(wei))
    const gen = n / BigInt(10 ** 18)
    const rem = n % BigInt(10 ** 18)
    if (rem === 0n) return gen.toString()
    const dec = rem.toString().padStart(18, '0').replace(/0+$/, '').slice(0, 4)
    return `${gen}.${dec}`
  } catch { return '0' }
}
