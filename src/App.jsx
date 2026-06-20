import React, { useState, useEffect } from 'react'
import ContractCard from './components/ContractCard.jsx'
import { readContract, writeContract, waitTx, CHAIN_ID, NET } from './lib/gl.js'
import { CONTRACT_ADDR, FAUCET, EXPLORER, sh, weiToGen } from './lib/config.js'

const GL_LOGO   = 'https://cdn.prod.website-files.com/68108d68d0fc0cfa0c26dbc9/691359baf22648f4efd074b2_GenLayer_Logo_White_Cropped.svg'
const GL_MARK   = 'https://cdn.prod.website-files.com/68108d68d0fc0cfa0c26dbc9/691359b88e6b1fd0260a9fea_GenLayer_Mark_White.svg'
const MOCHI_IDEA = 'https://raw.githubusercontent.com/genlayer-foundation/genlayer-mascot/main/assets/stickers/mochi-sticker-idea.png'
const MOCHI_MAIN = 'https://raw.githubusercontent.com/genlayer-foundation/genlayer-mascot/main/assets/renders/mochi-main.png'

function Toast({ msg, type, onClear }) {
  useEffect(() => { if (!msg) return; const t = setTimeout(onClear, 5000); return () => clearTimeout(t) }, [msg])
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--card2)', border: `1px solid ${type === 'err' ? 'rgba(239,68,68,.4)' : 'var(--border2)'}`,
      color: type === 'err' ? '#F87171' : 'var(--accent)',
      padding: '10px 22px', borderRadius: 100, fontFamily: 'var(--mono)', fontSize: 11,
      zIndex: 999, animation: 'fin .3s var(--ease)',
    }}>{msg}</div>
  )
}

