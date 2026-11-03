// Optional repair inbox (inbox/server.mjs). Without it, repairs travel by link only.
import published from '../deployment.testnet.json';

const base = (import.meta.env.VITE_INBOX_URL || published.inboxUrl || '').replace(/\/$/, '');
export const inboxEnabled = !!base;

export async function postDraft(request) {
  const res = await fetch(`${base}/drafts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Inbox error ${res.status}`);
}

// Pending drafts keyed by passport ID.
export async function fetchDrafts(ids) {
  if (!base || !ids.length) return {};
  const res = await fetch(`${base}/drafts?passports=${ids.join(',')}`);
  if (!res.ok) return {};
  const byPassport = {};
  for (const draft of (await res.json()).drafts ?? []) (byPassport[draft.passport] ??= []).push(draft);
  return byPassport;
}

// A customer asks the shop holding their device's passport to hand it over.
export async function postClaim(passport, address) {
  const res = await fetch(`${base}/claims`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passport, address }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Inbox error ${res.status}`);
}

// Open ownership claims keyed by passport ID.
export async function fetchClaims(ids) {
  if (!base || !ids.length) return {};
  const res = await fetch(`${base}/claims?passports=${ids.join(',')}`);
  if (!res.ok) return {};
  const byPassport = {};
  for (const claim of (await res.json()).claims ?? []) (byPassport[claim.passport] ??= []).push(claim);
  return byPassport;
}
