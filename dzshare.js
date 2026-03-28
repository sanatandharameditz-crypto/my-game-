/* ================================================================
   DuelZone Share System v3  —  dzshare.js
   ─────────────────────────────────────────────────────────────────
   HOW THE SCORECARD IS GENERATED:
   ──────────────────────────────
   1. Game ends  →  game JS calls  DZShare.setResult({ ... })
      This stores the result (game name, winner, score, diff, etc.)
      and clears the card cache so a fresh card is drawn next time.

   2. Player clicks the "📤 Share" button on the result screen
      →  DZShare.openModal() is called
      →  The share modal slides open
      →  A CSS spinner shows immediately in the preview area

   3. After 50 ms (so the spinner is actually painted on screen),
      _drawCard() runs.  It creates an 800×450 <canvas> element
      entirely in JS — no server, no API, no images — and draws:
        • Dark background + dot grid
        • Coloured accent bars (each game has its own accent colour)
        • DuelZone branding (top-left)
        • Game name + underline
        • Winner text (or "Rahul Wins!" if the player typed a name)
        • Score / difficulty detail
        • "Can YOU beat my score?" call-to-action box
        • Challenge URL at the bottom

   4. canvas.toDataURL('image/png') converts the canvas to a
      base-64 PNG data-URL string (validated — falls back to JPEG
      if PNG fails).  That string is set as the src of an <img>
      element inside the modal preview area.

   5. Player types their name  →  card regenerates (debounced 600ms)
      with "Rahul Wins!" on it.

   6. Player taps:
       📥 Save Image  →  triggers a download of the PNG
       WhatsApp       →  opens wa.me with text + challenge link
       📸 Share / IG  →  tries native Web Share API with the PNG
                         file attached (Android Chrome / iOS Safari 15+);
                         falls back to showing copyable caption
       🔗 Copy Link   →  copies the challenge URL to clipboard

   CHALLENGE LINK FORMAT:
     duelzone.online/chess?challenge=Rahul&score=24&diff=easy&slug=chess

   When Player 2 opens that link:
     • The game auto-selects Easy difficulty
     • A banner appears: "🏆 Beat Rahul's score of 24!"
     • After they win with a better score, a popup appears:
       "🎉 You beat Rahul's score! Share it back?"
   ================================================================ */

