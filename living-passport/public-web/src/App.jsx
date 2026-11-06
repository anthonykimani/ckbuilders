import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ccc } from '@ckb-ccc/connector-react';
import { Laptop, MagnifyingGlass, Plus, Wallet, SignOut, ShareNetwork, ArrowLeft, Wrench, ArrowsLeftRight, Trash, SealCheck, ShieldCheck, CopySimple, Check, Tray, Storefront, QrCode, Printer, UserCirclePlus, Package } from '@phosphor-icons/react';
import QRCode from 'qrcode';
import { closePassport, createPassport, shopRepair, transferPassport } from '../../src/public-actions.js';
import { COLLECTED, listPassports, loadPassport, passportLink, shopStatus } from '../../src/public-chain.js';
import { findShops, removeShop, saveShop } from '../../src/public-did.js';
import { approveRepair, decodeRequest, draftRepair, encodeRequest, reviewRepair } from '../../src/public-repair.js';
import published from '../deployment.testnet.json';
import { fetchClaims, fetchDrafts, inboxEnabled, postClaim, postDraft } from './inbox.js';
import { ACTIONS, Confirm, Copy, Field, Notice, Party, TxLink, ckb, short } from './ui.jsx';

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
  const walletSigner = ccc.useSigner();
  // Browser e2e builds only (`vite build --mode e2e`): the test runner injects a throwaway
  // testnet key so the real UI can be driven without the JoyID popup. Never in production.
  const testSigner = useMemo(() => (import.meta.env.MODE === 'e2e' && window.__LP_TEST_KEY ? new ccc.SignerCkbPrivateKey(client, window.__LP_TEST_KEY) : null), [client]);
  const signer = testSigner ?? walletSigner;
  const [me, setMe] = useState({ address: '', lockHash: '' });
  const [view, setView] = useState(() => (location.hash.startsWith('#repair=') ? 'approve' : params().get('passport') && deployed ? 'loading' : 'home'));
  const [passport, setPassport] = useState(null);
  const [request, setRequest] = useState(null);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [myShop, setMyShop] = useState(undefined);
  const [shops, setShops] = useState(new Map());
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    let active = true;
    if (!signer) { setMe({ address: '', lockHash: '' }); return undefined; }
    signer.getRecommendedAddressObj().then(async (obj) => {
      if (active) setMe({ address: await signer.getRecommendedAddress(), lockHash: obj.script.hash() });
    }).catch(() => active && setMe({ address: '', lockHash: '' }));
    return () => { active = false; };
  }, [signer]);

  // The connected wallet's own shop identity: undefined while loading, null if it has none.
  const reloadMyShop = useCallback(async (lockHash) => {
    const found = await findShops(client, [lockHash]);
    setMyShop(found.get(lockHash) ?? null);
  }, [client]);
  useEffect(() => {
    setMyShop(undefined);
    if (me.lockHash) reloadMyShop(me.lockHash).catch(() => {});
  }, [me.lockHash, reloadMyShop]);

  // Names for the wallets on the open passport. Without them the page shows wallet codes.
  const workshopHash = passport?.workshopLockHash;
  const ownerHash = passport?.ownerLockHash;
  useEffect(() => {
    let active = true;
    setShops(new Map());
    if (workshopHash) findShops(client, [workshopHash, ownerHash]).then((found) => active && setShops(found)).catch(() => {});
    return () => { active = false; };
  }, [client, workshopHash, ownerHash, myShop]);

  // Notices sit above the form; on a phone the user is scrolled down to the button.
  useEffect(() => { if (busy || error || done) window.scrollTo({ top: 0, behavior: 'smooth' }); }, [busy, error, done]);

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

  const openRequest = useCallback((encoded) => run('Checking the repair request', async () => {
    const decoded = await decodeRequest(encoded);
    setRequest(decoded); setReview(null); setView('approve');
    history.replaceState(null, '', `${location.pathname}#repair=${encoded}`);
    const [summary, current] = await Promise.all([reviewRepair(client, deployment, decoded), loadPassport(client, deployment, decoded.passport)]);
    setReview(summary); setPassport(current);
  }), [client, run]);

  useEffect(() => {
    if (!deployed) return;
    if (location.hash.startsWith('#repair=')) {
      void openRequest(location.hash.slice('#repair='.length));
    } else if (params().get('passport')) {
      const card = params().get('card');
      void openPassport(params().get('passport')).then((found) => { if (found && card) setView('card'); });
    }
    // Initial route only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goHome = () => { setView('home'); setPassport(null); setRequest(null); setReview(null); setError(''); setDone(null); history.replaceState(null, '', location.pathname); };
  const ask = (details) => new Promise((resolve) => setConfirm({ ...details, resolve }));
  const answer = (value) => { confirm?.resolve(value); setConfirm(null); };

  const isOwner = passport && me.lockHash === passport.ownerLockHash;
  const isWorkshop = passport && me.lockHash === passport.workshopLockHash;
  const role = passport && me.lockHash ? (isOwner && isWorkshop ? 'shop' : isOwner ? 'owner' : isWorkshop ? 'workshop' : 'viewer') : null;
  const [createMode, setCreateMode] = useState('shop');

  return <div className="shell">
    <header className="topbar">
      <button type="button" className="brand" onClick={goHome}><Laptop size={22} weight="duotone" aria-hidden="true" /><span>Living Passport</span></button>
      <div className="topbar-right">
        <span className="net-chip">Testnet</span>
        {signer
          ? <WalletChip address={me.address} onDisconnect={disconnect} />
          : <button type="button" className="btn btn-primary wallet-btn" onClick={open}><Wallet size={16} aria-hidden="true" />Connect</button>}
      </div>
    </header>

    <main className="content">
      {!deployed && <Notice kind="error">The passport contract is not configured for this site yet.</Notice>}
      {busy && <Notice kind="busy">{busy}. Keep this page open.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {done && <Notice>{done.text} {done.tx && <TxLink hash={done.tx} />}</Notice>}

      {view === 'loading' && <Skeleton />}
      {view === 'home' && signer && me.lockHash && deployed && <>
        <ShopIdentity shop={myShop} busy={!!busy}
          onSave={async (details) => {
            const ok = await ask({ title: myShop ? 'Update your shop name?' : 'Publish your shop name?', confirm: 'Continue to wallet', rows: [['Shop name', details.name], ['Location', details.location.trim() || 'Not given']], warning: `${myShop ? '' : 'About 270 testnet CKB stays in your shop identity until you remove it. '}This is public, and earlier versions stay in past transactions.` });
            if (!ok) return false;
            const saved = await run('Saving your shop identity', async () => { const result = await saveShop(signer, details, myShop); await reloadMyShop(me.lockHash); return result; });
            if (saved) setDone({ text: `Shop identity saved: ${saved.did}`, tx: saved.txHash });
            return !!saved;
          }}
          onRemove={async () => {
            const ok = await ask({ title: 'Remove your shop name?', confirm: 'Remove', danger: true, rows: [['Shop name', myShop.name]], warning: 'Your passports go back to showing a wallet code, and the CKB in this identity returns to your wallet. Earlier versions stay in past transactions.' });
            if (!ok) return;
            const removed = await run('Removing your shop identity', async () => { const result = await removeShop(signer, myShop); await reloadMyShop(me.lockHash); return result; });
            if (removed) setDone({ text: 'Shop identity removed.', tx: removed.txHash });
          }} />
        <MyDevices client={client} lockHash={me.lockHash} onOpen={openPassport} onReview={openRequest} />
      </>}
      {view === 'home' && <Home onOpen={openPassport} onCreate={(mode) => { setError(''); setCreateMode(mode); setView('create'); }} disabled={!deployed || !!busy} />}

      {view === 'create' && <CreateView mode={createMode} onMode={setCreateMode} signer={signer} me={me} disabled={!deployed || !!busy} onBack={goHome}
        onSubmit={async (form) => {
          const shop = createMode === 'shop';
          const rows = shop
            ? [['Device', form.model], ['Customer', form.owner], ['Condition on arrival', form.condition.trim() || 'Not recorded']]
            : [['Device', form.model], ['Owner label', form.owner], ['Workshop wallet', <code key="w">{short(form.workshop, 12, 8)}</code>]];
          const ok = await ask({ title: shop ? 'Register this device?' : 'Create this passport?', confirm: 'Continue to wallet', rows, warning: shop ? 'Your shop holds the passport and 600 testnet CKB until you hand it to the customer or close it. Everything you type is public and permanent.' : '600 testnet CKB stays inside the passport until its owner closes it. Everything you type is public and permanent.' });
          if (!ok) return;
          const result = await run(shop ? 'Registering the device' : 'Creating the passport', async () => {
            const created = await createPassport(signer, deployment, { model: form.model, owner: form.owner, workshopAddress: form.workshop, shop });
            if (shop && form.condition.trim()) {
              const fresh = await loadPassport(client, deployment, created.args);
              created.txHash = await shopRepair(signer, deployment, fresh, `Received: ${form.condition.trim()}`);
            }
            return created;
          });
          if (result) { await openPassport(result.args, { quiet: true }); setDone({ text: shop ? 'Device registered. Print its QR card for the customer.' : 'Passport created.', tx: result.txHash }); }
        }} />}

      {view === 'card' && passport && <CardView passport={passport} shops={shops} onBack={() => setView('passport')} />}

      {view === 'passport' && passport && <PassportView passport={passport} shops={shops} role={role} me={me} signer={signer} busy={!!busy} onBack={goHome} onReview={openRequest} onCard={() => setView('card')} onConnect={open}
        onShopRepair={async (note) => {
          const tx = await run('Recording the repair', () => shopRepair(signer, deployment, passport, note));
          if (tx) { await openPassport(passport.id, { quiet: true }); setDone({ text: note === COLLECTED ? 'Marked as collected.' : 'Repair recorded.', tx }); }
          return !!tx;
        }}
        onClaim={async () => {
          const ok = await run('Sending your request to the shop', () => postClaim(passport.id, me.address).then(() => true));
          if (ok) setDone({ text: 'Request sent. The shop will hand the passport to this wallet when you are with them.' });
        }}
        onApproveClaim={async (claim) => {
          const ok = await ask({ title: 'Hand this passport to the customer?', confirm: 'Continue to wallet', rows: [['Customer wallet', <code key="c">{short(claim.address, 12, 8)}</code>]], warning: 'Only do this with the customer in front of you, after checking the address on their phone matches. After this, every repair needs their approval too.' });
          if (!ok) return;
          const tx = await run('Handing over the passport', () => transferPassport(signer, deployment, passport, { recipientAddress: claim.address, note: 'Claimed by the owner at the shop' }));
          if (tx) { await openPassport(passport.id, { quiet: true }); setDone({ text: 'Passport handed to the customer.', tx }); }
        }}
        onRepair={async (note) => {
          const draft = await run('Preparing the repair record', async () => {
            const encoded = await encodeRequest(await draftRepair(signer, deployment, passport, note));
            let sent = false;
            if (inboxEnabled) { try { await postDraft(encoded); sent = true; } catch { /* the link still works */ } }
            return { link: `${location.origin}${location.pathname}#repair=${encoded}`, sent };
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

      {view === 'approve' && <ApproveView review={review} passport={passport} shops={shops} me={me} signer={signer} busy={!!busy} onConnect={open}
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

function MyDevices({ client, lockHash, onOpen, onReview }) {
  const [list, setList] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [claims, setClaims] = useState({});
  const [filter, setFilter] = useState('in-shop');
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState('');
  useEffect(() => {
    let active = true;
    setList(null); setFailed(''); setDrafts({}); setClaims({});
    listPassports(client, deployment, lockHash).then(async (found) => {
      if (!active) return;
      setList(found);
      const [pending, requests] = await Promise.all([
        fetchDrafts(found.filter((p) => p.role === 'owner').map((p) => p.id)).catch(() => ({})),
        fetchClaims(found.filter((p) => p.role === 'shop').map((p) => p.id)).catch(() => ({})),
      ]);
      if (active) { setDrafts(pending); setClaims(requests); }
    }).catch((cause) => active && setFailed(cause?.message ?? String(cause)));
    return () => { active = false; };
  }, [client, lockHash]);
  const waiting = Object.values(drafts).flat();
  const requests = Object.values(claims).flat();
  const ledger = (list ?? []).filter((p) => p.role === 'shop' || p.role === 'workshop');
  const counts = { 'in-shop': 0, collected: 0, claimed: 0 };
  for (const p of ledger) counts[shopStatus(p)] += 1;
  const needle = query.trim().toLowerCase();
  const shown = ledger.filter((p) => shopStatus(p) === filter && (!needle || p.events.some((e) => e.detail.toLowerCase().includes(needle))));
  const groups = [['owner', 'Devices you own']];
  return <section className="my-devices">
    {failed && <Notice kind="error">Could not load your devices: {failed}</Notice>}
    {!list && !failed && <div className="card skeleton device-skeleton"><span /><span /></div>}
    {waiting.map((d) => <button key={d.txHash} type="button" className="inbox-item" onClick={() => void onReview(d.request)}>
      <Tray size={20} aria-hidden="true" />
      <div><strong>Repair waiting for your approval</strong><span>{list?.find((p) => p.id === d.passport)?.events[0].detail.split(' / ')[0]}: “{d.note}”</span></div>
    </button>)}
    {requests.map((c) => <button key={`${c.passport}${c.lockHash}`} type="button" className="inbox-item" onClick={() => void onOpen(c.passport)}>
      <UserCirclePlus size={20} aria-hidden="true" />
      <div><strong>A customer wants to take ownership</strong><span>{list?.find((p) => p.id === c.passport)?.events[0].detail.split(' / ')[0]} · from <code>{short(c.address, 7, 4)}</code></span></div>
    </button>)}
    {ledger.length > 0 && <div className="device-group">
      <h2><Storefront size={18} aria-hidden="true" />Shop ledger <span className="count">{ledger.length}</span></h2>
      <div className="ledger-tools">
        <div className="chips" role="tablist">
          {[['in-shop', 'In the shop'], ['collected', 'Collected'], ['claimed', 'With owner']].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={`chip${filter === key ? ' chip-on' : ''}`} onClick={() => setFilter(key)}>{label} <span>{counts[key]}</span></button>)}
        </div>
        <input className="ledger-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search model, customer or repair" aria-label="Search the ledger" />
      </div>
      {!shown.length && <p className="muted">Nothing here.</p>}
      <ul className="device-list">{shown.map((p) => <DeviceCard key={p.id} passport={p} onOpen={onOpen} badge={claims[p.id] && 'Ownership request'} />)}</ul>
    </div>}
    {list && !list.length && <p className="muted">No passports for this wallet yet. Create one, or ask the owner to name this wallet as the workshop.</p>}
    {list && groups.map(([role, title]) => {
      const items = list.filter((p) => p.role === role);
      if (!items.length) return null;
      return <div key={role} className="device-group">
        <h2>{title} <span className="count">{items.length}</span></h2>
        <ul className="device-list">{items.map((p) => <DeviceCard key={p.id} passport={p} onOpen={onOpen} badge={drafts[p.id] && 'Repair waiting for approval'} />)}</ul>
      </div>;
    })}
  </section>;
}

function DeviceCard({ passport: p, onOpen, badge }) {
  const latest = p.events.at(-1);
  const Icon = ACTIONS[latest.action]?.icon ?? Laptop;
  return <li><button type="button" className="device" onClick={() => void onOpen(p.id)}>
    <Laptop size={22} weight="duotone" aria-hidden="true" />
    <div><strong>{p.events[0].detail}</strong><span><Icon size={14} aria-hidden="true" />{latest.action === 1 ? latest.detail : ACTIONS[latest.action]?.label} · {p.events.length} {p.events.length === 1 ? 'event' : 'events'}</span>{badge && <span className="pending">{badge}</span>}</div>
  </button></li>;
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
      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={() => onCreate('shop')} disabled={disabled}><Storefront size={16} aria-hidden="true" />Register a device (shop)</button>
        <button type="button" className="btn btn-quiet" onClick={() => onCreate('owner')} disabled={disabled}><Plus size={16} aria-hidden="true" />Create my own passport</button>
      </div>
    </div>
    <ol className="how">
      <li><Storefront size={20} aria-hidden="true" /><div><strong>The shop registers the device</strong><span>at intake. The customer needs no wallet.</span></div></li>
      <li><Wrench size={20} aria-hidden="true" /><div><strong>Repairs go on its record</strong><span>and the customer gets a QR card to check them.</span></div></li>
      <li><SealCheck size={20} aria-hidden="true" /><div><strong>The owner can claim it later</strong><span>after which every repair needs their approval too.</span></div></li>
      <li><ArrowsLeftRight size={20} aria-hidden="true" /><div><strong>A buyer scans the card</strong><span>and sees every signed event before paying.</span></div></li>
    </ol>
  </section>;
}

function CreateView({ mode, onMode, signer, disabled, onSubmit, onBack }) {
  const [form, setForm] = useState({ model: '', owner: '', workshop: '', condition: '' });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const shop = mode === 'shop';
  const ready = form.model.trim() && form.owner.trim() && (shop || form.workshop.trim());
  return <section className="panel narrow">
    <button type="button" className="back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back</button>
    <div className="chips" role="tablist">
      <button type="button" role="tab" aria-selected={shop} className={`chip${shop ? ' chip-on' : ''}`} onClick={() => onMode('shop')}>I’m the shop</button>
      <button type="button" role="tab" aria-selected={!shop} className={`chip${!shop ? ' chip-on' : ''}`} onClick={() => onMode('owner')}>I’m the owner</button>
    </div>
    <h1>{shop ? 'Register a device' : 'Create a passport'}</h1>
    <p className="lede">{shop ? 'Your shop wallet holds the passport, so the customer needs no wallet or smartphone. You can hand it to them later.' : 'Your connected wallet becomes the owner. The workshop you name drafts repairs, and you approve each one.'}</p>
    <form className="stack" onSubmit={(event) => { event.preventDefault(); if (ready) void onSubmit(form); }}>
      <Field label="Device model" hint="Avoid serial numbers and IMEIs. This text is public."><input value={form.model} onChange={set('model')} maxLength={80} placeholder={shop ? 'Samsung Galaxy A54' : 'ThinkPad T480'} /></Field>
      <Field label={shop ? 'Customer label' : 'Owner label'} hint="A first name or ticket number, not a phone number."><input value={form.owner} onChange={set('owner')} maxLength={60} placeholder={shop ? 'Ticket 0412' : 'Wanjiru'} /></Field>
      {shop
        ? <Field label="Condition on arrival (optional)" hint="Recorded as the first event, e.g. what the customer reported."><input value={form.condition} onChange={set('condition')} maxLength={140} placeholder="Cracked screen, not charging" /></Field>
        : <Field label="Workshop testnet address" hint="Only this wallet can draft repairs for this passport."><input value={form.workshop} onChange={set('workshop')} placeholder="ckt1…" spellCheck="false" autoComplete="off" /></Field>}
      {!signer && <p className="field-hint">Connect a testnet wallet holding at least 601 CKB to continue.</p>}
      <button className="btn btn-primary" disabled={disabled || !signer || !ready}>{shop ? 'Review device' : 'Review passport'}</button>
    </form>
  </section>;
}

function ShopIdentity({ shop, busy, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });
  if (shop === undefined) return null;
  const edit = () => { setForm({ name: shop?.name ?? '', location: shop?.location ?? '' }); setEditing(true); };
  if (editing) return <form className="card shop-identity stack" onSubmit={async (event) => { event.preventDefault(); if (await onSave(form)) setEditing(false); }}>
    <h2><Storefront size={18} aria-hidden="true" />{shop ? 'Your shop identity' : 'Add your shop name'}</h2>
    <Field label="Shop name" hint="Shown on every passport your shop works on."><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={60} placeholder="Dflex Technologies" /></Field>
    <Field label="Location (optional)" hint="A town or street. This is public."><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} maxLength={60} placeholder="Nairobi CBD" /></Field>
    <div className="button-row">
      <button className="btn btn-primary" disabled={busy || !form.name.trim()}>Review</button>
      <button type="button" className="btn btn-quiet" onClick={() => setEditing(false)}>Cancel</button>
      {shop && <button type="button" className="btn btn-danger-quiet" disabled={busy} onClick={async () => { await onRemove(); setEditing(false); }}><Trash size={16} aria-hidden="true" />Remove</button>}
    </div>
  </form>;
  if (!shop) return <div className="card shop-identity shop-identity-row">
    <div><strong>Is this a shop wallet?</strong><span className="muted">Add your shop’s name so customers see it instead of a wallet code.</span></div>
    <button type="button" className="btn btn-quiet" disabled={busy} onClick={edit}><Storefront size={16} aria-hidden="true" />Add shop name</button>
  </div>;
  return <div className="card shop-identity shop-identity-row">
    <div><strong>{shop.name}</strong><span className="muted">{shop.location ? `${shop.location} · ` : ''}Your shop identity</span><code className="did">{shop.did}</code></div>
    <div className="button-row"><Copy value={shop.did} label="Copy DID" /><button type="button" className="btn btn-quiet" disabled={busy} onClick={edit}>Edit</button></div>
  </div>;
}

function PassportView({ passport, shops, role, me, signer, busy, onBack, onReview, onRepair, onTransfer, onClose, onCard, onConnect, onShopRepair, onClaim, onApproveClaim }) {
  const [model, ownerLabel] = passport.events[0].detail.split(' / ');
  const [pending, setPending] = useState([]);
  const [claims, setClaims] = useState([]);
  const shopHeld = passport.ownerLockHash === passport.workshopLockHash;
  useEffect(() => {
    let active = true;
    setPending([]); setClaims([]);
    if (role === 'owner') fetchDrafts([passport.id]).then((found) => active && setPending(found[passport.id] ?? [])).catch(() => {});
    if (role === 'shop') fetchClaims([passport.id]).then((found) => active && setClaims(found[passport.id] ?? [])).catch(() => {});
    return () => { active = false; };
  }, [passport.id, passport.sequence, role]);
  const STATUS = { 'in-shop': 'In the shop', collected: 'Collected', claimed: 'With its owner' };
  return <section className="passport">
    <button type="button" className="back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />All passports</button>
    <div className="passport-grid">
      <article className="card summary">
        <Laptop size={36} weight="duotone" className="summary-icon" aria-hidden="true" />
        <h1>{model}</h1>
        <p className="muted">First registered to {ownerLabel ?? 'its owner'}</p>
        {shopHeld && <span className="status-chip"><Package size={14} aria-hidden="true" />{STATUS[shopStatus(passport)]} · held by the shop</span>}
        <dl className="facts">
          <div><dt>Current owner</dt><dd>{shopHeld ? shops.get(passport.ownerLockHash)?.name ?? 'The shop' : <Party hash={passport.ownerLockHash} shops={shops} />}{(role === 'owner' || role === 'shop') && <span className="you">you</span>}</dd></div>
          <div><dt>Workshop</dt><dd><Party hash={passport.workshopLockHash} shops={shops} />{(role === 'workshop' || role === 'shop') && <span className="you">you</span>}</dd></div>
          <div><dt>Events</dt><dd>{passport.events.length}</dd></div>
          <div><dt>Held in cell</dt><dd>{ckb(passport.capacity)}</dd></div>
        </dl>
        {shops.size > 0 && <p className="field-hint">Shop names are set by the shop’s own wallet. Nobody has checked them.</p>}
        <div className="share-row"><Copy value={passportLink(passport.id)} label="Copy passport link" /><button type="button" className="btn btn-quiet" onClick={onCard}><QrCode size={16} aria-hidden="true" />QR card</button></div>
      </article>

      <article className="card timeline-card">
        <h2>History</h2>
        <ol className="timeline">
          {[...passport.events].reverse().map((event) => {
            const { icon: Icon } = ACTIONS[event.action];
            const label = event.action === 1 && event.detail.startsWith('Received:') ? 'Checked in' : event.action === 1 && event.detail === COLLECTED ? 'Collected' : ACTIONS[event.action].label;
            return <li key={event.txHash} className={`event event-${event.action}`}>
              <span className="event-icon"><Icon size={16} aria-hidden="true" /></span>
              <div className="event-body">
                <strong>{label}</strong>
                <p>{event.action === 0 ? event.detail.replace(' / ', ', registered to ') : event.detail}</p>
                {event.action === 1 && shops.get(passport.workshopLockHash) && <span className="event-by">By {shops.get(passport.workshopLockHash).name}</span>}
                <TxLink hash={event.txHash} />
              </div>
            </li>;
          })}
        </ol>
      </article>

      <article className="card actions-card">
        <h2>{role === 'shop' ? 'Shop actions' : role === 'workshop' ? 'Record a repair' : role === 'owner' ? 'Owner actions' : shopHeld ? 'Is this your device?' : 'Make a change'}</h2>
        {!signer && !shopHeld && <p className="muted">Connect the owner’s or the workshop’s wallet to change this passport.</p>}
        {!signer && shopHeld && <div className="stack"><p className="muted">The shop is holding this passport for its owner. If this is your device, connect a wallet to ask the shop to hand it to you.</p><button type="button" className="btn btn-quiet" onClick={onConnect}><Wallet size={16} aria-hidden="true" />Connect wallet</button></div>}
        {signer && role === 'viewer' && !shopHeld && <p className="muted">The connected wallet <code>{short(me.address, 7, 4)}</code> is neither the owner nor the workshop for this passport.</p>}
        {signer && role === 'viewer' && shopHeld && <div className="stack">
          <p className="muted">The shop is holding this passport. Ask them to hand it to your wallet <code>{short(me.address, 7, 4)}</code>. They approve it with you in the shop.</p>
          <button type="button" className="btn btn-primary" disabled={busy || !inboxEnabled} onClick={onClaim}><UserCirclePlus size={16} aria-hidden="true" />Request ownership</button>
        </div>}
        {role === 'shop' && <ShopActions busy={busy} claims={claims} onShopRepair={onShopRepair} onApproveClaim={onApproveClaim} onTransfer={onTransfer} onClose={onClose} />}
        {role === 'workshop' && <RepairForm busy={busy} onRepair={onRepair} />}
        {role === 'owner' && pending.map((d) => <button key={d.txHash} type="button" className="inbox-item" disabled={busy} onClick={() => void onReview(d.request)}>
          <Tray size={20} aria-hidden="true" />
          <div><strong>Repair waiting for your approval</strong><span>“{d.note}”</span></div>
        </button>)}
        {role === 'owner' && <OwnerActions busy={busy} onTransfer={onTransfer} onClose={onClose} />}
      </article>
    </div>
  </section>;
}

function ShopActions({ busy, claims, onShopRepair, onApproveClaim, onTransfer, onClose }) {
  const [note, setNote] = useState('');
  const bytes = new TextEncoder().encode(note.trim()).length;
  return <div className="stack">
    {claims.map((c) => <div key={c.lockHash} className="inbox-item">
      <UserCirclePlus size={20} aria-hidden="true" />
      <div><strong>Ownership request</strong><span>From <code>{short(c.address, 10, 6)}</code>. Approve only with the customer in front of you.</span>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onApproveClaim(c)}>Hand over to this customer</button></div>
    </div>)}
    <form className="stack" onSubmit={async (event) => { event.preventDefault(); if (await onShopRepair(note.trim())) setNote(''); }}>
      <Field label="What was done" hint={`${bytes}/160 bytes. Public and permanent. Your shop signs this alone while it holds the passport.`}>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Replaced screen with OEM panel, tested touch" />
      </Field>
      <button className="btn btn-primary" disabled={busy || !bytes || bytes > 160}><Wrench size={16} aria-hidden="true" />Record repair</button>
    </form>
    <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => onShopRepair(COLLECTED)}><Package size={16} aria-hidden="true" />Mark collected by customer</button>
    <details className="more">
      <summary>Hand over or close</summary>
      <OwnerActions busy={busy} onTransfer={onTransfer} onClose={onClose} />
    </details>
  </div>;
}

function CardView({ passport, shops, onBack }) {
  const [svg, setSvg] = useState('');
  const [model, label] = passport.events[0].detail.split(' / ');
  const link = passportLink(passport.id);
  useEffect(() => { QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg).catch(() => setSvg('')); }, [link]);
  return <section className="panel narrow card-view">
    <button type="button" className="back no-print" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Back to passport</button>
    <div className="qr-card">
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="qr-text">
        <p className="kicker">Living Passport</p>
        <strong>{model}</strong>
        <span>{label}</span>
        {shops.get(passport.workshopLockHash) && <span>Serviced by {shops.get(passport.workshopLockHash).name}</span>}
        <span className="muted">Scan to see this device’s repair history.</span>
        <code>{short(passport.id, 10, 6)}</code>
      </div>
    </div>
    <div className="button-row no-print">
      <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print card</button>
      <Copy value={link} label="Copy link" />
    </div>
    <p className="field-hint no-print">Give the card to the customer or stick it on the device. Anyone can scan it, no wallet needed.</p>
  </section>;
}

function RepairForm({ busy, onRepair }) {
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [sent, setSent] = useState(false);
  const bytes = new TextEncoder().encode(note.trim()).length;
  if (link) {
    return <div className="stack">
      <Notice>{sent ? 'Draft signed and sent. The owner will see it when they open their devices.' : 'Draft signed by the workshop. Nothing changes until the owner approves it.'}</Notice>
      <p className="muted">{sent ? 'You can also send this link if the owner wants it now.' : 'Send this link to the owner. It opens a review page where they co-sign with their wallet.'}</p>
      <input className="link-field" value={link} readOnly aria-label="Repair approval link" onFocus={(event) => event.target.select()} />
      <div className="button-row">
        <Copy value={link} label="Copy link" />
        {navigator.share && <button type="button" className="btn btn-primary" onClick={() => navigator.share({ title: 'Approve laptop repair', text: 'Please review and approve this repair on the laptop passport.', url: link }).catch(() => {})}><ShareNetwork size={16} aria-hidden="true" />Share</button>}
      </div>
      <button type="button" className="btn btn-quiet" onClick={() => { setLink(''); setSent(false); setNote(''); }}>Draft a different repair</button>
    </div>;
  }
  return <form className="stack" onSubmit={async (event) => { event.preventDefault(); const result = await onRepair(note); if (result) { setLink(result.link); setSent(result.sent); } }}>
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

function ApproveView({ review, passport, shops, me, signer, busy, onConnect, onApprove }) {
  if (!review || !passport) return <section className="panel narrow"><h1>Repair approval</h1><p className="muted">Loading the request from testnet…</p></section>;
  const isOwner = me.lockHash === review.ownerLockHash;
  const [model] = passport.events[0].detail.split(' / ');
  const shop = shops.get(passport.workshopLockHash);
  return <section className="panel narrow">
    <p className="kicker">Repair approval</p>
    <h1>{model}</h1>
    <blockquote className="repair-note">{review.note}</blockquote>
    <ul className="checks">
      <li><ShieldCheck size={18} aria-hidden="true" />Drafted by {shop ? `${shop.name}, ` : ''}the workshop named on this passport</li>
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

function WalletChip({ address, onDisconnect }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try { await navigator.clipboard.writeText(address); setCopied(true); timer.current = setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  }
  return <div className="wallet-chip">
    <button type="button" className="btn btn-quiet wallet-btn" onClick={copy} title="Copy wallet address">
      <code>{copied ? 'Copied' : short(address, 7, 4)}</code>{copied ? <Check size={16} aria-hidden="true" /> : <CopySimple size={16} aria-hidden="true" />}
    </button>
    <button type="button" className="btn btn-quiet wallet-btn icon-btn" onClick={onDisconnect} title="Disconnect wallet" aria-label="Disconnect wallet"><SignOut size={16} aria-hidden="true" /></button>
  </div>;
}
