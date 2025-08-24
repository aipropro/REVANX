/* REVANX — minimal signup handler (non-visual) */
(function () {
console.log('rev-signup:init');

const q = (s) => document.querySelector(s);
const form = q('[data-test="signup-form"]');
const emailInput = q('[data-test="email-input"]');
const nameInput = q('[data-test="name-input"]');
const consentInput = q('[data-test="consent"]');
const statusEl = q('[data-test="status"]');

if (!form) {
  console.warn('Signup form not found - selector [data-test="signup-form"] missing');
  return;
}
if (!emailInput) {
  console.warn('Email input not found - selector [data-test="email-input"] missing');
  return;
}

const submitBtn = form.querySelector('[data-test="submit"]') || form.querySelector('button[type="submit"]');
const N8N_WEBHOOK_URL = 'https://primary-production-04c0.up.railway.app/webhook/revanx-signup';

function validEmail(v) { return /^[^\s@]+@[^\s@]+.[^\s@]+$/.test(v); }
function setStatus(msg) {
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.removeAttribute('hidden');
    statusEl.style.display = '';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
  }
}

function lockForm() {
  if (!form) return;
  form.setAttribute('aria-disabled', 'true');
  form.setAttribute('data-state', 'submitted');
  const controls = form.querySelectorAll('input, button, select, textarea');
  controls.forEach(el => {
    el.disabled = true;
    el.setAttribute('aria-disabled', 'true');
  });
}

function unlockForm() {
  if (!form) return;
  form.removeAttribute('aria-disabled');
  form.removeAttribute('data-state');
  const controls = form.querySelectorAll('input, button, select, textarea');
  controls.forEach(el => {
    el.disabled = false;
    el.removeAttribute('aria-disabled');
  });
}

document.addEventListener('click', (e) => {
const a = e.target.closest('a[href]');
if (a) console.log('link_click', { href: a.getAttribute('href'), text: (a.textContent || '').trim() });
});

form.addEventListener('submit', async (e) => {
console.log('rev-signup:listener-attached');

e.preventDefault();
setStatus('Submitting…');
const email = (emailInput?.value || '').trim();
const name = (nameInput?.value || '').trim();
const consent = consentInput ? !!consentInput.checked : true;

console.log('signup_submitted', { emailPresent: !!email });

if (!email || !validEmail(email)) {
  setStatus('Please enter a valid email address.');
  emailInput?.focus();
  return;
}
if (!consent) {
  setStatus('Please agree to receive updates.');
  consentInput?.focus();
  return;
}

if (!N8N_WEBHOOK_URL) {
  setStatus('Almost ready! Please provide the n8n Webhook URL.');
  console.warn('N8N_WEBHOOK_URL is empty.');
  return;
}

const prevLabel = submitBtn?.textContent;
if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

try {
  const res = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      name,
      consent: true,
      utm: Object.fromEntries(new URLSearchParams(location.search)),
      ua: navigator.userAgent,
      page: location.pathname
    })
  });

  if (res.ok) {
    let data = {};
    try { data = await res.json(); } catch {}
    console.log('signup_success', { status: res.status, ok: res.ok });
    setStatus((data && data.message) ? data.message : '✅ Thanks! Check your email for a welcome message.');
    lockForm();
    console.log('rev-signup:success-ui-applied');
  } else {
    console.log('signup_error', { status: res.status, ok: res.ok });
    setStatus('Thanks! If the email does not arrive, please try again later.');
  }
} catch (err) {
  console.log('signup_error', { error: String(err) });
  setStatus('Thanks! If the email does not arrive, please try again later.');
} finally {
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = prevLabel || 'Sign Up'; }
}
});
})();