(function (window) {
  'use strict';

  var BASE = 'https://duelzone.online';

  /* ── Current game result (populated by setResult) ────────────── */
  var _r = {
    game:   'DuelZone',
    slug:   '',
    winner: '',
    detail: '',
    accent: '#00e5ff',
    icon:   '',
    score:  0,
    diff:   '',
    isWin:  true
  };

  /* ── Card PNG cache — cleared on every new result ────────────── */
  var _cache = null;

  /* ── Challenge params from URL (e.g. ?challenge=Rahul&score=24) ─ */
  var _ch = (function () {
    try {
      var p = new URLSearchParams(window.location.search);
      return {
        name:  p.get('challenge') || '',
        score: parseInt(p.get('score') || '0', 10) || 0,
        diff:  (p.get('diff')  || '').toLowerCase(),
        slug:  p.get('slug')   || ''
      };
    } catch (e) {
      return { name: '', score: 0, diff: '', slug: '' };
    }
  })();

  /* ================================================================
     setResult  —  called by every game JS when the game ends
     ================================================================ */
  function setResult(d) {
    _r.game   = d.game   || 'DuelZone';
    _r.slug   = d.slug   || '';
    _r.winner = d.winner || '';
    _r.detail = d.detail || '';
    _r.accent = d.accent || '#00e5ff';
    _r.icon   = d.icon   || '';
    _r.score  = d.score  || 0;
    _r.diff   = d.diff   || '';
    _r.isWin  = d.isWin  !== false;
    _cache    = null;

    /* Beat-challenge check */
    if (_r.isWin && _ch.name && _r.slug && _r.slug === _ch.slug) {
      var lowerBetter = ['minesweeper', 'sudoku', 'chess', 'darts'];
      var beats = lowerBetter.indexOf(_r.slug) !== -1
        ? (_r.score > 0 && _ch.score > 0 && _r.score < _ch.score)
        : (_r.score > _ch.score);
      if (beats) setTimeout(_showBeatPopup, 1400);
    }
  }

  /* ================================================================
     Helpers
     ================================================================ */

  /* Keep only printable ASCII — safe for canvas fillText.
     Also replaces common Unicode punctuation with ASCII. */
  function _safe(str, maxLen) {
    var s = String(str || '');
    s = s
      .replace(/\u00B7/g, '-')   /* middle dot  · */
      .replace(/\u2013/g, '-')   /* en dash     – */
      .replace(/\u2014/g, '-')   /* em dash     — */
      .replace(/\u2026/g, '...') /* ellipsis    … */
      .replace(/[^\x20-\x7E]/g, '') /* strip everything else */
      .trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen) + '...';
    return s;
  }

  /* #rrggbb or #rgb  →  rgba(r,g,b,a) */
  function _hex2rgba(hex, a) {
    hex = (hex || '#00e5ff').replace('#', '');
    if (hex.length === 3)
      hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.slice(0,2),16)||0;
    var g = parseInt(hex.slice(2,4),16)||0;
    var b = parseInt(hex.slice(4,6),16)||0;
    return 'rgba('+r+','+g+','+b+','+(a === undefined ? 1 : a)+')';
  }

  /* Challenge URL */
  function _buildURL(playerName) {
    var base   = BASE + '/' + (_r.slug || '');
    var params = [];
    var n = (playerName || '').trim();
    if (n)        params.push('challenge=' + encodeURIComponent(n));
    if (_r.score) params.push('score='     + _r.score);
    if (_r.diff)  params.push('diff='      + encodeURIComponent(_r.diff));
    if (_r.slug)  params.push('slug='      + _r.slug);
    return params.length ? base + '?' + params.join('&') : base;
  }

  /* ================================================================
     _drawCard
     ─────────────────────────────────────────────────────────────────
     Creates an 800×450 PNG entirely via HTML5 Canvas API.
     No server calls, no external images, no CORS issues.

     Key design decisions:
     • NO emoji in fillText — emoji rendering is unreliable in canvas
       across browsers (especially iOS Safari, Samsung Internet).
       We use plain ASCII text only.
     • toDataURL result is validated — some browsers return 'data:,'
       (Firefox fingerprint-resist mode) or a very short string.
       We fall back to JPEG, then show an error.
     • setTimeout(0) deferred from openModal — ensures the spinner
       is actually painted before canvas work starts (important on
       mobile where JS and paint share the same thread).
     ================================================================ */
  function _drawCard(playerName, callback) {
    if (_cache) { callback(_cache); return; }

    /* Safety timeout — 8 s is plenty for synchronous canvas work */
    var timedOut = false;
    var tid = setTimeout(function () {
      timedOut = true;
      console.warn('[DZShare] _drawCard timed out');
      callback(null);
    }, 8000);

    try {
      var W = 800, H = 450;
      var cv = document.createElement('canvas');
      cv.width  = W;
      cv.height = H;

      var ctx = cv.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context unavailable');

      var acc  = _r.accent || '#00e5ff';
      var name = (playerName || '').trim();

      /* ── 1. Background ──────────────────────────────────────────── */
      ctx.fillStyle = '#07080f';
      ctx.fillRect(0, 0, W, H);

      /* Dot grid texture */
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (var gx = 24; gx < W; gx += 32) {
        for (var gy = 24; gy < H; gy += 32) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      /* ── 2. Accent border strips ────────────────────────────────── */
      /* Top bar — fades right */
      var tg = ctx.createLinearGradient(0, 0, W, 0);
      tg.addColorStop(0,   acc);
      tg.addColorStop(0.6, _hex2rgba(acc, 0.4));
      tg.addColorStop(1,   _hex2rgba(acc, 0));
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, W, 5);

      /* Bottom bar — fades left */
      var btg = ctx.createLinearGradient(0, 0, W, 0);
      btg.addColorStop(0,   _hex2rgba(acc, 0));
      btg.addColorStop(0.4, _hex2rgba(acc, 0.4));
      btg.addColorStop(1,   acc);
      ctx.fillStyle = btg;
      ctx.fillRect(0, H - 5, W, 5);

      /* Left glow strip */
      var lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0,   _hex2rgba(acc, 0));
      lg.addColorStop(0.5, _hex2rgba(acc, 0.18));
      lg.addColorStop(1,   _hex2rgba(acc, 0));
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, 4, H);

      /* ── 3. DuelZone brand (top-left) ───────────────────────────── */
      /* Accent tick mark */
      ctx.fillStyle = acc;
      ctx.fillRect(26, 22, 3, 22);

      ctx.font         = 'bold 15px Arial,sans-serif';
      ctx.fillStyle    = '#ffffff';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('DuelZone', 37, 23);

      ctx.font      = '10px Arial,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.fillText('duelzone.online', 37, 41);

      /* ── 4. Game accent colour band (replaces unreliable emoji) ─── */
      /* Coloured rounded rectangle with the game initial */
      var iconX = W / 2, iconY = 102;

      ctx.beginPath();
      ctx.arc(iconX, iconY, 32, 0, Math.PI * 2);
      ctx.fillStyle = _hex2rgba(acc, 0.18);
      ctx.fill();
      ctx.strokeStyle = _hex2rgba(acc, 0.55);
      ctx.lineWidth = 2;
      ctx.stroke();

      /* Game initial letter inside circle */
      var gameLetter = (_safe(_r.game, 1) || 'D').toUpperCase();
      ctx.font         = 'bold 28px Arial,sans-serif';
      ctx.fillStyle    = acc;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gameLetter, iconX, iconY);

      /* ── 5. Game name ───────────────────────────────────────────── */
      var gameName = (_safe(_r.game, 26) || 'DUELZONE').toUpperCase();
      ctx.font         = 'bold 28px Arial,sans-serif';
      ctx.fillStyle    = acc;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gameName, W / 2, 166);

      /* Accent underline under game name */
      var ul = ctx.createLinearGradient(W/2 - 140, 0, W/2 + 140, 0);
      ul.addColorStop(0,   _hex2rgba(acc, 0));
      ul.addColorStop(0.5, acc);
      ul.addColorStop(1,   _hex2rgba(acc, 0));
      ctx.strokeStyle = ul;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(W/2 - 140, 181);
      ctx.lineTo(W/2 + 140, 181);
      ctx.stroke();

      /* ── 6. Main headline ──────────────────────────────────────────
         If the player typed their name:  "Beat Arjun's score!"
         If no name typed:                game's own winner text   */
      var headline, subline;
      if (name) {
        headline = 'Beat ' + _safe(name, 16) + "'s score!";
        subline  = _safe(name, 16) + ' is challenging you!';
      } else {
        headline = _safe(_r.winner, 28) || 'WINNER';
        subline  = '';
      }

      ctx.font         = 'bold 34px Arial,sans-serif';
      ctx.fillStyle    = '#ffffff';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(headline, W / 2, 216);

      if (subline) {
        ctx.font      = '15px Arial,sans-serif';
        ctx.fillStyle = _hex2rgba(acc, 0.80);
        ctx.fillText(subline, W / 2, 242);
      }

      /* ── 7. Detail line (difficulty · score) ────────────────────── */
      var detail = _safe(_r.detail, 54);
      if (!detail) {
        var cap = _r.diff
          ? _r.diff.charAt(0).toUpperCase() + _r.diff.slice(1)
          : '';
        if (cap && _r.score)   detail = cap + ' - ' + _r.score;
        else if (cap)          detail = cap;
        else if (_r.score)     detail = String(_r.score);
      }
      if (detail) {
        ctx.font         = '16px Arial,sans-serif';
        ctx.fillStyle    = 'rgba(255,255,255,0.50)';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(detail, W / 2, 266);
      }

      /* ── 8. CTA box ────────────────────────────────────────────── */
      var bx = 100, by = 298, bw = 600, bh = 60, br = 10;
      /* Rounded rect — manual path for cross-browser compat */
      ctx.beginPath();
      ctx.moveTo(bx + br, by);
      ctx.lineTo(bx + bw - br, by);
      ctx.quadraticCurveTo(bx + bw, by,      bx + bw, by + br);
      ctx.lineTo(bx + bw, by + bh - br);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
      ctx.lineTo(bx + br, by + bh);
      ctx.quadraticCurveTo(bx, by + bh,      bx, by + bh - br);
      ctx.lineTo(bx, by + br);
      ctx.quadraticCurveTo(bx, by,           bx + br, by);
      ctx.closePath();
      ctx.fillStyle   = _hex2rgba(acc, 0.08);
      ctx.fill();
      ctx.strokeStyle = _hex2rgba(acc, 0.30);
      ctx.lineWidth   = 1;
      ctx.stroke();

      /* CTA text changes based on whether a name is typed */
      var cta1 = name
        ? 'Can YOU beat ' + _safe(name, 14) + ' at ' + (_safe(_r.game, 16) || 'DuelZone') + '?'
        : 'Play ' + (_safe(_r.game, 18) || 'DuelZone') + ' on DuelZone - beat this score!';
      ctx.font         = '14px Arial,sans-serif';
      ctx.fillStyle    = acc;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cta1.slice(0, 68), W / 2, by + 20);

      ctx.font      = '13px Arial,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.50)';
      ctx.fillText('Tap the link to accept the challenge!', W / 2, by + 42);

      /* ── 9. Divider line ───────────────────────────────────────── */
      var dg = ctx.createLinearGradient(60, 0, W - 60, 0);
      dg.addColorStop(0,   'rgba(255,255,255,0)');
      dg.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      dg.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.strokeStyle = dg;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(60, 374);
      ctx.lineTo(W - 60, 374);
      ctx.stroke();

      /* ── 10. Challenge URL ─────────────────────────────────────── */
      var urlStr = _buildURL(name);
      if (urlStr.length > 70) urlStr = urlStr.slice(0, 70) + '...';
      ctx.font         = '11px Arial,sans-serif';
      ctx.fillStyle    = 'rgba(255,255,255,0.25)';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(urlStr, W / 2, 411);

      /* ── 11. Generate data URL ─────────────────────────────────── */
      if (timedOut) return;

      var dataURL = '';
      try {
        dataURL = cv.toDataURL('image/png');
      } catch (e) {
        console.warn('[DZShare] PNG toDataURL failed:', e);
      }

      /* Validate: some browsers return 'data:,' or very short strings */
      var isValid = dataURL && dataURL.indexOf('data:image') === 0 && dataURL.length > 500;

      if (!isValid) {
        /* Fallback: try JPEG */
        try {
          dataURL = cv.toDataURL('image/jpeg', 0.88);
          isValid = dataURL && dataURL.indexOf('data:image') === 0 && dataURL.length > 500;
        } catch (e2) {
          console.warn('[DZShare] JPEG toDataURL also failed:', e2);
        }
      }

      if (!isValid) {
        throw new Error('toDataURL returned empty/invalid data');
      }

      clearTimeout(tid);
      _cache = dataURL;
      console.log('[DZShare] Card generated OK, size:', Math.round(dataURL.length / 1024) + 'KB');
      callback(_cache);

    } catch (err) {
      clearTimeout(tid);
      console.error('[DZShare] _drawCard error:', err);
      if (!timedOut) callback(null);
    }
  }

  /* ================================================================
     Modal UI
     ================================================================ */
  function _getName() {
    var el = document.getElementById('dz-share-name');
    return el ? el.value.trim() : '';
  }

  function _setPreview(state, dataURL) {
    var preview = document.getElementById('dz-share-preview');
    var status  = document.getElementById('dz-share-status');
    if (!preview) return;

    if (state === 'loading') {
      preview.innerHTML = '<div class="dz-share-spinner"></div>';
      if (status) { status.textContent = 'Generating your card...'; status.style.display = 'block'; }

    } else if (state === 'done' && dataURL) {
      var img = document.createElement('img');
      img.alt = 'DuelZone share card';
      img.style.cssText = 'width:100%;border-radius:8px;display:block;';
      img.onerror = function () {
        console.error('[DZShare] img failed to load data URL');
        preview.innerHTML =
          '<div style="color:rgba(255,255,255,0.35);padding:24px;text-align:center;font-size:0.82rem">' +
          'Preview unavailable. You can still Copy Link or Save Image.</div>';
      };
      preview.innerHTML = '';
      preview.appendChild(img);
      img.src = dataURL; /* set src AFTER appending — avoids a Safari race */
      if (status) status.style.display = 'none';

    } else {
      preview.innerHTML =
        '<div style="color:rgba(255,255,255,0.35);padding:24px;text-align:center;' +
        'font-size:0.82rem;line-height:1.7;">' +
        'Preview unavailable.<br>You can still Copy Link or Save Image.</div>';
      if (status) status.style.display = 'none';
    }
  }

  /* ================================================================
     openModal
     ================================================================ */
  function openModal() {
    var modal    = document.getElementById('dz-share-modal');
    var backdrop = document.getElementById('dz-share-backdrop');

    if (!modal) {
      console.error('[DZShare] #dz-share-modal not found');
      return;
    }

    /* Pre-fill name from localStorage */
    var inp = document.getElementById('dz-share-name');
    if (inp && !inp.value) {
      try {
        var saved = localStorage.getItem('dz_player_name');
        if (saved) inp.value = saved;
      } catch (e) {}
    }

    if (backdrop) backdrop.classList.add('active');
    modal.classList.add('active');

    /* Show spinner immediately */
    _setPreview('loading');

    /* Defer card generation by 50ms so the spinner is painted first.
       This is the critical fix — without it, on mobile the canvas
       context may not be ready when drawing starts synchronously. */
    var name = _getName();
    setTimeout(function () {
      /* Safety check: modal might have been closed in the 50ms window */
      if (!modal.classList.contains('active')) return;

      _drawCard(name, function (url) {
        _setPreview(url ? 'done' : 'error', url);
      });
    }, 50);
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
     Name input — regenerate card (debounced 600 ms)
     ================================================================ */
  var _debounce = null;
  function _onNameChange() {
    var inp = document.getElementById('dz-share-name');
    if (!inp) return;
    var name = inp.value.trim();
    try { if (name) localStorage.setItem('dz_player_name', name); } catch (e) {}
    _cache = null;
    clearTimeout(_debounce);
    _setPreview('loading');
    _debounce = setTimeout(function () {
      _drawCard(name, function (url) {
        _setPreview(url ? 'done' : 'error', url);
      });
    }, 600);
  }

  /* ================================================================
     Share actions
     ================================================================ */

  /* WhatsApp */
  function _wa() {
    var name = _getName() || 'Someone';
    var text = [
      name + ' won at ' + (_r.game || 'DuelZone') + ' on DuelZone!',
      _r.detail ? _r.detail : '',
      'Can YOU beat this score?',
      _buildURL(_getName())
    ].filter(Boolean).join('\n');

    var a = document.createElement('a');
    a.href = 'https://wa.me/?text=' + encodeURIComponent(text);
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  /* Instagram / native share */
  function _ig() {
    var name    = _getName() || 'Someone';
    var caption = name + ' won at ' + (_r.game || 'DuelZone') + ' on DuelZone!\n' +
      (_r.detail ? _r.detail + '\n' : '') +
      _buildURL(_getName());

    var box  = document.getElementById('dz-share-ig-caption');
    var wrap = document.getElementById('dz-share-ig-wrap');
    if (box)  box.textContent  = caption;
    if (wrap) wrap.style.display = 'block';

    /* Try native Web Share API with file on mobile */
    function _tryNativeWithFile(dataURL) {
      if (!navigator.share || !navigator.canShare) return false;
      try {
        var parts = dataURL.split(',');
        var mime  = parts[0].match(/:(.*?);/)[1];
        var raw   = atob(parts[1]);
        var n = raw.length, u8 = new Uint8Array(n);
        while (n--) u8[n] = raw.charCodeAt(n);
        var file = new File([u8], 'duelzone-' + (_r.slug || 'result') + '.png', { type: mime });
        if (!navigator.canShare({ files: [file] })) return false;
        navigator.share({ title: (_r.game || 'DuelZone') + ' - DuelZone', text: caption, files: [file] })
          .catch(function () {});
        return true;
      } catch (e) { return false; }
    }

    function _tryNativeText() {
      if (!navigator.share) return false;
      navigator.share({ title: (_r.game || 'DuelZone') + ' - DuelZone', text: caption })
        .catch(function () {});
      return true;
    }

    if (_cache) {
      if (!_tryNativeWithFile(_cache) && !_tryNativeText()) _saveImg();
      return;
    }
    _drawCard(_getName(), function (url) {
      if (!url) { _tryNativeText(); return; }
      if (!_tryNativeWithFile(url) && !_tryNativeText()) _saveImg();
    });
  }

  /* Copy link */
  function _copy() {
    var link = _buildURL(_getName());
    var btn  = document.getElementById('dz-share-copy-btn');
    function _done() {
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = 'Copy Link'; }, 2000);
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
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = 'Copy Caption'; }, 2000);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(_done).catch(function () { _fbCopy(text); _done(); });
    } else { _fbCopy(text); _done(); }
  }

  /* Save image */
  function _saveImg() {
    function doSave(url) {
      if (!url) { alert('Could not generate image. Try Copy Link instead.'); return; }
      var a      = document.createElement('a');
      a.href     = url;
      a.download = 'duelzone-' + (_r.slug || 'result') + '.png';
      a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    if (_cache) { doSave(_cache); return; }
    _drawCard(_getName(), doSave);
  }

  /* Clipboard fallback */
  function _fbCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
    document.body.appendChild(ta); ta.select();
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
          '<div class="dz-beat-emoji">&#x1F389;</div>' +
          '<div class="dz-beat-title">You beat <span id="dz-beat-name"></span>\'s score!</div>' +
          '<div class="dz-beat-detail" id="dz-beat-detail"></div>' +
          '<div class="dz-beat-btns">' +
            '<button class="dz-beat-share-btn" ' +
              'onclick="DZShare.openModal();document.getElementById(\'dz-beat-popup\').classList.remove(\'active\')">' +
              'Share it back!</button>' +
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
    if (d) d.textContent = _r.detail || '';
    pop.classList.add('active');
  }

  /* ================================================================
     Challenge banner  (shown when page is opened via challenge link)
     ================================================================ */
  function _showChallengeBanner() {
    if (!_ch.name || !_ch.slug) return;

    var banner = document.getElementById('dz-challenge-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dz-challenge-banner';
      banner.innerHTML =
        '<span class="dz-cb-icon">&#x1F3C6;</span>' +
        '<span class="dz-cb-text">' +
          'Beat <strong id="dz-cb-name"></strong>\'s score of ' +
          '<strong id="dz-cb-score"></strong> in ' +
          '<strong id="dz-cb-game"></strong>!' +
        '</span>' +
        '<button class="dz-cb-close" aria-label="Dismiss" ' +
          'onclick="document.getElementById(\'dz-challenge-banner\').classList.remove(\'active\')">' +
          '&#x2715;</button>';
      document.body.appendChild(banner);
    }

    var nEl = document.getElementById('dz-cb-name');
    var sEl = document.getElementById('dz-cb-score');
    var gEl = document.getElementById('dz-cb-game');
    if (nEl) nEl.textContent = _ch.name;
    if (sEl) sEl.textContent = _ch.score +
      (_ch.diff ? ' (' + _ch.diff.charAt(0).toUpperCase() + _ch.diff.slice(1) + ')' : '');
    if (gEl) gEl.textContent = _ch.slug.replace(/-/g, ' ')
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });

    setTimeout(function () { banner.classList.add('active'); }, 1800);
  }

  /* ================================================================
     Init — wire name input, ESC to close, show challenge banner
     ================================================================ */
  function _init() {
    var inp = document.getElementById('dz-share-name');
    if (inp && !inp.__dzShareReady) {
      inp.__dzShareReady = true;
      inp.addEventListener('input', _onNameChange);
    }

    if (!window.__dzShareEscWired) {
      window.__dzShareEscWired = true;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var m = document.getElementById('dz-share-modal');
          if (m && m.classList.contains('active')) closeModal();
        }
      });
    }

    _showChallengeBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 0);
  }

  /* ================================================================
     Public API — backward-compatible with v1 and v2
     ================================================================ */
  window.DZShare = {
    setResult:    setResult,
    openModal:    openModal,
    closeModal:   closeModal,
    getChallenge: function () { return _ch; },
    _wa:          _wa,
    _ig:          _ig,
    _copy:        _copy,
    _saveImg:     _saveImg,
    _copyCaption: _copyCaption
  };

})(window);
