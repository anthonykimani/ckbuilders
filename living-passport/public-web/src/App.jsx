import React, { useCallback, useEffect, useState } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { Laptop, MagnifyingGlass, Plus, Wallet, SignOut, ShareNetwork, ArrowLeft, Wrench, ArrowsLeftRight, Trash, SealCheck, ShieldCheck } from '@phosphor-icons/react';
import { closePassport, createPassport, transferPassport } from '../../src/public-actions.js';
import { loadPassport, passportLink } from '../../src/public-chain.js';
import { approveRepair, decodeRequest, draftRepair, encodeRequest, reviewRepair } from '../../src/public-repair.js';
import published from '../deployment.testnet.json';
import { ACTIONS, Confirm, Copy, Field, Notice, TxLink, ckb, short } from './ui.jsx';

const env = import.meta.env;
const deployment = {
  codeHash: env.VITE_PASSPORT_CODE_HASH || published.codeHash,
  hashType: env.VITE_PASSPORT_HASH_TYPE || published.hashType || 'data2',
  txHash: env.VITE_PASSPORT_CODE_TX_HASH || published.txHash,
  index: Number(env.VITE_PASSPORT_CODE_INDEX ?? published.index ?? 0),
};
const deployed = /^0x[0-9a-fA-F]{64}$/.test(deployment.codeHash ?? '') && /^0x[0-9a-fA-F]{64}$/.test(deployment.txHash ?? '');
const params = () => new URLSearchParams(location.search);

