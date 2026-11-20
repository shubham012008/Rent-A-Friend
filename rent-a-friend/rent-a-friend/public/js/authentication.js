/* Login and signup against the server. Passwords are hashed server-side (bcrypt) and never stored in the browser. */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.pw-toggle').forEach((b) => b.addEventListener('click', () => { const i = document.getElementById(b.dataset.for); const s = i.type === 'password'; i.type = s ? 'text' : 'password'; b.textContent = s ? 'Hide' : 'Show'; b.setAttribute('aria-pressed', s); }));
  const meter = document.getElementById('meter'), pw = document.getElementById('password');
  const score = (v) => [v.length >= 8, /[A-Z]/.test(v), /[a-z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
  if (meter && pw) pw.addEventListener('input', () => { const s = score(pw.value); meter.firstElementChild.style.width = s * 20 + '%'; meter.firstElementChild.style.background = s < 3 ? 'var(--err)' : s < 5 ? 'var(--amber)' : 'var(--ok)'; document.getElementById('meter-label').textContent = pw.value ? ['', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong'][s] : ''; });
  const fp = document.getElementById('forgot');
  if (fp) fp.addEventListener('click', (e) => { e.preventDefault(); RAF.modal('Forgot your password?', '<p>Email-based reset is not set up yet because it needs an email service. Contact support via the <a href="contact.html">contact page</a> and an admin can help. If you are logged in on another device, you can change your password under Dashboard, Account settings.</p>'); });
  const next = RAF.safeNext(new URLSearchParams(location.search).get('next'));
  RAF.ready.then(() => { if (RAF.user && document.querySelector('#login-form,#signup-form')) location.replace(next); });
  ['login-form', 'signup-form'].forEach((id) => {
    const f = document.getElementById(id); if (!f) return;
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ok = RAF.validate(f, (el) => (el.id === 'password' && id === 'signup-form' && !(el.value.length >= 8 && /[a-z]/.test(el.value) && /[A-Z]/.test(el.value) && /\d/.test(el.value)) ? 'Use 8+ characters with upper case, lower case and a number.' : el.id === 'confirm' && el.value !== f.elements.password.value ? 'Passwords do not match.' : ''));
      if (!ok) return; const btn = f.querySelector('[type=submit]'), label = btn.textContent; btn.disabled = true; btn.textContent = 'Please wait…';
      try {
        const body = id === 'login-form' ? { email: f.elements.email.value, password: f.elements.password.value, remember: f.elements.remember.checked } : { name: f.elements.name.value, email: f.elements.email.value, password: f.elements.password.value, adult: f.elements.terms.checked };
        await RAF.api(id === 'login-form' ? '/auth/login' : '/auth/signup', { method: 'POST', body });
        RAF.toast(id === 'login-form' ? 'Welcome back' : 'Account created'); setTimeout(() => { location.href = next; }, 500);
      } catch (er) { RAF.toast(er.message, 'err'); btn.disabled = false; btn.textContent = label; }
    });
  });
});
