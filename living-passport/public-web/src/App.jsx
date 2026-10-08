import React, { useEffect, useState } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { createPassport, transferPassport } from '../../src/public-actions.js';
import { loadPassport, passportLink } from '../../src/public-chain.js';

const deployment = {
  codeHash: import.meta.env.VITE_PASSPORT_CODE_HASH,
  hashType: import.meta.env.VITE_PASSPORT_HASH_TYPE || 'data2',
  txHash: import.meta.env.VITE_PASSPORT_CODE_TX_HASH,
  index: Number(import.meta.env.VITE_PASSPORT_CODE_INDEX ?? 0),
};
const deployed = /^0x[0-9a-fA-F]{64}$/.test(deployment.codeHash ?? '') && /^0x[0-9a-fA-F]{64}$/.test(deployment.txHash ?? '');
const names = ['Created', 'Repair', 'Transferred'];
const short = (value) => value ? `${value.slice(0, 12)}…${value.slice(-8)}` : '—';

export default function App() {
  const { client, open, disconnect, signerInfo } = ccc.useCcc();
  const signer = ccc.useSigner();
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('passport') ?? '');
  const [passport, setPassport] = useState(null);
  const [selected, setSelected] = useState(0);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState(null);
  const [tab, setTab] = useState('create');
  const [model, setModel] = useState('');
  const [owner, setOwner] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let active = true;
    signer?.getRecommendedAddress().then((result) => { if (active) setAddress(result); }).catch(() => { if (active) setAddress(''); });
    if (!signer) setAddress('');
    return () => { active = false; };
  }, [signer]);

  async function lookup(id = query, clearNotice = true) {
    if (!deployed) { setError('The passport contract has not been deployed to public testnet yet.'); return; }
    setPending('Looking up passport'); setError(''); if (clearNotice) setNotice('');
    try {
      const found = await loadPassport(client, deployment, id.trim());
      if (!found) throw new Error('No live passport Cell found with that ID.');
      setPassport(found); setQuery(id.trim()); setSelected(found.events.length - 1); setTab('transfer');
      history.replaceState(null, '', `?passport=${encodeURIComponent(id.trim())}`);
    } catch (cause) { setError(cause.message); }
    finally { setPending(''); }
  }

  useEffect(() => { if (query && deployed) void lookup(query); }, []);

  function askCreate(event) {
    event.preventDefault(); setError('');
    if (!signer) { setError('Connect a CKB testnet wallet first.'); return; }
    if (!model.trim() || !owner.trim() || !workshop.trim()) { setError('Fill in the model, owner label and workshop address.'); return; }
    setReview({ kind: 'create', title: 'Create this passport?', detail: `${model.trim()} / ${owner.trim()}`, target: workshop.trim(), risk: 'This locks at least 600 testnet CKB in a passport Cell. The current contract has no close/reclaim action. The text is public and permanent.' });
  }

  function askTransfer(event) {
    event.preventDefault(); setError('');
    if (!signer || !passport) { setError('Connect the current owner wallet and open a passport.'); return; }
    if (!recipient.trim() || !note.trim()) { setError('Enter the new owner’s testnet address and a public note.'); return; }
    setReview({ kind: 'transfer', title: 'Transfer this passport?', detail: note.trim(), target: recipient.trim(), risk: 'The recipient becomes the new owner of the passport Cell and its locked capacity. This cannot be undone by this wallet.' });
  }

  async function approve() {
    const item = review; setReview(null); setPending(item.kind === 'create' ? 'Creating passport' : 'Transferring passport'); setError(''); setNotice('');
    try {
      if (item.kind === 'create') {
        const result = await createPassport(signer, deployment, { model, owner, workshopAddress: workshop });
        setNotice(`Confirmed on public testnet: ${result.txHash}`);
        await lookup(result.args, false);
      } else {
        const txHash = await transferPassport(signer, deployment, passport, { recipientAddress: recipient, note });
        setNotice(`Confirmed on public testnet: ${txHash}`);
        await lookup(passport.id, false);
      }
    } catch (cause) { setError(cause.message); }
    finally { setPending(''); }
  }

  const event = passport?.events[selected];
  return <div className="app-shell">
    <header className="masthead"><a className="wordmark" href="/"><span className="wordmark-mark">LP</span><span>Living Passport</span></a><span className="mode-label"><span className="mode-dot" /> CKB PUBLIC TESTNET</span></header>
    <main>
      <section className="intro"><div><p className="eyebrow">A record that moves with the machine</p><h1>Know what happened<br /><em>before it was yours.</em></h1><p className="intro-copy">A laptop history carried by a CKB Cell. Look up the public record, or connect a wallet to make its next signed change.</p></div><div className="intro-index" aria-hidden="true"><span>OBJECT / 01</span><span>OWNERSHIP · SERVICE · HISTORY</span></div></section>
      <section className="network-bar" aria-label="Network and wallet"><div><strong>{deployed ? 'Public testnet contract configured' : 'Waiting for public testnet deployment'}</strong><span>{deployed ? `Code: ${short(deployment.codeHash)}` : 'The local prototype works, but this site cannot create or find public passports until the contract is deployed.'}</span></div><button type="button" onClick={() => signer ? disconnect() : open()}>{signer ? `Disconnect ${short(address)}` : 'Connect testnet wallet'}</button></section>
      <form className="lookup" onSubmit={(event) => { event.preventDefault(); void lookup(); }}><label htmlFor="passport-id">Open a passport by its ID</label><div><input id="passport-id" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="0x… 68-byte Type Script args" spellCheck="false" /><button type="submit" disabled={!deployed || !!pending}>Find passport</button></div></form>
      <div className="workspace"><section className="device-panel" aria-labelledby="device-heading"><div className="panel-head"><span className="panel-kicker">THE OBJECT</span><span className="index-badge">{passport ? `REVISION ${passport.sequence}` : 'NO RECORD'}</span></div><div className="device-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="laptop-screen"><div className="screen-glow" /><div className="screen-line" /><div className="screen-line short" /><div className="screen-grid" /></div><div className="laptop-hinge" /><div className="laptop-base"><div className="key-grid" /><div className="trackpad" /></div><div className="device-beam" /></div><div className="device-summary"><p className="eyebrow">LAPTOP PASSPORT</p><h2 id="device-heading">{passport ? passport.events[0].detail.split(' / ')[0] : 'No laptop open'}</h2><p>{passport ? 'History read from confirmed public-testnet transactions.' : 'Open an existing passport or create one with a testnet wallet.'}</p><div className="fact-grid"><div><span className="fact-label">Current owner Lock</span><strong title={passport?.ownerLockHash}>{short(passport?.ownerLockHash)}</strong></div><div><span className="fact-label">Capacity in Cell</span><strong>{passport ? `${Number(passport.capacity) / 1e8} CKB` : '—'}</strong></div></div><div className="hash-box"><span>ITEM ID</span><code>{passport?.itemId ?? 'Created with first signed event'}</code></div></div></section>
      <section className="history-panel" aria-labelledby="history-heading"><div className="panel-head"><span className="panel-kicker">THE RECORD</span><span className="index-badge">{passport?.events.length ?? 0} EVENTS</span></div><h2 id="history-heading">A history you can follow.</h2><p className="section-copy">Each event is read from a confirmed transaction and linked to the previous record.</p><div className="timeline">{passport ? passport.events.map((entry, index) => <button className={`timeline-item ${selected === index ? 'active' : ''}`} key={entry.txHash} type="button" onClick={() => setSelected(index)} aria-pressed={selected === index}><span className="timeline-meta">EVENT {String(index + 1).padStart(2, '0')} · TRANSACTION {short(entry.txHash)}</span><span className="timeline-title">{names[entry.action]} — {entry.detail}</span></button>) : <p className="empty-note">No passport loaded yet.</p>}</div>{event && <div className="event-detail"><div className="detail-top"><span>{names[event.action]}</span><span>#{event.sequence}</span></div><h3>{event.detail}</h3><p>Readable details, actor and recipient are part of the event hash verified by the contract.</p><dl><div><dt>Transaction</dt><dd><a href={`https://testnet.explorer.nervos.org/transaction/${event.txHash}`} target="_blank" rel="noreferrer"><code>{event.txHash}</code></a></dd></div><div><dt>Actor Lock</dt><dd><code>{event.actorHash}</code></dd></div><div><dt>Recipient Lock</dt><dd><code>{event.recipientHash}</code></dd></div><div><dt>History root</dt><dd><code>{event.historyRoot}</code></dd></div></dl></div>}</section></div>
      <section className="actions"><div className="actions-intro"><p className="eyebrow">NEXT STEP</p><h2>Work on the record</h2><p>Wallet approval is required for signed changes. This app never asks for a seed phrase.</p>{passport && <p><a href={passportLink(passport.id)}>Share this passport</a></p>}</div><div className="actions-main"><div className="action-tabs"><button type="button" aria-pressed={tab === 'create'} onClick={() => setTab('create')}>Create</button><button type="button" aria-pressed={tab === 'transfer'} onClick={() => setTab('transfer')}>Transfer</button></div>{tab === 'create' ? <form className="action-form" onSubmit={askCreate}><h3>Create a laptop passport</h3><div className="field-pair"><label>Model<input value={model} onChange={e => setModel(e.target.value)} maxLength={80} required placeholder="e.g. ThinkPad T480" /></label><label>Current owner label<input value={owner} onChange={e => setOwner(e.target.value)} maxLength={60} required placeholder="e.g. Amina" /></label></div><label>Workshop testnet address<input value={workshop} onChange={e => setWorkshop(e.target.value)} required placeholder="ckt1…" /></label><p className="form-hint">The workshop address is bound to this passport. A label is not proof of physical ownership or repair.</p><button disabled={!deployed || !signer || !!pending}>Review creation</button></form> : <form className="action-form" onSubmit={askTransfer}><h3>Transfer to a new owner</h3><label>Recipient testnet address<input value={recipient} onChange={e => setRecipient(e.target.value)} required placeholder="ckt1…" /></label><label>Public transfer note<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={160} rows={3} required placeholder="Why is this laptop changing hands?" /></label><button disabled={!deployed || !signer || !passport || !!pending}>Review transfer</button></form>}<p className="form-hint">Workshop-signed repair is proven on the local devnet, but the two-wallet public flow is not enabled here yet.</p></div></section>
      {pending && <p className="status-note" role="status">{pending}… Please keep this page open.</p>}{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="status-note" role="status">{notice}</p>}
      <aside className="boundary-note"><strong>What is actually verified?</strong><span>The CKB Type Script verifies the event bytes, owner and recipient Locks, history root and capacity. Names and physical repairs are not independently verified. This is a public-testnet experiment, not a production warranty or title registry.</span></aside>
    </main><footer><span>Living Passport / public-testnet preview</span><span>Built on the CKB Cell model</span></footer>
    {review && <div className="review-backdrop" role="presentation"><div className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title"><p className="eyebrow">SIGNATURE REVIEW</p><h2 id="review-title">{review.title}</h2><p>{review.detail}</p><p><strong>{review.kind === 'create' ? 'Workshop' : 'Recipient'}:</strong> <code>{review.target}</code></p><p className="review-risk">{review.risk}</p><div className="review-buttons"><button type="button" onClick={() => setReview(null)}>Cancel</button><button type="button" onClick={() => void approve()}>Continue to wallet</button></div></div></div>}
  </div>;
}
