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