export default function App() {
  const { client, open, disconnect } = ccc.useCcc();
  const signer = ccc.useSigner();
  const [me, setMe] = useState({ address: '', lockHash: '' });
  const [view, setView] = useState(() => (location.hash.startsWith('#repair=') ? 'approve' : params().get('passport') && deployed ? 'loading' : 'home'));
  const [passport, setPassport] = useState(null);
  const [request, setRequest] = useState(null);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    let active = true;
    if (!signer) { setMe({ address: '', lockHash: '' }); return undefined; }
    signer.getRecommendedAddressObj().then(async (obj) => {
      if (active) setMe({ address: await signer.getRecommendedAddress(), lockHash: obj.script.hash() });
    }).catch(() => active && setMe({ address: '', lockHash: '' }));
    return () => { active = false; };
  }, [signer]);

  const run = useCallback(async (label, task) => {
    setBusy(label); setError(''); setDone(null);
    try { return await task(); } catch (cause) { setError(cause?.message ?? String(cause)); setView((current) => (current === 'loading' ? 'home' : current)); return undefined; } finally { setBusy(''); }
  }, []);

  const openPassport = useCallback((id, { quiet = false } = {}) => run(quiet ? '' : 'Reading the passport from testnet', async () => {
    const found = await loadPassport(client, deployment, id.trim());
    if (!found) { setView('home'); throw new Error('No live passport has that ID. It may have been closed, or the ID is mistyped.'); }
    setPassport(found); setView('passport');
    history.replaceState(null, '', `?passport=${encodeURIComponent(found.id)}`);
    return found;
  }), [client, run]);

  useEffect(() => {
    if (!deployed) return;
    if (location.hash.startsWith('#repair=')) {
      void run('Checking the repair request', async () => {
        const decoded = await decodeRequest(location.hash.slice('#repair='.length));
        setRequest(decoded); setView('approve');
        const [summary, current] = await Promise.all([reviewRepair(client, deployment, decoded), loadPassport(client, deployment, decoded.passport)]);
        setReview(summary); setPassport(current);
      });
    } else if (params().get('passport')) {
      void openPassport(params().get('passport'));
    }
    // Initial route only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goHome = () => { setView('home'); setPassport(null); setRequest(null); setReview(null); setError(''); setDone(null); history.replaceState(null, '', location.pathname); };
  const ask = (details) => new Promise((resolve) => setConfirm({ ...details, resolve }));
  const answer = (value) => { confirm?.resolve(value); setConfirm(null); };

  const role = passport && me.lockHash ? (me.lockHash === passport.ownerLockHash ? 'owner' : me.lockHash === passport.workshopLockHash ? 'workshop' : 'viewer') : null;

  return <div className="shell">
    <header className="topbar">
      <button type="button" className="brand" onClick={goHome}><Laptop size={22} weight="duotone" aria-hidden="true" /><span>Living Passport</span></button>
      <div className="topbar-right">
        <span className="net-chip">Testnet</span>
        {signer
          ? <button type="button" className="btn btn-quiet wallet-btn" onClick={disconnect} title="Disconnect wallet"><code>{short(me.address, 7, 4)}</code><SignOut size={16} aria-hidden="true" /></button>
          : <button type="button" className="btn btn-primary wallet-btn" onClick={open}><Wallet size={16} aria-hidden="true" />Connect</button>}
      </div>
    </header>

    <main className="content">
      {!deployed && <Notice kind="error">The passport contract is not configured for this site yet.</Notice>}
      {busy && <Notice kind="busy">{busy}. Keep this page open.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {done && <Notice>{done.text} {done.tx && <TxLink hash={done.tx} />}</Notice>}

      {view === 'loading' && <Skeleton />}
      {view === 'home' && <Home onOpen={openPassport} onCreate={() => { setError(''); setView('create'); }} disabled={!deployed || !!busy} />}

      {view === 'create' && <CreateView signer={signer} me={me} disabled={!deployed || !!busy} onBack={goHome}
        onSubmit={async (form) => {
          const ok = await ask({ title: 'Create this passport?', confirm: 'Continue to wallet', rows: [['Laptop', form.model], ['Owner label', form.owner], ['Workshop wallet', <code key="w">{short(form.workshop, 12, 8)}</code>]], warning: '600 testnet CKB stays inside the passport until its owner closes it. Everything you type is public and permanent.' });
          if (!ok) return;
          const result = await run('Creating the passport', () => createPassport(signer, deployment, { model: form.model, owner: form.owner, workshopAddress: form.workshop }));
          if (result) { await openPassport(result.args, { quiet: true }); setDone({ text: 'Passport created.', tx: result.txHash }); }
        }} />}

      {view === 'passport' && passport && <PassportView passport={passport} role={role} me={me} signer={signer} busy={!!busy} onBack={goHome}
        onRepair={async (note) => {
          const draft = await run('Preparing the repair record', async () => {
            const req = await draftRepair(signer, deployment, passport, note);
            return `${location.origin}${location.pathname}#repair=${await encodeRequest(req)}`;
          });
          return draft;
        }}
        onTransfer={async (form) => {
          const ok = await ask({ title: 'Hand over this passport?', confirm: 'Continue to wallet', rows: [['New owner', <code key="r">{short(form.recipient, 12, 8)}</code>], ['Public note', form.note]], warning: 'The new owner controls the passport from now on. This wallet cannot take it back.' });
          if (!ok) return false;
          const tx = await run('Transferring the passport', () => transferPassport(signer, deployment, passport, { recipientAddress: form.recipient, note: form.note }));
          if (tx) { await openPassport(passport.id, { quiet: true }); setDone({ text: 'Passport handed over.', tx }); }
          return !!tx;
        }}
        onClose={async () => {
          const ok = await ask({ title: 'Close this passport?', confirm: 'Close passport', danger: true, rows: [['Returned to you', ckb(passport.capacity)], ['History', `${passport.events.length} events stay in past transactions`]], warning: 'The passport stops being live. Nobody can add repairs or transfer it after this.' });
          if (!ok) return;
          const tx = await run('Closing the passport', () => closePassport(signer, deployment, passport));
          if (tx) { goHome(); setDone({ text: 'Passport closed and capacity returned.', tx }); }
        }} />}

      {view === 'approve' && <ApproveView review={review} passport={passport} me={me} signer={signer} busy={!!busy} onConnect={open}
        onApprove={async () => {
          const tx = await run('Signing and submitting the repair', () => approveRepair(signer, deployment, request));
          if (tx) { history.replaceState(null, '', `?passport=${encodeURIComponent(request.passport)}`); await openPassport(request.passport, { quiet: true }); setDone({ text: 'Repair added to the passport.', tx }); }
        }} />}
    </main>

    <footer className="footer">
      <span>An experiment on the CKB public testnet. Not a warranty, title or proof that a repair happened.</span>
      {deployed && <TxLink hash={deployment.txHash}>Contract</TxLink>}
    </footer>
    {confirm && <Confirm request={confirm} onCancel={() => answer(false)} onConfirm={() => answer(true)} />}
  </div>;
}

function Skeleton() {
  return <section className="passport" aria-hidden="true">
    <div className="passport-grid">
      <div className="card summary skeleton"><span /><span /><span /></div>
      <div className="card timeline-card skeleton"><span /><span /><span /><span /></div>
    </div>
  </section>;
}

function Home({ onOpen, onCreate, disabled }) {
  const [id, setId] = useState('');
  return <section className="home">
    <div className="home-copy">
      <h1>The service history that travels with the laptop.</h1>
      <p className="lede">Repairs and owners recorded on CKB, signed by the people involved. Check it before you buy.</p>
      <form className="lookup" onSubmit={(event) => { event.preventDefault(); if (id.trim()) void onOpen(id); }}>
        <Field label="Passport ID">
          <div className="input-row">
            <input value={id} onChange={(event) => setId(event.target.value)} placeholder="0x…" spellCheck="false" autoComplete="off" />
            <button className="btn btn-primary" disabled={disabled || !id.trim()}><MagnifyingGlass size={16} aria-hidden="true" />Open</button>
          </div>
        </Field>
      </form>
      <button type="button" className="btn btn-quiet" onClick={onCreate} disabled={disabled}><Plus size={16} aria-hidden="true" />Create a passport</button>
    </div>
    <ol className="how">
      <li><Wrench size={20} aria-hidden="true" /><div><strong>The workshop drafts a repair</strong><span>and sends the owner a link.</span></div></li>
      <li><SealCheck size={20} aria-hidden="true" /><div><strong>The owner checks and co-signs</strong><span>so neither side can write the record alone.</span></div></li>
      <li><ArrowsLeftRight size={20} aria-hidden="true" /><div><strong>The passport moves at resale</strong><span>and the buyer sees every signed event.</span></div></li>
    </ol>
  </section>;
}

function CreateView({ signer, disabled, onSubmit, onBack }) {
  const [form, setForm] = useState({ model: '', owner: '', workshop: '' });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const ready = form.model.trim() && form.owner.trim() && form.workshop.trim();
  return <section className="panel narrow">
    <button type="button" className="back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back</button>
    <h1>Create a passport</h1>
    <p className="lede">Your connected wallet becomes the first owner. You can hand it to the customer afterwards.</p>
    <form className="stack" onSubmit={(event) => { event.preventDefault(); if (ready) void onSubmit(form); }}>
      <Field label="Laptop model" hint="Avoid serial numbers. This text is public."><input value={form.model} onChange={set('model')} maxLength={80} placeholder="ThinkPad T480" /></Field>
      <Field label="Owner label" hint="A first name or shop label, not a phone number."><input value={form.owner} onChange={set('owner')} maxLength={60} placeholder="Wanjiru" /></Field>
      <Field label="Workshop testnet address" hint="Only this wallet can draft repairs for this passport."><input value={form.workshop} onChange={set('workshop')} placeholder="ckt1…" spellCheck="false" autoComplete="off" /></Field>
      {!signer && <p className="field-hint">Connect a testnet wallet holding at least 601 CKB to continue.</p>}
      <button className="btn btn-primary" disabled={disabled || !signer || !ready}>Review passport</button>
    </form>
  </section>;
}

function PassportView({ passport, role, me, signer, busy, onBack, onRepair, onTransfer, onClose }) {
  const [model, ownerLabel] = passport.events[0].detail.split(' / ');
  return <section className="passport">
    <button type="button" className="back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />All passports</button>
    <div className="passport-grid">
      <article className="card summary">
        <Laptop size={36} weight="duotone" className="summary-icon" aria-hidden="true" />
        <h1>{model}</h1>
        <p className="muted">First registered to {ownerLabel ?? 'its owner'}</p>
        <dl className="facts">
          <div><dt>Current owner</dt><dd><code>{short(passport.ownerLockHash)}</code>{role === 'owner' && <span className="you">you</span>}</dd></div>
          <div><dt>Workshop</dt><dd><code>{short(passport.workshopLockHash)}</code>{role === 'workshop' && <span className="you">you</span>}</dd></div>
          <div><dt>Events</dt><dd>{passport.events.length}</dd></div>
          <div><dt>Held in cell</dt><dd>{ckb(passport.capacity)}</dd></div>
        </dl>
        <div className="share-row"><Copy value={passportLink(passport.id)} label="Copy passport link" /></div>
      </article>

      <article className="card timeline-card">
        <h2>History</h2>
        <ol className="timeline">
          {[...passport.events].reverse().map((event) => {
            const { label, icon: Icon } = ACTIONS[event.action];
            return <li key={event.txHash} className={`event event-${event.action}`}>
              <span className="event-icon"><Icon size={16} aria-hidden="true" /></span>
              <div className="event-body">
                <strong>{label}</strong>
                <p>{event.action === 0 ? event.detail.replace(' / ', ', registered to ') : event.detail}</p>
                <TxLink hash={event.txHash} />
              </div>
            </li>;
          })}
        </ol>
      </article>

      <article className="card actions-card">
        <h2>{role === 'workshop' ? 'Record a repair' : role === 'owner' ? 'Owner actions' : 'Make a change'}</h2>
        {!signer && <p className="muted">Connect the owner’s or the workshop’s wallet to change this passport.</p>}
        {signer && role === 'viewer' && <p className="muted">The connected wallet <code>{short(me.address, 7, 4)}</code> is neither the owner nor the workshop for this passport.</p>}
        {role === 'workshop' && <RepairForm busy={busy} onRepair={onRepair} />}
        {role === 'owner' && <OwnerActions busy={busy} onTransfer={onTransfer} onClose={onClose} />}
      </article>
    </div>
  </section>;
}

function RepairForm({ busy, onRepair }) {
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const bytes = new TextEncoder().encode(note.trim()).length;
  if (link) {
    return <div className="stack">
      <Notice>Draft signed by the workshop. Nothing changes until the owner approves it.</Notice>
      <p className="muted">Send this link to the owner. It opens a review page where they co-sign with their wallet.</p>
      <div className="button-row">
        <Copy value={link} label="Copy link" />
        {navigator.share && <button type="button" className="btn btn-primary" onClick={() => navigator.share({ title: 'Approve laptop repair', text: 'Please review and approve this repair on the laptop passport.', url: link }).catch(() => {})}><ShareNetwork size={16} aria-hidden="true" />Share</button>}
      </div>
      <button type="button" className="btn btn-quiet" onClick={() => { setLink(''); setNote(''); }}>Draft a different repair</button>
    </div>;
  }
  return <form className="stack" onSubmit={async (event) => { event.preventDefault(); const result = await onRepair(note); if (result) setLink(result); }}>
    <Field label="What was done" hint={`${bytes}/160 bytes. Public and permanent once the owner approves.`}>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Replaced battery, cleaned fan, tested charging port" />
    </Field>
    <button className="btn btn-primary" disabled={busy || !bytes || bytes > 160}><Wrench size={16} aria-hidden="true" />Sign draft</button>
    <p className="field-hint">Your wallet pays the small network fee. The owner co-signs for free.</p>
  </form>;
}

function OwnerActions({ busy, onTransfer, onClose }) {
  const [form, setForm] = useState({ recipient: '', note: '' });
  const ready = form.recipient.trim() && form.note.trim();
  return <div className="stack">
    <form className="stack" onSubmit={async (event) => { event.preventDefault(); if (await onTransfer(form)) setForm({ recipient: '', note: '' }); }}>
      <Field label="New owner’s testnet address"><input value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })} placeholder="ckt1…" spellCheck="false" autoComplete="off" /></Field>
      <Field label="Public note"><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} maxLength={160} placeholder="Sold after battery replacement" /></Field>
      <button className="btn btn-primary" disabled={busy || !ready}><ArrowsLeftRight size={16} aria-hidden="true" />Hand over</button>
    </form>
    <p className="field-hint">Repairs are drafted by the workshop. You will receive a link to approve them.</p>
    <button type="button" className="btn btn-danger-quiet" disabled={busy} onClick={onClose}><Trash size={16} aria-hidden="true" />Close passport</button>
  </div>;
}

