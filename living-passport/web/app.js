const $ = (selector) => document.querySelector(selector);
let passport = null;
let selected = 0;

function short(hex) { return hex ? `${hex.slice(0, 12)}…${hex.slice(-8)}` : '—'; }
function title(event) {
  if (event.action === 'mint') return 'Passport started';
  if (event.action === 'repair') return 'Repair note added';
  return 'Ownership changed';
}
function description(event) {
  if (event.action === 'mint') return `${event.owner} started a local record for this laptop.`;
  if (event.action === 'repair') return `${event.workshop}: ${event.detail}`;
  return `Local record moved from ${event.from} to ${event.to}.`;
}
function animateDevice() {
  const art = $('.device-art');
  art.classList.remove('changed');
  void art.offsetWidth;
  art.classList.add('changed');
}
function showForm(kind) {
  $('#repair-form').hidden = kind !== 'repair';
  $('#transfer-form').hidden = kind !== 'transfer';
  document.querySelectorAll('[data-form]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.form === kind)));
}
function render() {
  const hasRecord = Boolean(passport);
  $('#create-form').hidden = hasRecord;
  $('#action-tabs').hidden = !hasRecord;
  if (!hasRecord) { $('#repair-form').hidden = true; $('#transfer-form').hidden = true; return; }
  if ($('#repair-form').hidden && $('#transfer-form').hidden) showForm('repair');
  $('#sequence-badge').textContent = `VERSION ${passport.sequence}`;
  $('#event-count').textContent = `${passport.events.length} EVENTS`;
  $('#device-heading').textContent = passport.model;
  $('#device-subtitle').textContent = 'Local lifecycle record';
  $('#owner-value').textContent = passport.owner;
  $('#repairer-value').textContent = passport.repairer;
  $('#item-id').textContent = short(passport.itemId);
  $('#item-id').title = passport.itemId;
  $('#repair-form [name="workshop"]').value = passport.repairer;

  const timeline = $('#timeline');
  timeline.replaceChildren();
  passport.events.forEach((event, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `timeline-item${index === selected ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(index === selected));
    const meta = document.createElement('span'); meta.className = 'timeline-meta'; meta.textContent = `STEP ${String(index + 1).padStart(2, '0')} / ${event.action.toUpperCase()}`;
    const name = document.createElement('span'); name.className = 'timeline-title'; name.textContent = title(event);
    button.append(meta, name);
    button.addEventListener('click', () => { selected = index; render(); animateDevice(); });
    timeline.append(button);
  });
  const event = passport.events[selected] || passport.events.at(-1);
  $('#event-detail').hidden = false;
  $('#detail-kind').textContent = event.action.toUpperCase();
  $('#detail-sequence').textContent = `#${event.sequence}`;
  $('#detail-title').textContent = title(event);
  $('#detail-description').textContent = description(event);
  $('#detail-hash').textContent = event.eventHash;
  $('#detail-root').textContent = event.historyRoot;
}

async function submit(form, path) {
  const error = form.querySelector('.form-error');
  error.hidden = true;
  form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid'));
  const button = form.querySelector('[type="submit"]');
  const input = Object.fromEntries(new FormData(form));
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(`/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The local draft could not be updated.');
    passport = data.passport;
    selected = passport.events.length - 1;
    if (path !== 'create') form.reset();
    render(); animateDevice();
  } catch (cause) {
    error.textContent = cause.message;
    error.hidden = false;
    const empty = [...form.querySelectorAll('[required]')].find((field) => !field.value.trim());
    const field = empty || (cause.message.includes('workshop') ? form.querySelector('[name="workshop"]') : form.querySelector('[required]'));
    field?.setAttribute('aria-invalid', 'true');
    field?.focus();
  } finally { button.disabled = false; form.removeAttribute('aria-busy'); }
}

for (const [selector, action] of [['#create-form', 'create'], ['#repair-form', 'repair'], ['#transfer-form', 'transfer']]) {
  $(selector).addEventListener('submit', (event) => { event.preventDefault(); submit(event.currentTarget, action); });
}
document.querySelectorAll('[data-form]').forEach((button) => button.addEventListener('click', () => showForm(button.dataset.form)));
$('#export-button').addEventListener('click', () => {
  if (!passport) return;
  const blob = new Blob([JSON.stringify({ boundary: 'LOCAL DRAFT — NOT ON-CHAIN', passport }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `laptop-passport-${passport.itemId.slice(2, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
fetch('/api/passport').then((response) => response.json()).then((data) => { passport = data.passport; if (passport) selected = passport.events.length - 1; render(); }).catch(() => {
  const error = $('#create-form .form-error'); error.textContent = 'The local server is unavailable. Restart it and reload this page.'; error.hidden = false;
});
