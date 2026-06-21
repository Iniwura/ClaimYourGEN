import React, { useState, useEffect, useRef } from 'react'
import ContractCard from './components/ContractCard.jsx'
import { readContract, writeContract, waitTx, CHAIN_ID, NET } from './lib/gl.js'
import { CONTRACT_ADDR, FAUCET, EXPLORER, sh, weiToGen } from './lib/config.js'

const GL_LOGO    = 'https://cdn.prod.website-files.com/68108d68d0fc0cfa0c26dbc9/691359baf22648f4efd074b2_GenLayer_Logo_White_Cropped.svg'
const GL_MARK    = 'https://cdn.prod.website-files.com/68108d68d0fc0cfa0c26dbc9/691359b88e6b1fd0260a9fea_GenLayer_Mark_White.svg'
const MOCHI_IDEA = 'https://raw.githubusercontent.com/genlayer-foundation/genlayer-mascot/main/assets/stickers/mochi-sticker-idea.png'
const MOCHI_MAIN = 'https://raw.githubusercontent.com/genlayer-foundation/genlayer-mascot/main/assets/renders/mochi-main.png'

function Toast({ msg, type, onClear }) {
  useEffect(() => { if (!msg) return; const t = setTimeout(onClear, 5000); return () => clearTimeout(t) }, [msg])
  if (!msg) return null
  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'var(--card2)', border:`1px solid ${type==='err'?'rgba(239,68,68,.4)':'var(--border2)'}`, color:type==='err'?'#F87171':'var(--accent)', padding:'10px 22px', borderRadius:100, fontFamily:'var(--mono)', fontSize:11, zIndex:999, animation:'fin .3s var(--ease)' }}>{msg}</div>
  )
}

// Scan overlay — stays until results are fully loaded
function ScanOverlay({ phase }) {
  const phases = ['Connecting to Bradbury...', 'Fetching transaction history...', 'AI analysing wallet...', 'Calculating health score...', 'Finalising results...']
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, phases.length - 1)), 8000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(7,8,15,.9)', backdropFilter:'blur(10px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28 }}>
      {/* Scan frame */}
      <div style={{ position:'relative', width:180, height:180, border:'1px solid var(--border2)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ position:'absolute', left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,var(--accent),transparent)', animation:'scan 2s ease-in-out infinite', boxShadow:'0 0 12px rgba(226,232,240,.4)' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <img src={MOCHI_IDEA} alt="Mochi" style={{ width:70, objectFit:'contain', opacity:.8, animation:'pulse 2s ease-in-out infinite' }} />
        </div>
        {/* Corner brackets */}
        {[[8,8,'tl'],[8,'auto','tr'],['auto',8,'bl'],['auto','auto','br']].map(([t,l,k]) => (
          <div key={k} style={{ position:'absolute', top:typeof t==='number'?t:'auto', bottom:t==='auto'?8:'auto', left:typeof l==='number'?l:'auto', right:l==='auto'?8:'auto', width:14, height:14, borderTop:typeof t==='number'?'2px solid var(--accent)':'none', borderBottom:t==='auto'?'2px solid var(--accent)':'none', borderLeft:typeof l==='number'?'2px solid var(--accent)':'none', borderRight:l==='auto'?'2px solid var(--accent)':'none' }} />
        ))}
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:'1.1rem', marginBottom:10 }}>Scanning Bradbury</div>
        <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text2)', marginBottom:16, minHeight:18 }}>{phases[step]}</div>
        <div style={{ display:'flex', justifyContent:'center', gap:5 }}>
          {phases.map((_,i) => <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:i<=step?'var(--accent)':'var(--border)', transition:'background .3s' }} />)}
        </div>
      </div>
      <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--muted)' }}>AI consensus takes 1-3 min on Bradbury</div>
    </div>
  )
}

// Health score ring
function HealthRing({ score }) {
  const color = score >= 75 ? '#10B981' : score >= 45 ? '#F59E0B' : '#EF4444'
  const label = score >= 75 ? 'Healthy' : score >= 45 ? 'Moderate' : 'Low Activity'
  const r = 44, circ = 2 * Math.PI * r
  const dash = circ * (score / 100)
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 55 55)" style={{ transition:'stroke-dasharray .8s ease' }} />
        <text x={55} y={50} textAnchor="middle" fill={color} fontSize={20} fontWeight={800} fontFamily="Syne">{score}</text>
        <text x={55} y={66} textAnchor="middle" fill="var(--muted)" fontSize={9} fontFamily="DM Mono">/100</text>
      </svg>
      <span style={{ fontFamily:'var(--mono)', fontSize:10, color, letterSpacing:'.1em', textTransform:'uppercase' }}>{label}</span>
    </div>
  )
}