function ApproveView({ review, passport, me, signer, busy, onConnect, onApprove }) {
  if (!review || !passport) return <section className="panel narrow"><h1>Repair approval</h1><p className="muted">Loading the request from testnet…</p></section>;
  const isOwner = me.lockHash === review.ownerLockHash;
  const [model] = passport.events[0].detail.split(' / ');
  return <section className="panel narrow">
    <p className="kicker">Repair approval</p>
    <h1>{model}</h1>
    <blockquote className="repair-note">{review.note}</blockquote>
    <ul className="checks">
      <li><ShieldCheck size={18} aria-hidden="true" />Drafted by the workshop named on this passport</li>
      <li><ShieldCheck size={18} aria-hidden="true" />The passport stays with you, with the same capacity</li>
      <li><ShieldCheck size={18} aria-hidden="true" />No other funds leave your wallet</li>
      <li><ShieldCheck size={18} aria-hidden="true" />Becomes event {review.sequence + 1} after {passport.events.length} confirmed events</li>
    </ul>
    {!signer && <button type="button" className="btn btn-primary" onClick={onConnect}><Wallet size={16} aria-hidden="true" />Connect owner wallet</button>}
    {signer && !isOwner && <Notice kind="error">This wallet is not the passport owner. Connect the owner’s wallet to approve.</Notice>}
    {signer && isOwner && <button type="button" className="btn btn-primary" disabled={busy} onClick={onApprove}><SealCheck size={16} aria-hidden="true" />Approve and sign</button>}
    <p className="field-hint">If the note is wrong, do not approve. Ask the workshop for a new link.</p>
  </section>;
}
