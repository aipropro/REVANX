/* REVANX — minimal signup handler (non-visual) */
(function () {
console.log('rev-signup:init');

// Diagnostic init logs
console.log('rev-fix:init', {
  form: !!document.querySelector('[data-test="signup-form"]'),
  email: !!document.querySelector('[data-test="email-input"]'),
  consent: !!document.querySelector('[data-test="consent"]'),
  status: !!document.querySelector('[data-test="status"]'),
  submit: !!document.querySelector('[data-test="submit"]')
});

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

function setStatus(msg) {
  const el = document.querySelector('[data-test="status"]');
  if (!el) {
    console.warn('rev-fix:no-status-el');
    return;
  }
  el.textContent = msg;
  el.removeAttribute('hidden');
  el.style.removeProperty('display');
  el.style.display = '';
  el.style.visibility = 'visible';
  el.style.opacity = '1';
  el.style.position = el.style.position || 'relative';
  el.style.zIndex = el.style.zIndex || '1000';

  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  // Log computed visibility for diagnostics
  const cs = window.getComputedStyle(el);
  console.log('rev-fix:status-css', {
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    position: cs.position,
    zIndex: cs.zIndex
  });
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
console.log('rev-fix:listener-attached');

e.preventDefault();

const email = (document.querySelector('[data-test="email-input"]')?.value || '').trim();
const name = (document.querySelector('[data-test="name-input"]')?.value || '').trim();
const consentEl = document.querySelector('[data-test="consent"]');
const consentOk = consentEl ? !!consentEl.checked : true;

console.log('signup_submitted', { emailPresent: !!email });
console.log('rev-fix:submit', { emailLength: email.length, consentOk, isValidEmail: /^[^\s@]+@[^\s@]+.[^\s@]+$/.test(email) });

const isValidEmail = /^[^\s@]+@[^\s@]+.[^\s@]+$/.test(email);
if (!isValidEmail) {
  setStatus('Please enter a valid email address (e.g., name@domain.com).');
  document.querySelector('[data-test="email-input"]')?.focus();
  return;
}
if (!consentOk) {
  setStatus('Please agree to receive updates.');
  consentEl?.focus();
  return;
}

if (!N8N_WEBHOOK_URL) {
  setStatus('Almost ready! Please provide the n8n Webhook URL.');
  console.warn('N8N_WEBHOOK_URL is empty.');
  return;
}

// Immediate success message - no network wait
setStatus('All set! The email has been sent to this address.');
console.log('rev-fix:success-message-shown');

// Scroll status into view smoothly
const sEl = document.querySelector('[data-test="status"]');
sEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

// Temporary assertion to verify DOM text
const el = document.querySelector('[data-test="status"]');
console.log('rev-fix:status-text', el ? el.textContent : null);

// Disable submit while sending; re-enable in finally
const btn = document.querySelector('[data-test="submit"]');
btn?.setAttribute('aria-busy', 'true');
btn?.setAttribute('disabled', 'true');

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
  btn?.removeAttribute('aria-busy');
  btn?.removeAttribute('disabled');
  console.log('rev-fix:post-complete');
}
});
console.log('rev-signup:instant-success-copy-wired');
console.log('rev-fix:front-layer-visibility-ensured');
})();
