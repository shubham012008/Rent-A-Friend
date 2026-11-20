/* Shared interactions: toasts, modals, reveal, counters, favourites, page transitions. */
(function () {
  const RAF = (window.RAF = window.RAF || {});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  RAF.toast = (msg, type) => {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast' + (type === 'err' ? ' err' : ''); t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  };
  RAF.modal = (title, html, actions) => {
    const d = document.createElement('dialog'); d.setAttribute('aria-labelledby', 'dlg-t');
    d.innerHTML = `<div class="modal-in"><h2 id="dlg-t" style="font-size:1.5rem">${title}</h2><div class="modal-body">${html}</div><div class="modal-actions"></div></div>`;
    const bar = d.querySelector('.modal-actions');
    (actions || [{ label: 'Close' }]).forEach((a) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm ' + (a.cls || 'btn-ghost'); b.textContent = a.label;
      b.addEventListener('click', async () => { b.disabled = true; let keep = false; try { keep = a.onClick ? (await a.onClick(d)) === false : false; } catch (e) { RAF.toast(e.message, 'err'); keep = true; } b.disabled = false; if (!keep) d.close(); });
      bar.appendChild(b);
    });
    d.addEventListener('close', () => d.remove()); document.body.appendChild(d); d.showModal(); return d;
  };
  RAF.counters = () => {
    const co = new IntersectionObserver((es) => es.forEach((en) => {
      if (!en.isIntersecting) return; co.unobserve(en.target);
      const end = +en.target.dataset.count, t0 = performance.now(), dur = reduce ? 1 : 1400;
      const tick = (t) => { const p = Math.min((t - t0) / dur, 1); en.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IN') + (en.target.dataset.suffix || ''); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }), { threshold: .5 });
    document.querySelectorAll('[data-count]:not([data-seen])').forEach((el) => { el.dataset.seen = 1; co.observe(el); });
  };
  RAF.reveal = () => {
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 });
    document.querySelectorAll('.reveal:not(.in)').forEach((el) => (reduce ? el.classList.add('in') : io.observe(el)));
  };
  document.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-fav]');
    if (f) {
      if (!RAF.user) { RAF.toast('Log in to save favourites.', 'err'); return; }
      const id = f.dataset.fav, on = !RAF._favs.has(id);
      try { await RAF.api('/favourites/' + encodeURIComponent(id), { method: on ? 'PUT' : 'DELETE' }); } catch (er) { RAF.toast(er.message, 'err'); return; }
      on ? RAF._favs.add(id) : RAF._favs.delete(id);
      document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => { b.setAttribute('aria-pressed', on); if (b.classList.contains('fav')) b.textContent = on ? '♥' : '♡'; });
      RAF.toast(on ? 'Saved to favourites' : 'Removed from favourites');
    }
    const a = e.target.closest('a[href]');
    if (a && !reduce && a.origin === location.origin && !a.hash && !a.target && !e.metaKey && !e.ctrlKey && a.pathname !== location.pathname) {
      e.preventDefault(); document.body.classList.add('leaving'); setTimeout(() => { location.href = a.href; }, 180);
    }
  });
  addEventListener('pageshow', () => document.body.classList.remove('leaving'));
  document.addEventListener('DOMContentLoaded', () => { RAF.reveal(); RAF.counters(); });
})();
