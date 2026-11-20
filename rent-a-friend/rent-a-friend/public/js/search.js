/* Home (featured, hero, live stats) + Find a Friend discovery. */
document.addEventListener('DOMContentLoaded', async () => {
  const feat = document.getElementById('featured-grid'), grid = document.getElementById('results'), hs = document.getElementById('hero-stack');
  await RAF.ready;
  let d; try { d = await RAF.api('/profiles'); } catch (e) { (feat || grid) && ((feat || grid).innerHTML = '<div class="empty" style="grid-column:1/-1"><h3>Could not load profiles</h3><p class="muted">Start the server with <code>npm start</code>.</p></div>'); return; }
  const profiles = d.profiles;
  if (hs && profiles.length) hs.innerHTML = [profiles[0], profiles[Math.min(6, profiles.length - 1)]].map((p) => `<div class="ph"><img src="${RAF.avatar(p)}" alt="" width="400" height="440"></div>`).join('') + '<p class="hero-tag">Illustrated sample profiles. Real companions appear after review.</p>';
  if (feat) {
    feat.innerHTML = [...profiles].sort((a, b) => b.popularity - a.popularity).slice(0, 4).map(RAF.card).join('');
    RAF.api('/stats').then((s) => { [['c-companions', s.companions], ['c-cities', s.cities], ['c-bookings', s.bookings]].forEach(([id, n]) => { const el = document.getElementById(id); if (el) { el.dataset.count = n; } }); RAF.counters(); }).catch(() => {});
  }
  if (!grid) return;
  const f = document.getElementById('filter-form'), $ = (n) => f.elements[n];
  const uniq = (k) => [...new Set(profiles.flatMap((p) => [].concat(p[k])))].sort();
  const fill = (n, arr, all) => { $(n).innerHTML = `<option value="">${all}</option>` + arr.map((x) => `<option>${RAF.esc(x)}</option>`).join(''); };
  fill('city', uniq('city'), 'All cities'); fill('interest', uniq('interests'), 'All interests'); fill('language', uniq('languages'), 'Any language');
  const max = Math.max(...profiles.map((p) => p.rate), 500); $('budget').max = max; $('budget').value = max;
  const q = new URLSearchParams(location.search); if (q.get('q')) $('q').value = q.get('q');
  const render = () => {
    const t = $('q').value.trim().toLowerCase(), b = +$('budget').value; document.getElementById('budget-out').textContent = RAF.money(b);
    const r = profiles.filter((p) => (!t || (p.name + ' ' + p.city + ' ' + p.bio + ' ' + p.interests.join(' ')).toLowerCase().includes(t))
      && (!$('city').value || p.city === $('city').value) && (!$('interest').value || p.interests.includes($('interest').value))
      && p.rate <= b && (!$('avail').value || p.availability.includes($('avail').value)) && (!$('language').value || p.languages.includes($('language').value)));
    const s = $('sort').value;
    r.sort(s === 'price-asc' ? (a, c) => a.rate - c.rate : s === 'price-desc' ? (a, c) => c.rate - a.rate : s === 'newest' ? (a, c) => c.joined - a.joined : (a, c) => c.popularity - a.popularity || (c.rating || 0) - (a.rating || 0));
    document.getElementById('count').textContent = `${r.length} ${r.length === 1 ? 'friend' : 'friends'} found`;
    grid.innerHTML = r.length ? r.map(RAF.card).join('') : `<div class="empty" style="grid-column:1/-1"><h3>No friends match those filters</h3><p class="muted">Try a wider budget, another city, or clear your filters.</p><button class="btn btn-primary" type="button" id="clear">Clear filters</button></div>`;
  };
  f.addEventListener('input', render); $('sort').addEventListener('change', render); f.addEventListener('submit', (e) => e.preventDefault());
  grid.addEventListener('click', (e) => { if (e.target.id === 'clear') { f.reset(); $('budget').value = max; render(); } });
  f.addEventListener('reset', () => setTimeout(() => { $('budget').value = max; render(); }));
  render();
});
