/* Dashboard: all data comes from the server API. */
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('dash-root'); if (!root) return;
  await RAF.ready;
  if (!RAF.user) { location.replace('login.html?next=dashboard.html'); return; }
  const E = RAF.esc, fmt = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'pm' : 'am'}`;
  let user = RAF.user, tab = 'overview', S = { mine: [], incoming: [], notes: [], profiles: [], profile: null, blocked: [], earn: null };
  const label = { requested: 'Waiting for reply', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', declined: 'Declined' };
  const load = async () => {
    const [b, n, p, me, bl] = await Promise.all([RAF.api('/bookings'), RAF.api('/notifications'), RAF.api('/profiles'), RAF.api('/my/profile'), RAF.api('/blocks')]);
    S = { ...S, mine: b.mine, incoming: b.incoming, notes: n.items, profiles: p.profiles, profile: me.profile, blocked: bl.blocked };
    if (S.profile && S.profile.status === 'approved') S.earn = await RAF.api('/earnings');
  };
  const isComp = () => S.profile && S.profile.status === 'approved';
  const tabs = () => [['overview', 'Overview'], ['upcoming', 'Upcoming bookings'], ['history', 'Booking history'], ['favs', 'Favourites'], ['notifications', `Notifications${S.notes.some((n) => !n.read) ? ' •' : ''}`], ['settings', 'Account settings']]
    .concat(isComp() ? [['requests', 'Booking requests'], ['earnings', 'Earnings'], ['availability', 'Availability']] : []);
  const row = (b, mode) => `<div class="list-row"><div><strong>${E(mode === 'in' ? b.customer : b.friend)}</strong><br><span class="muted">${b.date} · ${fmt(b.hour)} · ${b.hours}h · ${RAF.money(mode === 'in' ? b.payout : b.total)} · ${label[b.status]}</span>${b.notes ? `<br><span class="hint">“${E(b.notes)}”</span>` : ''}</div><div class="chips">
    ${mode === 'out' && ['requested', 'confirmed'].includes(b.status) ? `<button class="btn btn-ghost btn-sm" data-act="cancel" data-id="${b.id}" type="button">Cancel</button>` : ''}
    ${mode === 'out' && b.status === 'completed' && !b.reviewed ? `<button class="btn btn-primary btn-sm" data-review="${b.id}" type="button">Leave review</button>` : ''}
    ${mode === 'in' && b.status === 'requested' ? `<button class="btn btn-primary btn-sm" data-act="accept" data-id="${b.id}" type="button">Accept</button><button class="btn btn-ghost btn-sm" data-act="decline" data-id="${b.id}" type="button">Decline</button>` : ''}</div></div>`;
  const empty = (t, link) => `<div class="empty"><p>${t}</p>${link || ''}</div>`;
  const V = {
    overview: () => `<h2>Hello, ${E(user.name)}</h2><p class="muted">${E(user.email)} · ${user.role === 'admin' ? 'Admin' : isComp() ? 'Companion' : 'Customer'}</p>
      <div class="grid g3"><div class="stat"><strong>${S.mine.filter((b) => ['requested', 'confirmed'].includes(b.status)).length}</strong><span>Upcoming bookings</span></div><div class="stat"><strong>${RAF._favs.size}</strong><span>Favourites</span></div><div class="stat"><strong>${S.notes.filter((n) => !n.read).length}</strong><span>Unread notices</span></div></div>
      ${user.role === 'admin' ? '<p style="margin-top:1.5rem"><a class="btn btn-dark" href="admin.html">Open admin review</a></p>' : ''}
      ${!S.profile ? '<div class="alert-box" style="margin-top:1.5rem"><strong>Want to earn as a friend?</strong><br>Apply with your details. Profiles are listed after review. <a class="btn btn-primary btn-sm" style="margin-top:.5rem" href="become-friend.html">Apply now</a></div>' : S.profile.status === 'pending' ? '<p class="alert-box" style="margin-top:1.5rem">Your companion application is under review.</p>' : S.profile.status === 'rejected' ? '<p class="alert-box" style="margin-top:1.5rem">Your last application was not approved. <a href="become-friend.html">Update and apply again</a>.</p>' : S.profile.status === 'suspended' ? '<p class="alert-box" style="margin-top:1.5rem">Your profile is suspended after a report. Contact support.</p>' : ''}`,
    upcoming: () => `<h2>Upcoming bookings</h2>${S.mine.filter((b) => ['requested', 'confirmed'].includes(b.status)).map((b) => row(b, 'out')).join('') || empty('No upcoming bookings.', '<a class="btn btn-primary" href="find-friend.html">Find a friend</a>')}`,
    history: () => `<h2>Booking history</h2>${S.mine.filter((b) => !['requested', 'confirmed'].includes(b.status)).map((b) => row(b, 'out')).join('') || empty('Completed and cancelled bookings will appear here.')}`,
    favs: () => { const l = S.profiles.filter((p) => RAF._favs.has(p.id)); return `<h2>Favourite companions</h2>${l.length ? `<div class="grid g2">${l.map(RAF.card).join('')}</div>` : empty('Nothing saved yet.', '<a class="btn btn-primary" href="find-friend.html">Browse friends</a>')}`; },
    notifications: () => `<h2>Notifications</h2>${S.notes.some((n) => !n.read) ? '<button class="btn btn-ghost btn-sm" data-readall type="button">Mark all read</button>' : ''}${S.notes.map((n) => `<div class="list-row ${n.read ? '' : 'unread'}"><span>${E(n.text)}</span><span class="hint">${E(n.created_at.slice(0, 10))}</span></div>`).join('') || empty('No notifications yet.')}`,
    settings: () => `<h2>Account settings</h2><form id="set-form" novalidate style="max-width:420px"><div class="field"><label for="sn">Display name</label><input id="sn" name="name" required minlength="2" value="${E(user.name)}"></div><div class="field"><label for="se">Email</label><input id="se" name="email" type="email" required value="${E(user.email)}"></div><button class="btn btn-primary" type="submit">Save changes</button></form>
      <h3 style="margin-top:2rem">Change password</h3><form id="pw-form" novalidate style="max-width:420px"><div class="field"><label for="pc">Current password</label><input id="pc" name="current" type="password" required autocomplete="current-password"></div><div class="field"><label for="pn">New password</label><input id="pn" name="next" type="password" required minlength="8" autocomplete="new-password"></div><button class="btn btn-ghost" type="submit">Update password</button></form>
      <h3 style="margin-top:2rem">Blocked profiles</h3>${S.blocked.map((b) => `<div class="list-row"><span>${E(b.name)}</span><button class="btn btn-ghost btn-sm" data-unblock="${E(b.id)}" type="button">Unblock</button></div>`).join('') || '<p class="muted">No blocked profiles.</p>'}
      <h3 style="margin-top:2rem">Session and data</h3><div class="cta-row"><button class="btn btn-ghost" id="logout" type="button">Log out</button><button class="btn btn-dark" id="delete" type="button">Delete my account</button></div>`,
    requests: () => `<h2>Booking requests</h2>${S.incoming.filter((b) => ['requested', 'confirmed'].includes(b.status)).map((b) => row(b, 'in')).join('') || empty('No requests right now.')}`,
    earnings: () => `<h2>Earnings overview</h2><p class="demo-note">${E(S.earn.note)}</p><div class="grid g3"><div class="stat"><strong>${RAF.money(S.earn.completed)}</strong><span>Completed (${S.earn.count} bookings)</span></div><div class="stat"><strong>${RAF.money(S.earn.upcoming)}</strong><span>Confirmed, upcoming</span></div><div class="stat"><strong>${RAF.money(S.earn.pending)}</strong><span>Awaiting your reply</span></div></div>`,
    availability: () => `<h2>Availability and rate</h2><form id="av-form" novalidate style="max-width:420px"><div class="field"><span class="label">Days you take bookings</span><div class="checks">${['Weekdays', 'Weekends'].map((d) => `<label><input type="checkbox" name="days" value="${d}" ${S.profile.days.includes(d) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div><div class="field"><label for="ar">Hourly rate (₹)</label><input id="ar" name="rate" type="number" min="200" max="5000" required value="${S.profile.rate}"></div><button class="btn btn-primary" type="submit">Save</button></form>`
  };
  const draw = () => { root.innerHTML = `<div class="dash"><nav class="dash-nav" aria-label="Dashboard">${tabs().map(([k, l]) => `<button type="button" data-tab="${k}" ${k === tab ? 'aria-current="true"' : ''}>${l}</button>`).join('')}</nav><section class="card pad" aria-live="polite">${V[tab]()}</section></div>`; RAF.reveal(); };
  const refresh = async () => { await load(); draw(); };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const run = async (fn, ok) => { try { await fn(); if (ok) RAF.toast(ok); await refresh(); } catch (er) { RAF.toast(er.message, 'err'); } };
    if (t.dataset.tab) { tab = t.dataset.tab; draw(); }
    if (t.dataset.act === 'cancel') RAF.modal('Cancel this booking?', '<p>Policy: free cancellation more than 24 hours before the start time. Closer than that, the friend may be owed part of the fee. Final terms are subject to legal review.</p>', [{ label: 'Keep booking' }, { label: 'Cancel booking', cls: 'btn-dark', onClick: () => run(() => RAF.api('/bookings/' + t.dataset.id, { method: 'PATCH', body: { action: 'cancel' } }), 'Booking cancelled') }]);
    else if (t.dataset.act) run(() => RAF.api('/bookings/' + t.dataset.id, { method: 'PATCH', body: { action: t.dataset.act } }), t.dataset.act === 'accept' ? 'Booking confirmed' : 'Request declined');
    if (t.dataset.readall !== undefined) run(() => RAF.api('/notifications/read', { method: 'POST', body: {} }));
    if (t.dataset.unblock) run(() => RAF.api('/blocks/' + encodeURIComponent(t.dataset.unblock), { method: 'DELETE' }), 'Unblocked');
    if (t.dataset.review) { let stars = 0; const d = RAF.modal('Leave a review', '<div class="star-pick" role="group" aria-label="Rating">' + [1, 2, 3, 4, 5].map((n) => `<button type="button" data-s="${n}" aria-label="${n} stars">★</button>`).join('') + '</div><div class="field"><label for="rt">Comment (optional)</label><textarea id="rt" maxlength="400"></textarea></div>', [{ label: 'Cancel' }, { label: 'Submit review', cls: 'btn-primary', onClick: async (dd) => { if (!stars) { RAF.toast('Choose a star rating.', 'err'); return false; } await RAF.api(`/bookings/${t.dataset.review}/review`, { method: 'POST', body: { stars, text: dd.querySelector('#rt').value } }); RAF.toast('Thanks for your review'); await refresh(); } }]); d.addEventListener('click', (ev) => { const s = ev.target.closest('[data-s]'); if (s) { stars = +s.dataset.s; d.querySelectorAll('[data-s]').forEach((b) => b.classList.toggle('on', +b.dataset.s <= stars)); } }); }
    if (t.id === 'logout') run(async () => { await RAF.api('/auth/logout', { method: 'POST', body: {} }); location.href = 'index.html'; });
    if (t.id === 'delete') RAF.modal('Delete your account?', '<p>This permanently deletes your account, bookings, favourites and any companion profile. This cannot be undone.</p><div class="field"><label for="dp">Confirm with your password</label><input id="dp" type="password" autocomplete="current-password"></div>', [{ label: 'Cancel' }, { label: 'Delete account', cls: 'btn-dark', onClick: async (d) => { await RAF.api('/auth/me', { method: 'DELETE', body: { password: d.querySelector('#dp').value } }); location.href = 'index.html'; return false; } }]);
  });
  root.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; if (!RAF.validate(f)) return;
    try {
      if (f.id === 'set-form') { const r = await RAF.api('/auth/me', { method: 'PATCH', body: { name: f.name.value, email: f.email.value } }); user = RAF.user = r.user; RAF.toast('Changes saved'); }
      if (f.id === 'pw-form') { await RAF.api('/auth/password', { method: 'POST', body: { current: f.current.value, next: f.next.value } }); f.reset(); RAF.toast('Password updated'); }
      if (f.id === 'av-form') { await RAF.api('/my/profile', { method: 'PATCH', body: { days: [...f.querySelectorAll('[name=days]:checked')].map((c) => c.value), rate: +f.rate.value } }); RAF.toast('Availability saved'); await refresh(); }
    } catch (er) { RAF.toast(er.message, 'err'); }
  });
  try { await load(); draw(); } catch (e) { root.innerHTML = `<div class="empty"><p>${E(e.message)}</p></div>`; }
});
