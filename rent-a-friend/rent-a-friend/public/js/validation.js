/* Form validation helpers (client-side convenience; the server validates everything again). */
(function () {
  const RAF = (window.RAF = window.RAF || {});
  const msgs = { valueMissing: 'This field is required.', typeMismatch: 'Enter a valid value.', tooShort: 'This is too short.', rangeUnderflow: 'This value is too low.', rangeOverflow: 'This value is too high.', patternMismatch: 'Check the format.' };
  RAF.setError = (el, msg) => {
    const f = el.closest('.field') || el.parentElement; let e = f.querySelector('.field-error');
    if (!e) { e = document.createElement('p'); e.className = 'field-error'; e.id = (el.id || el.name || 'f') + '-err'; f.appendChild(e); }
    e.textContent = msg || ''; f.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', !!msg);
    if (msg) el.setAttribute('aria-describedby', e.id);
  };
  RAF.validate = (form, extra) => {
    let first = null;
    form.querySelectorAll('input,select,textarea').forEach((el) => {
      if (el.type === 'file' || (el.type === 'checkbox' && !el.required)) return;
      let m = '';
      if (!el.checkValidity()) { const v = el.validity; m = el.dataset.msg || Object.keys(msgs).map((k) => v[k] && msgs[k]).find(Boolean) || el.validationMessage; }
      if (!m && extra) m = extra(el) || '';
      RAF.setError(el, m); if (m && !first) first = el;
    });
    if (first) first.focus(); return !first;
  };
  document.addEventListener('input', (e) => { if (e.target.closest('.field.invalid') && e.target.checkValidity()) RAF.setError(e.target, ''); });
})();
document.addEventListener('DOMContentLoaded', () => {
  const ph = document.getElementById('photo');
  if (ph) ph.addEventListener('change', () => {
    const file = ph.files[0], pv = document.getElementById('photo-preview'); pv.innerHTML = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 3e6) { RAF.setError(ph, 'Use a JPG, PNG or WebP under 3 MB.'); ph.value = ''; return; }
    RAF.setError(ph, ''); const img = document.createElement('img'); img.alt = 'Selected photo preview'; img.className = 'app-photo'; img.src = URL.createObjectURL(file); pv.appendChild(img);
  });
  const contact = document.querySelector('form[data-form=contact]');
  if (contact) contact.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!RAF.validate(contact)) return;
    const b = contact.querySelector('[type=submit]'); b.disabled = true;
    try { await RAF.api('/contact', { method: 'POST', body: { name: contact.name.value, email: contact.email.value, message: contact.message.value } }); RAF.modal('Message sent', '<p>Thanks. We read every message.</p>'); contact.reset(); }
    catch (er) { RAF.toast(er.message, 'err'); } b.disabled = false;
  });
  const apply = document.querySelector('form[data-form=apply]');
  if (apply) {
    RAF.ready.then(() => {
      const box = document.getElementById('apply-status');
      if (!RAF.user) { box.innerHTML = '<p class="alert-box">You need an account to apply. <a href="signup.html">Sign up</a> or <a href="login.html?next=become-friend.html">log in</a>, then come back here.</p>'; return; }
      apply.name.value = RAF.user.name; apply.email.value = RAF.user.email;
      RAF.api('/my/profile').then((r) => { if (r.profile && r.profile.status !== 'rejected') { box.innerHTML = `<p class="alert-box">${r.profile.status === 'pending' ? 'Your application is under review. We will notify you in your dashboard.' : 'Your profile is live.'} <a href="dashboard.html">Go to dashboard</a></p>`; apply.hidden = true; } });
    });
    apply.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!RAF.user) { RAF.toast('Please log in first.', 'err'); return; }
      let gOk = true; ['days', 'slots'].forEach((g) => { const cs = apply.querySelectorAll(`[data-group="${g}"]`); const has = [...cs].some((c) => c.checked); RAF.setError(cs[0], has ? '' : 'Choose at least one.'); if (!has) gOk = false; });
      const ok = RAF.validate(apply, (el) => (el.name === 'age' && +el.value < 18 ? 'You must be 18 or older.' : el.type === 'tel' && !/^[+\d][\d\s-]{8,14}$/.test(el.value) ? 'Enter a valid phone number.' : ''));
      if (!ok || !gOk) return;
      const b = apply.querySelector('[type=submit]'); b.disabled = true;
      try { await RAF.api('/apply', { method: 'POST', body: new FormData(apply) }); RAF.modal('Application received', '<p>Your application is now waiting for review. Your profile is listed only after our team approves it. You will see the result in your dashboard notifications.</p>', [{ label: 'Go to dashboard', cls: 'btn-primary', onClick: () => { location.href = 'dashboard.html'; return false; } }]); apply.hidden = true; }
      catch (er) { RAF.toast(er.message, 'err'); } b.disabled = false;
    });
  }
});
