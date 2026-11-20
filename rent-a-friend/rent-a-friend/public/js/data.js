/* Shared client layer: API wrapper, session, illustrated avatars, profile cards. */
(function () {
  const RAF = (window.RAF = window.RAF || {});
  RAF.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  RAF.money = (n) => '₹' + Number(n).toLocaleString('en-IN');
  RAF.offline = () => {
    if (document.querySelector('.offline')) return;
    const d = document.createElement('div'); d.className = 'offline'; d.setAttribute('role', 'alert');
    d.innerHTML = 'The server is not running. In the project folder run <code>npm start</code>, then open <code>http://localhost:3000</code>.';
    document.body.prepend(d);
  };
  RAF.api = async (path, opt = {}) => {
    const o = { method: opt.method || 'GET', headers: { 'X-RAF': '1' }, credentials: 'same-origin' };
    if (opt.body instanceof FormData) o.body = opt.body;
    else if (opt.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opt.body); }
    let res;
    try { if (location.protocol === 'file:') throw new Error('file'); res = await fetch('/api' + path, o); } catch (e) { RAF.offline(); throw new Error('The server is not running.'); }
    let data = {}; try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) { const err = new Error(data.error || 'Request failed'); err.status = res.status; throw err; }
    return data;
  };
  RAF._favs = new Set(); RAF.user = null;
  RAF.ready = (async () => {
    try { const m = await RAF.api('/auth/me'); RAF.user = m.user; if (m.user) RAF._favs = new Set((await RAF.api('/favourites')).ids); } catch (e) { /* guest or offline */ }
  })();
  RAF.avatar = (p) => {
    if (p.photo) return p.photo;
    const h = [...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), st = h % 4;
    const eye = ['#3b6ea5', '#4f8f5a', '#8a5a3b', '#7a4fa0', '#2f7f86'][h % 5], hair = p.hair || '#2b2230', skin = p.skin || '#f3cdb3', bg = p.tone || '#405B4B', ink = '#2b2230';
    const back = st === 1 ? `<path d="M96 190c-14 92 4 172 44 190h120c40-18 58-98 44-190z" fill="${hair}"/>` : st === 2 ? `<ellipse cx="86" cy="250" rx="32" ry="92" fill="${hair}"/><ellipse cx="314" cy="250" rx="32" ry="92" fill="${hair}"/>` : st === 3 ? `<circle cx="200" cy="64" r="38" fill="${hair}"/>` : '';
    const eyeAt = (x) => `<ellipse cx="${x}" cy="212" rx="19" ry="26" fill="#fff"/><ellipse cx="${x}" cy="215" rx="15" ry="22" fill="${eye}"/><ellipse cx="${x}" cy="217" rx="8" ry="13" fill="${ink}"/><circle cx="${x - 6}" cy="206" r="6" fill="#fff"/><circle cx="${x + 5}" cy="224" r="3" fill="#fff"/><path d="M${x - 21} 202q21-22 42 0" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440"><rect width="400" height="440" fill="${bg}"/><text x="338" y="64" font-size="34" fill="#fff" fill-opacity=".7">✦</text><text x="40" y="120" font-size="22" fill="#fff" fill-opacity=".5">✦</text><text x="352" y="170" font-size="16" fill="#fff" fill-opacity=".5">✦</text>${back}<path d="M60 440c4-70 56-110 140-110s136 40 140 110z" fill="#fff" fill-opacity=".9"/><path d="M168 336l32 40 32-40z" fill="${bg}"/><rect x="176" y="270" width="48" height="70" rx="20" fill="${skin}"/><ellipse cx="200" cy="205" rx="92" ry="102" fill="${skin}"/>${eyeAt(155)}${eyeAt(245)}<ellipse cx="122" cy="252" rx="17" ry="9" fill="#ff8fa3" fill-opacity=".5"/><ellipse cx="278" cy="252" rx="17" ry="9" fill="#ff8fa3" fill-opacity=".5"/><path d="M186 268q14 12 28 0" fill="none" stroke="#8a4a4a" stroke-width="4.5" stroke-linecap="round"/><path d="M104 190c2-84 54-112 96-112s94 28 96 112c-26-18-46-40-56-66-26 30-70 56-136 66z" fill="${hair}"/><path d="M130 160q40-8 70-52" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="6" stroke-linecap="round"/></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };
  RAF.card = (p) => {
    const fav = RAF._favs.has(p.id);
    const badge = p.sample ? '<span class="badge warn">Sample profile</span>' : '<span class="badge">Reviewed by team</span>';
    const rate = p.reviewCount ? `<span class="stars" aria-label="${p.rating} out of 5">★</span> ${p.rating} (${p.reviewCount})` : 'New';
    return `<article class="card friend-card"><div class="fc-img"><a href="profile.html?id=${encodeURIComponent(p.id)}" tabindex="-1" aria-hidden="true"><img src="${RAF.avatar(p)}" alt="" loading="lazy" width="400" height="440"></a>
<button class="fav" type="button" data-fav="${RAF.esc(p.id)}" aria-pressed="${fav}" aria-label="Save ${RAF.esc(p.name)} to favourites">${fav ? '♥' : '♡'}</button></div>
<div class="fc-body"><h3>${RAF.esc(p.name)}, ${p.age}</h3><p class="fc-meta">${RAF.esc(p.city)} · ${p.languages.map(RAF.esc).join(', ')}</p>
<ul class="tags">${p.interests.slice(0, 3).map((i) => `<li class="tag">${RAF.esc(i)}</li>`).join('')}</ul>
<p class="fc-meta">${badge} ${rate}</p><p class="fc-meta">${p.availability.map(RAF.esc).join(', ')}</p>
<div class="fc-foot"><span class="price">${RAF.money(p.rate)}<small>/hr</small></span><a class="btn btn-ghost btn-sm" href="profile.html?id=${encodeURIComponent(p.id)}">View profile</a></div></div></article>`;
  };
  RAF.safeNext = (n) => (/^[a-z-]+\.html(\?[\w=&%.-]*)?$/.test(n || '') ? n : 'dashboard.html');
})();
