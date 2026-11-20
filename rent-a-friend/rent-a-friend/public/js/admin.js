/* Admin review: approve or reject companion applications, handle reports, read messages. Server enforces the admin role. */
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('admin-root'); if (!root) return;
  await RAF.ready; const E = RAF.esc;
  if (!RAF.user) { location.replace('login.html?next=admin.html'); return; }
  if (RAF.user.role !== 'admin') { root.innerHTML = '<div class="empty"><h2>Admins only</h2><a class="btn btn-primary" href="dashboard.html">Back to dashboard</a></div>'; return; }
  const draw = async () => {
    const o = await RAF.api('/admin/overview');
    root.innerHTML = `<section class="block"><h2>Companion applications (${o.applications.length})</h2><p class="hint">Check identity and safety before approving. Approving lists the profile publicly.</p>${o.applications.map((a) => `<div class="list-row"><div style="display:flex;gap:1rem;flex-wrap:wrap">${a.photo ? `<img class="app-photo" src="${E(a.photo)}" alt="">` : ''}<div><strong>${E(a.name)}, ${a.age}</strong> · ${E(a.city)} · ${RAF.money(a.rate)}/hr<br><span class="muted">${E(a.email)} · ${E(a.phone)}</span><br><span class="hint">${a.interests.map(E).join(', ')} · ${a.languages.map(E).join(', ')}</span><p style="max-width:60ch;margin:.4rem 0 0">${E(a.bio)}</p></div></div><div class="chips"><button class="btn btn-primary btn-sm" data-app="${E(a.id)}" data-d="approve" type="button">Approve</button><button class="btn btn-ghost btn-sm" data-app="${E(a.id)}" data-d="reject" type="button">Reject</button></div></div>`).join('') || '<p class="muted">No pending applications.</p>'}</section>
    <section class="block"><h2>Open reports (${o.reports.length})</h2>${o.reports.map((r) => `<div class="list-row"><div><strong>${E(r.pname || r.profile_id)}</strong> · ${E(r.reason)}<br><span class="muted">Reported by ${E(r.uname || 'unknown')} on ${E(r.created_at)}</span>${r.details ? `<p style="margin:.3rem 0 0">${E(r.details)}</p>` : ''}</div><div class="chips"><button class="btn btn-dark btn-sm" data-rep="${r.id}" data-a="suspend" type="button">Suspend profile</button><button class="btn btn-ghost btn-sm" data-rep="${r.id}" data-a="dismiss" type="button">Dismiss</button></div></div>`).join('') || '<p class="muted">No open reports.</p>'}</section>
    <section class="block"><h2>Contact messages</h2>${o.messages.map((m) => `<div class="list-row" style="display:block"><strong>${E(m.name)}</strong> · <a href="mailto:${E(m.email)}">${E(m.email)}</a> <span class="hint">${E(m.created_at)}</span><p style="margin:.3rem 0 0">${E(m.message)}</p></div>`).join('') || '<p class="muted">No messages.</p>'}</section>`;
  };
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.app) { await RAF.api('/admin/applications/' + encodeURIComponent(b.dataset.app), { method: 'POST', body: { decision: b.dataset.d } }); RAF.toast(b.dataset.d === 'approve' ? 'Approved and listed' : 'Rejected'); await draw(); }
      if (b.dataset.rep) { await RAF.api('/admin/reports/' + b.dataset.rep, { method: 'POST', body: { action: b.dataset.a } }); RAF.toast('Report closed'); await draw(); }
    } catch (er) { RAF.toast(er.message, 'err'); }
  });
  draw().catch((e) => { root.innerHTML = `<div class="empty"><p>${E(e.message)}</p></div>`; });
});
