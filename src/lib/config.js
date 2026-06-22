export const CONTRACT_ADDR = '0x0DbAC3106ab037c4fad0282f1bc042Efd68004BE'
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