// Scanning animation overlay
function ScanOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(5,15,10,.85)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      {/* Scan beam */}
      <div style={{ position: 'relative', width: 200, height: 200, border: '1px solid var(--green-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          animation: 'scan 2s ease-in-out infinite',
          boxShadow: '0 0 12px rgba(226,232,240,.4)',
        }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={MOCHI_IDEA} alt="Mochi" style={{ width: 64, objectFit: 'contain', opacity: .7, animation: 'pulse 2s ease-in-out infinite' }} />
        </div>
        {/* Corner brackets */}
        {[['0','0','br'], ['0','auto','bl'], ['auto','0','tr'], ['auto','auto','tl']].map(([t,r,key]) => (
          <div key={key} style={{
            position: 'absolute', top: t === '0' ? 8 : 'auto', bottom: t === 'auto' ? 8 : 'auto',
            left: r === '0' ? 8 : 'auto', right: r === 'auto' ? 8 : 'auto',
            width: 16, height: 16,
            borderTop: (t === '0') ? '2px solid var(--accent)' : 'none',
            borderBottom: (t === 'auto') ? '2px solid var(--accent)' : 'none',
            borderLeft: (r === '0') ? '2px solid var(--accent)' : 'none',
            borderRight: (r === 'auto') ? '2px solid var(--accent)' : 'none',
          }} />
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>
          Scanning Bradbury...
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
          AI is reading your transaction history<br />
          and identifying stuck GEN
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
        This may take 1-3 minutes on Bradbury
      </div>
    </div>
  )
}

export default function App() {
  const [account,   setAccount]   = useState('')
  const [connected, setConnected] = useState(false)
  const [scanning,  setScanning]  = useState(false)
  const [result,    setResult]    = useState(null)
  const [cached,    setCached]    = useState(false)
  const [toast,     setToast]     = useState({ msg: '', type: 'ok' })
  const [totalScans,setTotalScans]= useState('...')

  const notify = (msg, type = 'ok') => setToast({ msg, type })

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(a => {
        if (a?.[0]) { setAccount(a[0]); setConnected(true); window._glAccount = a[0] }
      }).catch(() => {})
    }
    loadStats()
  }, [])

  async function loadStats() {
    if (!CONTRACT_ADDR) return
    try {
      const raw = await readContract(CONTRACT_ADDR, 'get_total_scans', [], true)
      if (raw) setTotalScans(raw)
    } catch {}
  }

  async function connect() {
    if (!window.ethereum) { notify('Install MetaMask', 'err'); return }
    try {
      const accs  = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const chain = await window.ethereum.request({ method: 'eth_chainId' })
      if (chain !== CHAIN_ID) {
        try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] }) }
        catch (e) { if (e.code === 4902 || e.code === -32603) await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [NET] }) }
      }
      setAccount(accs[0]); setConnected(true); window._glAccount = accs[0]
      notify('Connected', 'ok')
      window.ethereum.on('accountsChanged', a => { if (!a.length) { setAccount(''); setConnected(false) } })
    } catch (e) { notify(e.message, 'err') }
  }

  async function loadCachedScan(addr) {
    try {
      const raw = await readContract(CONTRACT_ADDR, 'get_scan', [addr], true)
      if (raw && raw !== 'NOT_FOUND') {
        setResult(JSON.parse(raw))
        setCached(true)
        return true
      }
    } catch {}
    return false
  }

  async function runScan() {
    if (!connected) { notify('Connect wallet first', 'err'); return }
    if (!CONTRACT_ADDR) { notify('Contract not deployed yet', 'err'); return }
    setScanning(true); setResult(null); setCached(false)
    try {
      const hash = await writeContract(CONTRACT_ADDR, account, 'scan_wallet', [account])
      await waitTx(hash, () => notify('AI is scanning... this takes a moment', 'ok'), 40)
      notify('Scan complete!', 'ok')
      await loadCachedScan(account)
      await loadStats()
    } catch (e) { notify(e.message, 'err') }
    finally { setScanning(false) }
  }

  useEffect(() => {
    if (connected && account && CONTRACT_ADDR) loadCachedScan(account)
  }, [connected, account])

  const contracts   = result?.contracts || []
  const totalWei    = result?.total_sent_wei || '0'
  const totalGen    = weiToGen(totalWei)
  const hasContracts= contracts.length > 0

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>

      {scanning && <ScanOverlay />}

      {/* HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100, height: 56,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 clamp(1rem,4vw,2.5rem)',
        background: 'rgba(5,15,10,.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={GL_MARK} alt="GL" style={{ width: 24, height: 24 }} />
          <span style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 15, letterSpacing: '-.02em' }}>
            ClaimYourGEN
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.12em', background: 'var(--green-dim)', border: '1px solid var(--green-border)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 100 }}>
            BRADBURY
          </span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
            {totalScans} scans run
          </div>
          {connected
            ? <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--border2)', padding: '5px 14px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                {sh(account)}
              </div>
            : <button className="btn btn-outline" style={{ fontSize: 12, padding: '7px 16px' }} onClick={connect}>
                Connect Wallet
              </button>
          }
        </div>
      </header>

      {/* HERO */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(2rem,6vw,4rem) clamp(1rem,4vw,2rem) clamp(1rem,4vw,2rem)' }}>

        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
            color: 'var(--accent)', border: '1px solid var(--border2)', background: 'var(--accent-dim)',
            padding: '5px 16px', borderRadius: 100, marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'blink 2s infinite' }} />
            GenLayer Bradbury — GEN Recovery Tool
          </div>

          <h1 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 'clamp(2.2rem,6vw,4rem)', letterSpacing: '-.05em', lineHeight: .95, marginBottom: 16 }}>
            Find your<br />
            <span style={{ color: 'var(--accent)' }}>stuck GEN.</span>
          </h1>

          <p style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.8 }}>
            Connect your wallet. The AI scans your entire Bradbury transaction history and finds every contract where your GEN is sitting unclaimed.
          </p>

          {connected ? (
            <button className="btn btn-accent" style={{ fontSize: 14, padding: '12px 28px' }}
              disabled={scanning} onClick={runScan}>
              {scanning ? <><span className="spin-el" style={{ marginRight: 8 }} />Scanning...</> : '🔍 Scan My Wallet'}
            </button>
          ) : (
            <button className="btn btn-accent" style={{ fontSize: 14, padding: '12px 28px' }} onClick={connect}>
              Connect Wallet to Scan
            </button>
          )}

          {cached && result && (
            <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
              Showing cached scan from {result.scanned_at?.slice(0, 10) || 'earlier'} ·{' '}
              <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={runScan}>
                Run fresh scan
              </span>
            </div>
          )}
        </div>

        {/* RESULTS */}
        {result && (
          <div style={{ animation: 'fin .4s var(--ease) both' }}>

            {/* Summary bar */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24,
            }}>
              {[
                { val: contracts.length, label: 'Contracts Found', color: hasContracts ? 'var(--yellow)' : 'var(--accent)' },
                { val: `${totalGen} GEN`, label: 'Total Sent', color: 'var(--accent)' },
                { val: result.scanned_at?.slice(0, 10) || 'Just now', label: 'Last Scanned', color: 'var(--text2)' },
              ].map(({ val, label, color }) => (
                <div key={label} style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r)', padding: '16px 20px', textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.3rem', color, letterSpacing: '-.02em', lineHeight: 1, marginBottom: 6 }}>{val}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Scan note */}
            {result.scan_note && (
              <div style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 20,
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.7,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ color: 'var(--accent)', fontSize: 16 }}>ℹ</span>
                {result.scan_note}
              </div>
            )}

            {/* Contract cards */}
            {hasContracts ? (
              <>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
                  color: 'var(--muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  Stuck GEN Found
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                  {contracts.map((c, i) => <ContractCard key={c.address + i} entry={c} index={i} />)}
                </div>

                {/* Recovery info */}
                <div style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r)', padding: '20px 24px',
                }}>
                  <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>
                    How to recover your GEN
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.8, marginBottom: 16 }}>
                    Each contract above needs a recovery function. If you own that contract, click <strong style={{ color: 'var(--accent)' }}>Copy Code</strong> on the card and add it to your contract source, then redeploy. If someone else owns it, share the code with them.
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                    The recovery snippet is a standard module — any GenLayer contract can add it in under 10 lines.
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                textAlign: 'center', padding: '48px 24px',
                border: '1px solid var(--border)', borderRadius: 'var(--r)',
                background: 'var(--card)',
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 14 }}>✅</div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1rem', color: 'var(--accent)', marginBottom: 8 }}>
                  No stuck GEN found
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                  Your GEN looks clean on Bradbury.
                </div>
              </div>
            )}
          </div>
        )}

        {/* HOW IT WORKS */}
        {!result && !scanning && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              How it works
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {[
                { n: '01', t: 'Connect wallet', d: 'Link your MetaMask on Bradbury testnet' },
                { n: '02', t: 'AI scans', d: 'Reads your full Bradbury tx history via the explorer API' },
                { n: '03', t: 'Identifies stuck GEN', d: 'Finds contracts that received GEN from you' },
                { n: '04', t: 'Copy recovery code', d: 'Add 10 lines to the contract and redeploy to unlock' },
              ].map(({ n, t, d }) => (
                <div key={n} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--accent)', letterSpacing: '-.04em', marginBottom: 6 }}>{n}</div>
                  <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 13, marginBottom: 5 }}>{t}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, padding: '20px clamp(1rem,4vw,2.5rem)',
        borderTop: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)',
        marginTop: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={GL_LOGO} alt="GL" style={{ height: 14, opacity: .5 }} />
          ClaimYourGEN · Bradbury Testnet · Chain 4221
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <a href={FAUCET} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Faucet</a>
          <a href={EXPLORER} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Explorer</a>
          <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Docs</a>
        </div>
      </footer>

      <Toast msg={toast.msg} type={toast.type} onClear={() => setToast({ msg: '', type: 'ok' })} />
    </div>
  )
}
