/* Loaded in <head> (not deferred) so the saved appearance applies before first paint. Non-sensitive preference only. */
(function () {
  var RAF = (window.RAF = window.RAF || {});
  var THEMES = [['classic', 'Classic ivory', '#405B4B'], ['sakura', 'Sakura (anime)', '#C2447A'], ['night', 'Starry night (anime)', '#9DB4FF'], ['matcha', 'Matcha', '#56793A']];
  var FONTS = [['editorial', 'Editorial (Playfair + DM Sans)'], ['rounded', 'Soft rounded (Zen Maru + Nunito)'], ['kawaii', 'Kawaii (Fredoka + Nunito)'], ['modern', 'Modern (Manrope)']];
  var DEFAULT_FONT = { classic: 'editorial', sakura: 'rounded', night: 'rounded', matcha: 'editorial' };
  RAF.THEMES = THEMES; RAF.FONTS = FONTS;
  RAF.appearance = {
    get: function () { try { return JSON.parse(localStorage.getItem('raf:appearance')) || {}; } catch (e) { return {}; } },
    resolve: function () {
      var a = RAF.appearance.get(), dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
      var t = THEMES.some(function (x) { return x[0] === a.theme; }) ? a.theme : (dark ? 'night' : 'classic');
      var f = FONTS.some(function (x) { return x[0] === a.font; }) ? a.font : DEFAULT_FONT[t];
      return { theme: t, font: f, fontChosen: !!a.font };
    },
    apply: function () { var r = RAF.appearance.resolve(); document.documentElement.setAttribute('data-theme', r.theme); document.documentElement.setAttribute('data-font', r.font); },
    set: function (patch) { var a = RAF.appearance.get(); Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete a[k]; else a[k] = patch[k]; }); try { localStorage.setItem('raf:appearance', JSON.stringify(a)); } catch (e) { /* storage unavailable */ } RAF.appearance.apply(); }
  };
  RAF.appearance.apply();
})();