export default function App() {
  const [account,    setAccount]    = useState('')
  const [connected,  setConnected]  = useState(false)
  const [scanning,   setScanning]   = useState(false)
  const [result,     setResult]     = useState(null)
  const [cached,     setCached]     = useState(false)
  const [toast,      setToast]      = useState({ msg:'', type:'ok' })
  const [totalScans, setTotalScans] = useState('...')
  const resultsRef = useRef(null)

  const notify = (msg, type='ok') => setToast({ msg, type })

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method:'eth_accounts' }).then(a => {
        if (a?.[0]) { setAccount(a[0]); setConnected(true); window._glAccount = a[0] }
      }).catch(()=>{})
    }
    loadStats()
  }, [])

  async function loadStats() {
    if (!CONTRACT_ADDR) return
    try { const r = await readContract(CONTRACT_ADDR, 'get_total_scans', [], true); if (r) setTotalScans(r) } catch {}
  }

  async function connect() {
    if (!window.ethereum) { notify('Install MetaMask', 'err'); return }
    try {
      const accs  = await window.ethereum.request({ method:'eth_requestAccounts' })
      const chain = await window.ethereum.request({ method:'eth_chainId' })
      if (chain !== CHAIN_ID) {
        try { await window.ethereum.request({ method:'wallet_switchEthereumChain', params:[{chainId:CHAIN_ID}] }) }
        catch(e) { if(e.code===4902||e.code===-32603) await window.ethereum.request({ method:'wallet_addEthereumChain', params:[NET] }) }
      }
      setAccount(accs[0]); setConnected(true); window._glAccount = accs[0]
      notify('Connected', 'ok')
      window.ethereum.on('accountsChanged', a => { if (!a.length) { setAccount(''); setConnected(false) } })
    } catch(e) { notify(e.message, 'err') }
  }

  async function loadCachedScan(addr) {
    try {
      const raw = await readContract(CONTRACT_ADDR, 'get_scan', [addr], true)
      if (raw && raw !== 'NOT_FOUND') {
        setResult(JSON.parse(raw)); setCached(true); return true
      }
    } catch {}
    return false
  }

  async function runScan() {
    if (!connected) { notify('Connect wallet first', 'err'); return }
    if (!CONTRACT_ADDR) { notify('Contract not deployed', 'err'); return }
    setScanning(true); setResult(null); setCached(false)
    try {
      // Submit transaction
      const hash = await writeContract(CONTRACT_ADDR, account, 'scan_wallet', [account])
      // Wait for tx to be ACCEPTED on chain — overlay stays the whole time
      await waitTx(hash, () => {}, 50)
      // Then load results — overlay still showing
      const loaded = await loadCachedScan(account)
      if (!loaded) {
        // Try one more time after a brief wait
        await new Promise(r => setTimeout(r, 3000))
        await loadCachedScan(account)
      }
      await loadStats()
      // Scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 300)
    } catch(e) { notify(e.message, 'err') }
    finally { setScanning(false) }
  }

  useEffect(() => {
    if (connected && account && CONTRACT_ADDR) loadCachedScan(account)
  }, [connected, account])

  const stuckContracts = result?.stuck_gen || []
  const stuckGen       = weiToGen(result?.total_stuck_wei || '0')
  const hasStuck       = stuckContracts.length > 0

  return (
    <div style={{ position:'relative', zIndex:1, minHeight:'100vh' }}>
      {scanning && <ScanOverlay />}

      {/* HEADER */}
      <header style={{ position:'sticky', top:0, zIndex:100, height:56, display:'flex', alignItems:'center', gap:12, padding:'0 clamp(1rem,4vw,2.5rem)', background:'rgba(7,8,15,.92)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <img src={GL_MARK} alt="GL" style={{ width:24, height:24 }} />
          <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15, letterSpacing:'-.02em' }}>ClaimYourGEN</span>
          <span style={{ fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.12em', background:'var(--accent-dim)', border:'1px solid var(--border2)', color:'var(--accent)', padding:'2px 8px', borderRadius:100 }}>BRADBURY</span>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--muted)' }}>{totalScans} scans</div>
          {connected
            ? <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid var(--border2)', padding:'5px 14px', borderRadius:100, display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', display:'inline-block', animation:'pulse 2s infinite' }} />
                {sh(account)}
              </div>
            : <button className="btn btn-outline" style={{ fontSize:12, padding:'7px 16px' }} onClick={connect}>Connect Wallet</button>
          }
        </div>
      </header>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'clamp(2rem,6vw,4rem) clamp(1rem,4vw,2rem)' }}>

        {/* HERO */}
        <div style={{ textAlign:'center', marginBottom: result ? 40 : 56 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.15em', textTransform:'uppercase', color:'var(--accent)', border:'1px solid var(--border2)', background:'var(--accent-dim)', padding:'5px 16px', borderRadius:100, marginBottom:20 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', display:'inline-block', animation:'blink 2s infinite' }} />
            GenLayer Bradbury · Wallet Health Scanner
          </div>

          <h1 style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:'clamp(2rem,6vw,3.8rem)', letterSpacing:'-.05em', lineHeight:.95, marginBottom:16 }}>
            {result ? `Scan complete.` : <>Find your<br /><span style={{ color:'var(--accent)' }}>stuck GEN.</span></>}
          </h1>

          {!result && (
            <p style={{ fontSize:14, color:'var(--text2)', maxWidth:460, margin:'0 auto 28px', lineHeight:1.8 }}>
              Connect your wallet. The AI scans your full Bradbury history — balance, stuck GEN, pending txs, gas spent, activity score.
            </p>
          )}

          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20, flexWrap:'wrap', marginBottom:12 }}>
            {connected
              ? <button className="btn btn-accent" style={{ fontSize:14, padding:'12px 28px' }} disabled={scanning} onClick={runScan}>
                  {scanning ? <><span className="spin-el" style={{ marginRight:8 }} />Scanning...</> : result ? 'Rescan' : 'Scan My Wallet'}
                </button>
              : <button className="btn btn-accent" style={{ fontSize:14, padding:'12px 28px' }} onClick={connect}>
                  Connect Wallet to Scan
                </button>
            }
            {!result && <img src={MOCHI_MAIN} alt="Mochi" style={{ width:80, objectFit:'contain', animation:'float 3s ease-in-out infinite', filter:'drop-shadow(0 0 16px rgba(226,232,240,.12))' }} />}
          </div>

          {cached && result && (
            <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--muted)' }}>
              Cached from {result.scanned_at?.slice(0,10) || 'earlier'} ·{' '}
              <span style={{ color:'var(--accent)', cursor:'pointer' }} onClick={runScan}>Rescan</span>
            </div>
          )}
        </div>

        {/* RESULTS DASHBOARD */}
        {result && (
          <div ref={resultsRef} style={{ animation:'pop .4s var(--ease) both' }}>

            {/* Top row — health ring + stats */}
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:20, marginBottom:20, alignItems:'start' }}>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'20px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <HealthRing score={result.health_score || 0} />
                <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--muted)', textAlign:'center', marginTop:4 }}>Wallet Health</div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { val: result.total_transactions || 0,       label:'Total Txs',          col:'var(--accent)' },
                  { val: result.pending_tx_count || 0,         label:'Pending',             col: (result.pending_tx_count||0)>0 ? 'var(--warn)' : 'var(--accent)' },
                  { val: result.contracts_interacted || 0,     label:'Contracts Used',      col:'var(--accent)' },
                  { val: result.contracts_deployed || 0,       label:'Contracts Deployed',  col:'var(--accent)' },
                  { val: `${weiToGen(result.total_gas_spent_wei||'0')} GEN`, label:'Gas Spent', col:'var(--text2)' },
                  { val: hasStuck ? `${stuckGen} GEN` : 'None', label:'Stuck GEN',         col: hasStuck ? 'var(--bad)' : 'var(--good)' },
                ].map(({val, label, col}) => (
                  <div key={label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'12px 14px' }}>
                    <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:'1.1rem', color:col, letterSpacing:'-.02em', lineHeight:1, marginBottom:4 }}>{val}</div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--muted)', letterSpacing:'.08em', textTransform:'uppercase' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* First tx + activity summary */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 18px', marginBottom:20, display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
              {result.first_tx_date && (
                <div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:3 }}>First Tx on Bradbury</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)' }}>{result.first_tx_date}</div>
                </div>
              )}
              {result.activity_summary && (
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:3 }}>AI Summary</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text2)', lineHeight:1.6 }}>{result.activity_summary}</div>
                </div>
              )}
            </div>

            {/* Health note */}
            {result.health_note && (
              <div style={{ background:'var(--accent-dim)', border:'1px solid var(--border2)', borderRadius:'var(--r)', padding:'12px 18px', marginBottom:20, fontFamily:'var(--mono)', fontSize:11, color:'var(--accent)', display:'flex', gap:10, alignItems:'center' }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)' }}>[i]</span> {result.health_note}
              </div>
            )}

            {/* Stuck GEN section */}
            {hasStuck ? (
              <>
                <div style={{ fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', marginBottom:14, display:'flex', alignItems:'center', gap:10 }}>
                  Stuck GEN Found — {stuckContracts.length} contract{stuckContracts.length!==1?'s':''}
                  <div style={{ flex:1, height:1, background:'var(--border)' }} />
                  <span style={{ color:'var(--bad)' }}>{stuckGen} GEN total</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28 }}>
                  {stuckContracts.map((c,i) => <ContractCard key={c.address+i} entry={c} index={i} />)}
                </div>
              </>
            ) : (
              <div style={{ textAlign:'center', padding:'40px 24px', border:'1px solid var(--border)', borderRadius:'var(--r)', background:'var(--card)', marginBottom:28 }}>
                
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:'.95rem', color:'var(--accent)', marginBottom:6 }}>No stuck GEN found</div>
                <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--muted)' }}>Your GEN is clean on Bradbury.</div>
              </div>
            )}
          </div>
        )}

        {/* HOW IT WORKS — only when no result */}
        {!result && !scanning && (
          <div>
            <div style={{ fontFamily:'var(--mono)', fontSize:9, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--muted)', marginBottom:14, display:'flex', alignItems:'center', gap:10 }}>
              What we scan <div style={{ flex:1, height:1, background:'var(--border)' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px,1fr))', gap:10 }}>
              {[
                { icon:'[GEN]', t:'GEN Balance',        d:'Current wallet balance on Bradbury' },
                { icon:'[SCAN]', t:'Stuck GEN',          d:'Contracts that received your GEN and may be holding it' },
                { icon:'[PEND]', t:'Pending Txs',        d:'How many transactions are queued or unfinalized' },
                { icon:'[GAS]', t:'Gas Spent',          d:'Total fees paid across all Bradbury transactions' },
                { icon:'[SCORE]', t:'Activity Score',     d:'0-100 health score based on your on-chain history' },
                { icon:'[DATE]', t:'First Transaction',  d:'When you first appeared on Bradbury' },
              ].map(({ icon, t, d }) => (
                <div key={t} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'16px 18px' }}>
                  <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--muted)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:6 }}>{icon}</div>
                  <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13, marginBottom:5 }}>{t}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--muted)', lineHeight:1.6 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, padding:'20px clamp(1rem,4vw,2.5rem)', borderTop:'1px solid var(--border)', fontFamily:'var(--mono)', fontSize:10, color:'var(--muted)', marginTop:40 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <img src={GL_LOGO} alt="GL" style={{ height:14, opacity:.4 }} />
          ClaimYourGEN · Wallet Health Scanner · Bradbury Testnet
        </div>
        <div style={{ display:'flex', gap:14 }}>
          <a href={FAUCET} target="_blank" rel="noreferrer" style={{ color:'var(--muted)', textDecoration:'none' }}>Faucet</a>
          <a href={EXPLORER} target="_blank" rel="noreferrer" style={{ color:'var(--muted)', textDecoration:'none' }}>Explorer</a>
          <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer" style={{ color:'var(--muted)', textDecoration:'none' }}>Docs</a>
        </div>
      </footer>

      <Toast msg={toast.msg} type={toast.type} onClear={() => setToast({msg:'',type:'ok'})} />
    </div>
  )
}
