/* Profile page + booking flow. The server decides availability and price. */
document.addEventListener('DOMContentLoaded', async () => {
  const pr = document.getElementById('profile-root'), bk = document.getElementById('booking-root');
  if (!pr && !bk) return;
  await RAF.ready;
  const id = new URLSearchParams(location.search).get('id');
  let data; try { data = await RAF.api('/profiles/' + encodeURIComponent(id || '')); } catch (e) { (pr || bk).innerHTML = `<div class="empty"><h3>${RAF.esc(e.status === 404 ? 'Profile not found' : e.message)}</h3><a class="btn btn-primary" href="find-friend.html">Browse friends</a></div>`; return; }
  const p = data.profile, loginUrl = (n) => `login.html?next=${encodeURIComponent(n)}`;
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  if (pr) {
    document.title = `${p.name} · Rent A Friend`;
    const days = [...Array(14)].map((_, i) => { const dt = new Date(); dt.setDate(dt.getDate() + i + 1); return dt; });
    const open = (dt) => p.days.includes([0, 6].includes(dt.getDay()) ? 'Weekends' : 'Weekdays');
    pr.innerHTML = `<div class="profile-grid"><div class="profile-side"><div class="profile-photo"><img src="${RAF.avatar(p)}" alt="Portrait of ${RAF.esc(p.name)}" width="400" height="440"></div>
<div class="card pad" style="margin-top:1rem"><p class="price" style="font-size:1.6rem">${RAF.money(p.rate)}<small> per hour</small></p><a class="btn btn-primary" style="width:100%" href="booking.html?id=${encodeURIComponent(p.id)}">Book this friend</a>
<div class="cta-row" style="margin-top:.75rem"><button class="btn btn-ghost btn-sm" data-fav="${RAF.esc(p.id)}" aria-pressed="${RAF._favs.has(p.id)}" type="button">Save</button><button class="btn btn-ghost btn-sm" id="report" type="button">Report</button><button class="btn btn-ghost btn-sm" id="block" type="button">Block</button></div></div></div>
<div><h1 style="font-size:clamp(2rem,4vw,2.8rem)">${RAF.esc(p.name)}, ${p.age}</h1><p class="muted">${RAF.esc(p.city)} · ${p.reviewCount ? `<span class="stars">★</span> ${p.rating} (${p.reviewCount} reviews)` : 'No reviews yet'} · ${p.sample ? '<span class="badge warn">Sample profile</span>' : '<span class="badge">Reviewed by team</span>'}</p>
${p.sample ? '<p class="demo-note">This is a sample profile for demonstration. Booking it will not reach a real person.</p>' : ''}
<section class="block"><h2>About</h2><p>${RAF.esc(p.bio)}</p>${p.personality ? `<p><strong>Personality:</strong> ${RAF.esc(p.personality)}</p>` : ''}</section>
<section class="block"><h2>Interests and languages</h2><ul class="tags">${p.interests.concat(p.languages).map((i) => `<li class="tag">${RAF.esc(i)}</li>`).join('')}</ul></section>
<section class="block"><h2>Activities offered</h2><ul>${p.activities.map((a) => `<li>${RAF.esc(a)}</li>`).join('')}</ul></section>
<section class="block"><h2>Availability</h2><p class="muted">Next 14 days. Days outside ${RAF.esc(p.name.split(' ')[0])}'s schedule are struck through. Pick a day to see free times.</p><div class="chips">${days.map((dt) => `<a class="chip" ${open(dt) ? `href="booking.html?id=${encodeURIComponent(p.id)}&date=${iso(dt)}"` : 'aria-disabled="true" style="text-decoration:line-through;background:var(--stone);color:var(--muted);pointer-events:none"'}>${dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</a>`).join('')}</div></section>
<section class="block"><h2>Reviews</h2>${data.reviews.length ? data.reviews.map((r) => `<div class="list-row" style="display:block"><strong>${RAF.esc(r.by)}</strong> <span class="stars" aria-label="${r.stars} stars">${stars(r.stars)}</span><p class="muted" style="margin:.25rem 0 0">${RAF.esc(r.text || '')}</p></div>`).join('') : '<p class="muted">No reviews yet. Reviews open after a completed booking.</p>'}</section>
<section class="block alert-box"><h2 style="font-size:1.2rem">Safety first</h2><ul><li>Meet in public places and tell someone you trust your plans.</li><li>Keep chat and payments on the platform.</li><li>No sexual services. Report anything that crosses a boundary.</li><li>In an emergency, contact local emergency services first (India: 112).</li></ul><a href="safety.html">Read safety guidelines</a></section></div></div>`;
    RAF.reveal();
    const need = () => { if (RAF.user) return true; RAF.modal('Log in first', '<p>You need an account to do this.</p>', [{ label: 'Cancel' }, { label: 'Log in', cls: 'btn-primary', onClick: () => { location.href = loginUrl('profile.html?id=' + p.id); return false; } }]); return false; };
    document.getElementById('report').onclick = () => need() && RAF.modal(`Report ${RAF.esc(p.name)}`, '<div class="field"><label for="rr">Reason</label><select id="rr"><option>Inappropriate behaviour</option><option>Fake profile</option><option>Asked for sexual services</option><option>Harassment</option><option>Other</option></select></div><div class="field"><label for="rd">Details (optional)</label><textarea id="rd" maxlength="500"></textarea></div>', [{ label: 'Cancel' }, { label: 'Submit report', cls: 'btn-primary', onClick: async (d) => { await RAF.api('/reports', { method: 'POST', body: { profileId: p.id, reason: d.querySelector('#rr').value, details: d.querySelector('#rd').value } }); RAF.toast('Report sent to our team'); } }]);
    document.getElementById('block').onclick = () => need() && RAF.modal(`Block ${RAF.esc(p.name)}?`, '<p>This profile will disappear from your results and you will not be able to book it. You can unblock in your dashboard settings.</p>', [{ label: 'Cancel' }, { label: 'Block', cls: 'btn-dark', onClick: async () => { await RAF.api('/blocks/' + encodeURIComponent(p.id), { method: 'PUT' }); RAF.toast(`${p.name} blocked`); setTimeout(() => { location.href = 'find-friend.html'; }, 700); } }]);
  }
  if (bk) {
    const f = document.getElementById('booking-form'), $ = (n) => f.elements[n], times = document.getElementById('times'), win = data.window;
    document.getElementById('who').innerHTML = `<img src="${RAF.avatar(p)}" alt="" width="64" height="70" style="width:64px;height:70px;object-fit:cover;border-radius:var(--r)"><div><strong>${RAF.esc(p.name)}</strong><br><span class="muted">${RAF.esc(p.city)} · ${RAF.money(p.rate)}/hr</span></div>`;
    if (p.sample) document.getElementById('sample-note').hidden = false;
    $('date').min = win.min; $('date').max = win.max;
    const qd = new URLSearchParams(location.search).get('date'); if (qd && qd >= win.min && qd <= win.max) $('date').value = qd;
    let sel = null, day = null;
    const fmt = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'pm' : 'am'}`;
    const sum = () => {
      const hrs = +$('duration').value, base = p.rate * hrs, fee = Math.round(base * .1);
      document.getElementById('sum').innerHTML = `<div class="summary-line"><span>Date</span><span>${$('date').value || '—'}</span></div><div class="summary-line"><span>Time</span><span>${sel !== null ? fmt(sel) + ' to ' + fmt(sel + hrs) : '—'}</span></div><div class="summary-line"><span>${RAF.money(p.rate)} × ${hrs}h</span><span>${RAF.money(base)}</span></div><div class="summary-line"><span>Service fee (10%)</span><span>${RAF.money(fee)}</span></div><div class="summary-line total"><span>Total</span><span>${RAF.money(base + fee)}</span></div>`;
    };
    const draw = () => {
      times.innerHTML = ''; const hrs = +$('duration').value;
      if (!day) { times.innerHTML = '<p class="hint">Choose a date to see times.</p>'; return; }
      if (!day.open) { times.innerHTML = '<p class="field-error">Not available on this day. Pick another date.</p>'; return; }
      day.hours.forEach(({ h }) => {
        let ok = h + hrs <= 22; for (let k = h; k < h + hrs && ok; k++) { const s = day.hours.find((x) => x.h === k); if (!s || !s.ok) ok = false; }
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = fmt(h); b.dataset.h = h; b.disabled = !ok; b.setAttribute('aria-pressed', sel === h); if (!ok) b.title = 'Unavailable'; times.appendChild(b);
      });
    };
    const load = async () => {
      sel = null; day = null; const d = $('date').value; sum();
      if (!d) { draw(); return; }
      times.innerHTML = '<p class="hint">Checking availability…</p>';
      try { day = await RAF.api(`/profiles/${encodeURIComponent(p.id)}/availability?date=${d}`); } catch (e) { times.innerHTML = `<p class="field-error">${RAF.esc(e.message)}</p>`; return; }
      draw();
    };
    times.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b || b.disabled) return; sel = +b.dataset.h; times.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === b)); sum(); });
    $('date').addEventListener('change', load); $('duration').addEventListener('change', () => { if (sel !== null) { sel = null; } draw(); sum(); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!RAF.user) { RAF.modal('Log in to book', '<p>You need an account to send a booking request.</p>', [{ label: 'Cancel' }, { label: 'Log in', cls: 'btn-primary', onClick: () => { location.href = loginUrl(`booking.html?id=${p.id}&date=${$('date').value}`); return false; } }]); return; }
      if (!RAF.validate(f)) return; if (sel === null) { RAF.toast('Select an available time.', 'err'); return; }
      const b = f.querySelector('[type=submit]'); b.disabled = true;
      try {
        const r = await RAF.api('/bookings', { method: 'POST', body: { profileId: p.id, date: $('date').value, hour: sel, hours: +$('duration').value, notes: $('notes').value } });
        RAF.modal('Request sent', `<p>Your request to ${RAF.esc(p.name)} for ${r.booking.date} at ${fmt(r.booking.hour)} was recorded. ${r.sample ? 'This is a sample profile, so nobody will respond.' : 'They must accept it before it is confirmed. You will see updates in your dashboard.'}</p><p class="hint">No payment is collected yet.</p>`, [{ label: 'View bookings', cls: 'btn-primary', onClick: () => { location.href = 'dashboard.html'; return false; } }, { label: 'Close' }]);
        load();
      } catch (er) { RAF.toast(er.message, 'err'); if (er.status === 409) load(); } b.disabled = false;
    });
    load(); sum();
  }
});
