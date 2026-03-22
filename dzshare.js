/* ================================================================
   DuelZone Share System  —  dzshare.js
   Self-contained. No dependencies. Works locally + on duelzone.online
   ================================================================ */

(function (window) {
  'use strict';

  var BASE = 'https://duelzone.online';

  /* ── Current game result ──────────────────────────────────── */
  var _r = {
    game:   'DuelZone',
    slug:   '',
    winner: '',
    detail: '',
    accent: '#00e5ff',
    icon:   '🎮',
    score:  0,
    diff:   '',
    isWin:  true
  };

  /* ── Cached card PNG ──────────────────────────────────────── */
  var _cache = null;

  /* ── Challenge params from URL ────────────────────────────── */
  var _ch = (function () {
    try {
      var p = new URLSearchParams(window.location.search);
      return {
        name:  p.get('challenge') || '',
        score: parseInt(p.get('score') || '0', 10) || 0,
        diff:  p.get('diff')  || '',
        slug:  p.get('slug')  || ''
      };
    } catch (e) {
      return { name: '', score: 0, diff: '', slug: '' };
    }
  })();

  /* ================================================================
     setResult  —  called by every game when it ends
     ================================================================ */
  function setResult(d) {
    _r.game   = d.game   || 'DuelZone';
    _r.slug   = d.slug   || '';
    _r.winner = d.winner || '';
    _r.detail = d.detail || '';
    _r.accent = d.accent || '#00e5ff';
    _r.icon   = d.icon   || '\uD83C\uDFAE';
    _r.score  = d.score  || 0;
    _r.diff   = d.diff   || '';
    _r.isWin  = d.isWin  !== false;
    _cache    = null; // clear cache so card regenerates

    /* beat-score check */
    if (_r.isWin && _ch.name && _r.slug && _r.slug === _ch.slug) {
      var lowerBetter = ['minesweeper', 'sudoku', 'chess'];
      var beats = lowerBetter.indexOf(_r.slug) !== -1
        ? (_r.score > 0 && _ch.score > 0 && _r.score < _ch.score)
        : _r.score > _ch.score;
      if (beats) setTimeout(_showBeatPopup, 1400);
    }
  }

  /* ================================================================
     _safe  —  strip non-printable-ASCII from a string before
               drawing on canvas (emoji in canvas crashes on Windows)
     ================================================================ */
  function _safe(str, maxLen) {
    var s = String(str || '');
    /* keep printable ASCII + basic Latin Extended */
    s = s.replace(/[^\x20-\x7E\xC0-\x024F]/g, '').trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen) + '...';
    return s;
  }

  /* ================================================================
     _hex2rgba  —  convert #rrggbb to rgba() for canvas
                   (8-digit hex is unreliable in canvas on iOS)
     ================================================================ */
  function _hex2rgba(hex, a) {
    hex = (hex || '#00e5ff').replace('#', '');
    if (hex.length === 3)
      hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (a || 1) + ')';
  }

  /* ================================================================
     _buildURL  —  challenge link
     ================================================================ */
  function _buildURL(playerName) {
    var base = BASE + '/' + (_r.slug || '');
    var params = [];
    var n = playerName && playerName.trim();
    if (n)       params.push('challenge=' + encodeURIComponent(n));
    if (_r.score) params.push('score='    + _r.score);
    if (_r.diff)  params.push('diff='     + encodeURIComponent(_r.diff));
    if (_r.slug)  params.push('slug='     + _r.slug);
    return params.length ? base + '?' + params.join('&') : base;
  }

  /* ================================================================
     _drawCard  —  generates the 800×450 PNG share card
     All text is sanitised before hitting canvas so it never crashes.
     ================================================================ */
  function _drawCard(playerName, callback) {
    /* return cache if nothing changed */
    if (_cache) { callback(_cache); return; }

    /* 12-second hard timeout */
    var timedOut = false;
    var tid = setTimeout(function () {
      timedOut = true;
      callback(null);
    }, 12000);

    try {
      var W = 800, H = 450;
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');
      var acc = _r.accent || '#00e5ff';

      /* ── background ── */
      ctx.fillStyle = '#07080f';
      ctx.fillRect(0, 0, W, H);

      /* subtle grid */
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (var gx = 0; gx < W; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (var gy = 0; gy < H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      /* top accent bar */
      var tg = ctx.createLinearGradient(0, 0, W, 0);
      tg.addColorStop(0, acc);
      tg.addColorStop(0.7, _hex2rgba(acc, 0.3));
      tg.addColorStop(1, 'transparent');
      ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 6);

      /* bottom accent bar */
      var bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, 'transparent');
      bg.addColorStop(0.3, _hex2rgba(acc, 0.3));
      bg.addColorStop(1, acc);
      ctx.fillStyle = bg; ctx.fillRect(0, H - 6, W, 6);

      /* left glow strip */
      var lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, 'transparent');
      lg.addColorStop(0.5, _hex2rgba(acc, 0.18));
      lg.addColorStop(1, 'transparent');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, 4, H);

      /* ── DuelZone brand (top-left) ── */
      ctx.fillStyle = acc;
      ctx.fillRect(28, 22, 4, 26);
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('DuelZone', 40, 24);
      ctx.font = '11px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillText('duelzone.online', 40, 42);

      /* ── game icon (emoji — wrapped so it can't crash) ── */
      try {
        ctx.font = '64px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(_r.icon, W / 2, 108);
      } catch (iconErr) {
        /* fallback: solid circle in accent colour */
        ctx.beginPath();
        ctx.arc(W / 2, 108, 26, 0, Math.PI * 2);
        ctx.fillStyle = acc; ctx.fill();
      }

      /* ── game name ── */
      var gameName = _safe(_r.game, 30) || 'DUELZONE';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.fillStyle = acc;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(gameName.toUpperCase(), W / 2, 178);

      /* accent underline */
      var ug = ctx.createLinearGradient(260, 0, 540, 0);
      ug.addColorStop(0, 'transparent');
      ug.addColorStop(0.5, acc);
      ug.addColorStop(1, 'transparent');
      ctx.strokeStyle = ug; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(260, 194); ctx.lineTo(540, 194); ctx.stroke();

      /* ── winner / player name ── */
      var rawWinner = playerName && playerName.trim()
        ? playerName.trim() + (_r.isWin ? ' WINS!' : ' played')
        : (_r.winner || 'Result');
      var winnerText = _safe(rawWinner, 28);
      if (!winnerText) winnerText = 'WINNER';
      ctx.font = 'bold 42px Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(winnerText, W / 2, 256);

      /* ── detail / score ── */
      var detailText = _safe(_r.detail, 58);
      if (detailText) {
        ctx.font = '17px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.50)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(detailText, W / 2, 298);
      }

      /* ── challenge call-to-action ── */
      var pn = playerName && playerName.trim();
      var cta = pn
        ? 'I beat the bot in ' + _safe(_r.game) + '! Can YOU beat my score?'
        : 'Try ' + _safe(_r.game) + ' on DuelZone - can you beat this?';
      ctx.font = 'italic 14px Arial, sans-serif';
      ctx.fillStyle = _hex2rgba(acc, 0.72);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cta, W / 2, 340);

      /* divider */
      var dg = ctx.createLinearGradient(60, 0, W - 60, 0);
      dg.addColorStop(0, 'transparent');
      dg.addColorStop(0.5, 'rgba(255,255,255,0.10)');
      dg.addColorStop(1, 'transparent');
      ctx.strokeStyle = dg; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(60, 360); ctx.lineTo(W - 60, 360); ctx.stroke();

      /* ── challenge URL ── */
      var urlStr = _buildURL(playerName);
      if (urlStr.length > 64) urlStr = urlStr.slice(0, 64) + '...';
      ctx.font = '12px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(urlStr, W / 2, 396);

      if (timedOut) return;
      clearTimeout(tid);
      _cache = cv.toDataURL('image/png');
      callback(_cache);

    } catch (err) {
      clearTimeout(tid);
      console.error('[DZShare] Card generation failed:', err);
      if (!timedOut) callback(null);
    }
  }

  /* ================================================================
     Modal helpers
     ================================================================ */
  function _getName() {
    var el = document.getElementById('dz-share-name');
    return el ? el.value.trim() : '';
  }

  function _setPreview(state, dataURL) {
    var el = document.getElementById('dz-share-preview');
    var st = document.getElementById('dz-share-status');
    if (!el) return;
    if (state === 'loading') {
      el.innerHTML = '<div class="dz-share-spinner"></div>';
      if (st) { st.textContent = '\u23F3 Generating your card\u2026'; st.style.display = 'block'; }
    } else if (state === 'done' && dataURL) {
      var img = document.createElement('img');
      img.src = dataURL;
      img.style.cssText = 'width:100%;border-radius:8px;display:block;';
      el.innerHTML = ''; el.appendChild(img);
      if (st) st.style.display = 'none';
    } else {
      el.innerHTML =
        '<div style="color:rgba(255,255,255,0.35);padding:24px;text-align:center;font-size:0.82rem;line-height:1.6;">' +
        '\u26A0\uFE0F Could not generate preview.<br>You can still copy the link and share it!' +
        '</div>';
      if (st) st.style.display = 'none';
    }
  }

  /* ================================================================
     openModal
     ================================================================ */
  function openModal() {
    var modal    = document.getElementById('dz-share-modal');
    var backdrop = document.getElementById('dz-share-backdrop');

    if (!modal) {
      console.error('[DZShare] #dz-share-modal not found in DOM');
      return;
    }

    /* pre-fill name from localStorage */
    var inp = document.getElementById('dz-share-name');
    if (inp && !inp.value) {
      var saved = localStorage.getItem('dz_player_name');
      if (saved) inp.value = saved;
    }

    /* show modal */
    if (backdrop) backdrop.classList.add('active');
    modal.classList.add('active');

    /* show spinner + status immediately */
    _setPreview('loading');

    /* generate card */
    var name = _getName();
    var timeoutId = setTimeout(function () { _setPreview('error'); }, 13000);
    _drawCard(name, function (url) {
      clearTimeout(timeoutId);
      _setPreview(url ? 'done' : 'error', url);
    });
  }

  /* ================================================================
     closeModal
     ================================================================ */
  function closeModal() {
    var modal    = document.getElementById('dz-share-modal');
    var backdrop = document.getElementById('dz-share-backdrop');
    if (modal)    modal.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
  }

  /* ================================================================
     Name input — regenerate card when name changes (debounced)
     ================================================================ */
  var _debounce = null;
  function _onNameChange() {
    var inp = document.getElementById('dz-share-name');
    if (!inp) return;
    var name = inp.value.trim();
    if (name) localStorage.setItem('dz_player_name', name);
    _cache = null;
    clearTimeout(_debounce);
    _setPreview('loading');
    _debounce = setTimeout(function () {
      _drawCard(name, function (url) {
        _setPreview(url ? 'done' : 'error', url);
      });
    }, 700);
  }

  /* ================================================================
     Share actions
     ================================================================ */

  /* WhatsApp — anchor click is never blocked by popup blockers */
  function _wa() {
    var name = _getName();
    var n    = name || 'Someone';
    var text = [
      '\uD83C\uDFC6 ' + n + ' beat the bot in ' + _safe(_r.game) + ' on DuelZone!',
      _r.detail ? ('\uD83D\uDCCA ' + _safe(_r.detail)) : '',
      '\uD83D\uDC47 Can YOU beat this score?',
      _buildURL(name)
    ].filter(Boolean).join('\n');

    var a = document.createElement('a');
    a.href     = 'https://wa.me/?text=' + encodeURIComponent(text);
    a.target   = '_blank';
    a.rel      = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* Instagram — native share sheet on mobile, caption copy on desktop */
  function _ig() {
    var name    = _getName() || 'Someone';
    var caption =
      '\uD83C\uDFC6 ' + name + ' beat the bot in ' + _safe(_r.game) + '!\n' +
      (_r.detail ? '\uD83D\uDCCA ' + _safe(_r.detail) + '\n' : '') +
      '\uD83D\uDC47 ' + _buildURL(_getName());

    /* show caption box regardless */
    var box  = document.getElementById('dz-share-ig-caption');
    var wrap = document.getElementById('dz-share-ig-wrap');
    if (box)  box.textContent = caption;
    if (wrap) wrap.style.display = 'block';

    /* try Web Share API (opens native sheet on mobile) */
    if (navigator.share) {
      navigator.share({
        title: _safe(_r.game) + ' \u2014 DuelZone',
        text:  caption
      }).catch(function () {});
      return;
    }

    /* desktop fallback: save the image */
    _saveImg();
  }

  /* Copy challenge link */
  function _copy() {
    var link = _buildURL(_getName());
    var btn  = document.getElementById('dz-share-copy-btn');
    function _done() {
      if (btn) {
        btn.textContent = '\u2705 Copied!';
        setTimeout(function () { btn.textContent = '\uD83D\uDD17 Copy Link'; }, 2000);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(_done).catch(function () { _fbCopy(link); _done(); });
    } else { _fbCopy(link); _done(); }
  }

  /* Copy Instagram caption */
  function _copyCaption() {
    var box = document.getElementById('dz-share-ig-caption');
    var btn = document.getElementById('dz-share-ig-copy');
    if (!box) return;
    var text = box.textContent;
    function _done() {
      if (btn) {
        btn.textContent = '\u2705 Copied!';
        setTimeout(function () { btn.textContent = '\uD83D\uDCCB Copy Caption'; }, 2000);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(_done).catch(function () { _fbCopy(text); _done(); });
    } else { _fbCopy(text); _done(); }
  }

  /* Save image to device */
  function _saveImg() {
    function doSave(url) {
      if (!url) return;
      var a      = document.createElement('a');
      a.href     = url;
      a.download = 'duelzone-' + (_r.slug || 'result') + '.png';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    if (_cache) { doSave(_cache); return; }
    _drawCard(_getName(), doSave);
  }

  /* Clipboard fallback for older browsers */
  function _fbCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ================================================================
     Beat-score popup
     ================================================================ */
  function _showBeatPopup() {
    var pop = document.getElementById('dz-beat-popup');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'dz-beat-popup';
      pop.innerHTML =
        '<div class="dz-beat-inner">' +
          '<div class="dz-beat-emoji">\uD83C\uDF89</div>' +
          '<div class="dz-beat-title">You beat <span id="dz-beat-name"></span>\'s score!</div>' +
          '<div class="dz-beat-detail" id="dz-beat-detail"></div>' +
          '<div class="dz-beat-btns">' +
            '<button class="dz-beat-share-btn" ' +
              'onclick="DZShare.openModal();document.getElementById(\'dz-beat-popup\').classList.remove(\'active\')">' +
              '\uD83D\uDCE4 Share it back!</button>' +
            '<button class="dz-beat-close-btn" ' +
              'onclick="document.getElementById(\'dz-beat-popup\').classList.remove(\'active\')">' +
              'Maybe later</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(pop);
    }
    var n = document.getElementById('dz-beat-name');
    var d = document.getElementById('dz-beat-detail');
    if (n) n.textContent = _ch.name;
    if (d) d.textContent = _safe(_r.detail);
    pop.classList.add('active');
  }

  /* ================================================================
     Challenge banner (shown when page opened via challenge link)
     ================================================================ */
  function _showChallengeBanner() {
    if (!_ch.name || !_ch.slug) return;

    var banner = document.getElementById('dz-challenge-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dz-challenge-banner';
      banner.innerHTML =
        '<span class="dz-cb-icon">\uD83C\uDFC6</span>' +
        '<span class="dz-cb-text">Beat <strong id="dz-cb-name"></strong>\'s ' +
        'score of <strong id="dz-cb-score"></strong> in <strong id="dz-cb-game"></strong>!</span>' +
        '<button class="dz-cb-close" ' +
          'onclick="document.getElementById(\'dz-challenge-banner\').classList.remove(\'active\')">' +
          '\u2715</button>';
      document.body.appendChild(banner);
    }

    var n = document.getElementById('dz-cb-name');
    var s = document.getElementById('dz-cb-score');
    var g = document.getElementById('dz-cb-game');
    if (n) n.textContent = _ch.name;
    if (s) s.textContent = _ch.score;
    if (g) g.textContent = _safe(_r.game) || _ch.slug;

    setTimeout(function () { banner.classList.add('active'); }, 1800);
  }

  /* ================================================================
     Init — wire name input, ESC key, challenge banner
     ================================================================ */
  function _init() {
    /* name input debounce */
    var inp = document.getElementById('dz-share-name');
    if (inp && !inp.__dzShareReady) {
      inp.__dzShareReady = true;
      inp.addEventListener('input', _onNameChange);
    }

    /* ESC closes modal */
    if (!window.__dzShareEscWired) {
      window.__dzShareEscWired = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var m = document.getElementById('dz-share-modal');
          if (m && m.classList.contains('active')) closeModal();
        }
      });
    }

    /* challenge banner */
    _showChallengeBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 0);
  }

  /* ================================================================
     Public API
     ================================================================ */
  window.DZShare = {
    setResult:    setResult,
    openModal:    openModal,
    closeModal:   closeModal,
    getChallenge: function () { return _ch; },
    /* called directly from onclick in HTML */
    _wa:          _wa,
    _ig:          _ig,
    _copy:        _copy,
    _saveImg:     _saveImg,
    _copyCaption: _copyCaption
  };

})(window);
