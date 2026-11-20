document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.nav-toggle'), menu = document.getElementById('nav-menu'), head = document.querySelector('.site-header');
  const set = (open) => { menu.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); document.body.style.overflow = open ? 'hidden' : ''; };
  btn.addEventListener('click', () => set(!menu.classList.contains('open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  matchMedia('(min-width:821px)').addEventListener('change', () => set(false));
  const sc = () => head.classList.toggle('scrolled', scrollY > 8); sc(); addEventListener('scroll', sc, { passive: true });
  RAF.ready.then(() => { const li = document.querySelector('[data-auth-link]'); if (RAF.user && li) { li.textContent = 'Dashboard'; li.href = 'dashboard.html'; } });
  document.getElementById('appearance').addEventListener('click', () => {
    set(false); const cur = RAF.appearance.resolve();
    const themes = RAF.THEMES.map(([k, l, c]) => `<label class="opt"><input type="radio" name="theme" value="${k}" ${k === cur.theme ? 'checked' : ''}><span class="sw" style="background:${c}"></span>${l}</label>`).join('');
    const fonts = RAF.FONTS.map(([k, l]) => `<label class="opt"><input type="radio" name="font" value="${k}" ${k === cur.font ? 'checked' : ''}>${l}</label>`).join('');
    const d = RAF.modal('Appearance', `<p class="label">Theme</p><div class="opt-grid">${themes}</div><p class="label">Font</p><div class="opt-grid">${fonts}</div><p class="hint">Saved on this device only.</p>`, [{ label: 'Reset', onClick: () => { RAF.appearance.set({ theme: null, font: null }); } }, { label: 'Done', cls: 'btn-primary' }]);
    d.addEventListener('change', (e) => {
      if (e.target.name === 'theme') { RAF.appearance.set({ theme: e.target.value }); const r = RAF.appearance.resolve(); if (!r.fontChosen) d.querySelector(`[name=font][value=${r.font}]`).checked = true; }
      if (e.target.name === 'font') RAF.appearance.set({ font: e.target.value });
    });
  });
});
