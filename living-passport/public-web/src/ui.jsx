import React, { useEffect, useRef, useState } from 'react';
import { ArrowSquareOut, Check, CopySimple, WarningCircle, CircleNotch, Wrench, ArrowsLeftRight, Sparkle } from '@phosphor-icons/react';

export const EXPLORER = 'https://testnet.explorer.nervos.org';
export const short = (value, head = 8, tail = 6) => (value ? `${value.slice(0, head)}…${value.slice(-tail)}` : '');
export const ckb = (shannons) => `${(Number(shannons) / 1e8).toLocaleString()} CKB`;

export const ACTIONS = {
  0: { label: 'Passport created', icon: Sparkle },
  1: { label: 'Repair recorded', icon: Wrench },
  2: { label: 'Ownership transferred', icon: ArrowsLeftRight },
};

export function TxLink({ hash, children }) {
  return <a className="tx-link" href={`${EXPLORER}/transaction/${hash}`} target="_blank" rel="noreferrer">
    {children ?? <code>{short(hash, 10, 8)}</code>}<ArrowSquareOut size={14} aria-hidden="true" />
  </a>;
}

export function Copy({ value, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setDone(true); timer.current = setTimeout(() => setDone(false), 1600); } catch { /* clipboard blocked */ }
  }
  return <button type="button" className="btn btn-quiet" onClick={copy}>
    {done ? <Check size={16} aria-hidden="true" /> : <CopySimple size={16} aria-hidden="true" />}{done ? 'Copied' : label}
  </button>;
}

export function Field({ label, hint, children }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function Notice({ kind = 'info', children }) {
  const Icon = kind === 'error' ? WarningCircle : kind === 'busy' ? CircleNotch : Check;
  return <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <Icon size={18} className={kind === 'busy' ? 'spin' : ''} aria-hidden="true" /><div>{children}</div>
  </div>;
}

export function Confirm({ request, onCancel, onConfirm }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onCancel]);
  return <div className="sheet-backdrop" role="presentation" onClick={onCancel}>
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(event) => event.stopPropagation()}>
      <h2 id="confirm-title">{request.title}</h2>
      <dl className="confirm-list">{request.rows.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
      {request.warning && <p className="confirm-warning"><WarningCircle size={18} aria-hidden="true" />{request.warning}</p>}
      <div className="sheet-actions">
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
        <button type="button" ref={ref} className={`btn ${request.danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{request.confirm}</button>
      </div>
    </div>
  </div>;
}
