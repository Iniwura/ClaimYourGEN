import React, { useState } from 'react'
import { sh, weiToGen, EXPLORER } from '../lib/config.js'

const RECOVERY_SNIPPET = `# ── ClaimYourGEN Recovery Module ──────────────────────────
# Add this to your GenLayer Intelligent Contract to allow
# GEN recovery via ClaimYourGEN (claimyourgen.vercel.app)

@gl.evm.contract_interface
class _EOA:
    class View: pass
    class Write: pass

@gl.public.view
def supports_gen_recovery(self) -> str:
    return "true"

@gl.public.write
def recover_gen(self, recipient: str, amount_wei: int):
    """ClaimYourGEN recovery — owner only."""
    if str(gl.message.sender_address).lower() != self.owner.lower():
        raise Exception("Only owner can recover GEN")
    _EOA(Address(recipient)).emit_transfer(value=u256(amount_wei))`

export default function ContractCard({ entry, index }) {
  const [copied, setCopied] = useState(false)
  const gen = weiToGen(entry.amount_wei)

  const copy = () => {
    navigator.clipboard.writeText(RECOVERY_SNIPPET).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--r)', padding: '18px 20px',
      animation: `fin .3s var(--ease) ${index * 0.05}s both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          {/* Contract address */}
          <a href={`${EXPLORER}/address/${entry.address}`} target="_blank" rel="noreferrer"
            style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', textDecoration: 'none', letterSpacing: '.02em' }}>
            {sh(entry.address)}
          </a>
          {entry.tx_date && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
              Sent {entry.tx_date}
            </div>
          )}
        </div>

        {/* GEN amount */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--warn)', letterSpacing: '-.02em', lineHeight: 1 }}>
            {gen} <span style={{ fontSize: 12, fontWeight: 400 }}>GEN</span>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 3 }}>
            Potentially stuck
          </div>
        </div>
      </div>

      {/* Tx hash */}
      {entry.tx_hash && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)',
          background: 'var(--bg2)', borderRadius: 6, padding: '6px 10px', marginBottom: 12,
        }}>
          tx: <a href={`${EXPLORER}/tx/${entry.tx_hash}`} target="_blank" rel="noreferrer"
            style={{ color: 'var(--text2)', textDecoration: 'none' }}>
            {sh(entry.tx_hash)}
          </a>
        </div>
      )}

      {/* Recovery section */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>
            Recovery status
          </div>
          <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 12, color: 'var(--text2)' }}>
            Add recovery code to this contract to unlock
          </div>
        </div>
        <button className="btn btn-copy" onClick={copy} style={{ flexShrink: 0 }}>
          {copied ? 'Copied' : 'Copy Code'}
        </button>
      </div>
    </div>
  )
}
