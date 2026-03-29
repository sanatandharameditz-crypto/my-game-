/* ================================================================
   DuelZone Share System  —  dzshare.js
   ================================================================

   HOW IT WORKS — full flow:

   PLAYER 1 (Challenger):
   ─────────────────────
   1. Plays Chess, wins. Game calls DZShare.setResult({...}).
   2. Clicks Share button → modal opens with a spinner.
   3. Types their name e.g. "Arjun" → card regenerates live.
   4. Card shows:
        ┌──────────────────────────────────────┐
        │ DuelZone          duelzone.online     │
        │          [ C ]  (Chess icon)          │
        │           CHESS                       │
        │    Beat Arjun's score!                │
        │    Arjun is challenging you!          │
        │    Easy - 24 moves                    │
        │  ┌──────────────────────────────────┐ │
        │  │ Can YOU beat Arjun at Chess?     │ │
        │  │ Tap the link to accept!          │ │
        │  └──────────────────────────────────┘ │
        │  duelzone.online/chess?challenge=Arjun │
        └──────────────────────────────────────┘
   5. Taps WhatsApp / Save / Copy — challenge link sent.
      Link: duelzone.online/chess?challenge=Arjun&score=24&diff=easy&slug=chess

   PLAYER 2 (Receiver):
   ────────────────────
   1. Clicks the link → duelzone.online opens, Chess loads automatically.
   2. Easy difficulty is auto-selected (matches Arjun's game).
   3. A banner slides in from the bottom:
        "🏆 Beat Arjun's score of 24 (Easy) in Chess!"
   4. Player 2 plays and wins in 18 moves.
   5. Popup appears: "🎉 You beat Arjun's score! Share it back?"
   6. If they click Share, a new card is generated with their name.

   ================================================================ */

(function (window) {
  'use strict';

  var BASE = 'https://duelzone.online';

  /* ── Current game result ─────────────────────────────────────── */
  var _r = {
    game:   'DuelZone',
    slug:   '',
    winner: '',
    detail: '',
    accent: '#00e5ff',
    score:  0,
    diff:   '',
    isWin:  true
  };

  /* ── PNG cache — cleared on each new result ──────────────────── */
  var _cache = null;

  /* ── Challenge params read from URL once on page load ─────────── */
  var _ch = (function () {
    try {
      var p = new URLSearchParams(window.location.search);
      /* slug can come from ?slug= param or from the URL path itself */
      var slug = p.get('slug') || '';
      if (!slug) {
        /* Try to extract from pathname e.g. /chess */
        var parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length) slug = parts[parts.length - 1];
      }
      return {
        name:  p.get('challenge') || '',
        score: parseInt(p.get('score') || '0', 10) || 0,
        diff:  (p.get('diff') || '').toLowerCase(),
        slug:  slug
      };
    } catch (e) {
      return { name: '', score: 0, diff: '', slug: '' };
    }
  })();

  /* ================================================================
     setResult — called by every game when it ends
     ================================================================ */
  function setResult(d) {
    _r.game   = d.game   || 'DuelZone';
    _r.slug   = d.slug   || '';
    _r.winner = d.winner || '';
    _r.detail = d.detail || '';
    _r.accent = d.accent || '#00e5ff';
    _r.score  = d.score  || 0;
    _r.diff   = d.diff   || '';
    _r.isWin  = d.isWin  !== false;
    _cache    = null; /* force card redraw */

    /* ── Beat-challenge check ────────────────────────────────────── */
    if (_r.isWin && _ch.name && _ch.slug &&
        (_r.slug === _ch.slug || _r.slug === '' )) {
      /* lower-is-better games: chess (moves), minesweeper/sudoku (time) */
      var lowerBetter = ['chess', 'minesweeper', 'sudoku', 'darts'];
      var beats = lowerBetter.indexOf(_r.slug) !== -1
        ? (_r.score > 0 && _ch.score > 0 && _r.score < _ch.score)
        : (_r.score > 0 && _ch.score > 0 && _r.score > _ch.score);
      if (beats) setTimeout(_showBeatPopup, 1400);
    }
  }

  /* ================================================================
     Utilities
     ================================================================ */

  /* Strip everything outside printable ASCII — safe for canvas text */
  function _safe(str, maxLen) {
    var s = String(str || '');
    s = s
      .replace(/\u00B7/g, '-')
      .replace(/\u2013|\u2014/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen) + '...';
    return s;
  }

  /* Hex colour → rgba() string */
  function _rgba(hex, a) {
    hex = (hex || '#00e5ff').replace('#', '');
    if (hex.length === 3)
      hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var rv = parseInt(hex.slice(0,2),16)||0;
    var gv = parseInt(hex.slice(2,4),16)||0;
    var bv = parseInt(hex.slice(4,6),16)||0;
    return 'rgba('+rv+','+gv+','+bv+','+(a===undefined?1:a)+')';
  }

  /* Build challenge URL.
     ALWAYS uses /?game=slug format — guaranteed to hit index.html.
     Path-based URLs (/sudoku) can 404 if the server isn't configured
     for SPA routing. The ?game= param is read by script.js directly. */
  function _buildURL(playerName) {
    var slug   = _r.slug || '';
    var params = [];
    if (slug) params.push('game=' + encodeURIComponent(slug));
    var n = (playerName || '').trim();
    if (n)        params.push('challenge=' + encodeURIComponent(n));
    if (_r.score) params.push('score='     + _r.score);
    if (_r.diff)  params.push('diff='      + encodeURIComponent(_r.diff));
    if (slug)     params.push('slug='      + slug);
    return BASE + (params.length ? '/?' + params.join('&') : '/');
  }

  /* ================================================================
     _drawCard — builds the 800×450 PNG entirely with Canvas 2D API.

     Design choices that prevent crashes across all browsers:
     • Zero emoji in fillText (unreliable on iOS Safari / Samsung Internet)
     • toDataURL result validated (Firefox privacy mode returns 'data:,')
     • JPEG fallback if PNG toDataURL fails
     • Called via setTimeout(50ms) from openModal so the spinner
       renders before canvas work starts (mobile single-thread issue)
     ================================================================ */
  function _drawCard(playerName, callback) {
    if (_cache) { callback(_cache); return; }

    var timedOut = false;
    var tid = setTimeout(function () {
      timedOut = true;
      console.warn('[DZShare] card generation timed out');
      callback(null);
    }, 8000);

    try {
      var W = 800, H = 450;
      var cv  = document.createElement('canvas');
      cv.width = W; cv.height = H;

      var ctx = cv.getContext('2d');
      if (!ctx) throw new Error('No canvas 2d context');

      var acc  = _r.accent || '#00e5ff';
      var name = (playerName || '').trim();

      /* ── Background ─────────────────────────────────────────────── */
      ctx.fillStyle = '#07080f';
      ctx.fillRect(0, 0, W, H);

      /* Subtle dot grid */
      ctx.fillStyle = 'rgba(255,255,255,0.038)';
      for (var gx = 28; gx < W; gx += 32) {
        for (var gy = 28; gy < H; gy += 32) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      /* ── Accent border bars ──────────────────────────────────────── */
      var tg = ctx.createLinearGradient(0,0,W,0);
      tg.addColorStop(0, acc);
      tg.addColorStop(0.55, _rgba(acc,0.4));
      tg.addColorStop(1, _rgba(acc,0));
      ctx.fillStyle = tg; ctx.fillRect(0,0,W,5);

      var bg = ctx.createLinearGradient(0,0,W,0);
      bg.addColorStop(0, _rgba(acc,0));
      bg.addColorStop(0.45, _rgba(acc,0.4));
      bg.addColorStop(1, acc);
      ctx.fillStyle = bg; ctx.fillRect(0,H-5,W,5);

      var lg = ctx.createLinearGradient(0,0,0,H);
      lg.addColorStop(0, _rgba(acc,0));
      lg.addColorStop(0.5, _rgba(acc,0.18));
      lg.addColorStop(1, _rgba(acc,0));
      ctx.fillStyle = lg; ctx.fillRect(0,0,4,H);

      /* ── DuelZone brand (top-left) ──────────────────────────────── */
      ctx.fillStyle = acc;
      ctx.fillRect(26, 22, 3, 22);

      ctx.font = 'bold 15px Arial,sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('DuelZone', 37, 23);

      ctx.font = '10px Arial,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillText('duelzone.online', 37, 41);

      /* ── Game icon circle (letter, not emoji) ───────────────────── */
      ctx.beginPath();
      ctx.arc(W/2, 100, 33, 0, Math.PI*2);
      ctx.fillStyle = _rgba(acc,0.15);
      ctx.fill();
      ctx.strokeStyle = _rgba(acc,0.50);
      ctx.lineWidth = 2;
      ctx.stroke();

      var letter = (_safe(_r.game,1) || 'D').toUpperCase();
      ctx.font = 'bold 30px Arial,sans-serif';
      ctx.fillStyle = acc;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(letter, W/2, 100);

      /* ── Game name ──────────────────────────────────────────────── */
      var gameName = (_safe(_r.game,26) || 'DUELZONE').toUpperCase();
      ctx.font = 'bold 26px Arial,sans-serif';
      ctx.fillStyle = acc;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(gameName, W/2, 162);

      /* Underline */
      var ul = ctx.createLinearGradient(W/2-130,0,W/2+130,0);
      ul.addColorStop(0,_rgba(acc,0)); ul.addColorStop(0.5,acc); ul.addColorStop(1,_rgba(acc,0));
      ctx.strokeStyle = ul; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W/2-130,176); ctx.lineTo(W/2+130,176); ctx.stroke();

      /* ── Headline ───────────────────────────────────────────────── */
      /* With name:    "Beat Arjun's score!"  +  "Arjun is challenging you!" */
      /* Without name: game's own winner text (e.g. "White Wins!")           */
      var headline, subline;
      if (name) {
        headline = 'Beat ' + _safe(name,16) + "'s score!";
        subline  = _safe(name,16) + ' is challenging you!';
      } else {
        headline = _safe(_r.winner,28) || 'WINNER';
        subline  = '';
      }

      ctx.font = 'bold 34px Arial,sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(headline, W/2, 214);

      if (subline) {
        ctx.font = '15px Arial,sans-serif';
        ctx.fillStyle = _rgba(acc,0.85);
        ctx.fillText(subline, W/2, 240);
      }

      /* ── Detail (difficulty / score) ────────────────────────────── */
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
        ctx.font = '16px Arial,sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.48)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(detail, W/2, 262);
      }

      /* ── CTA box ─────────────────────────────────────────────────── */
      var bx=100, by=292, bw=600, bh=60, br=10;
      ctx.beginPath();
      ctx.moveTo(bx+br,by);
      ctx.lineTo(bx+bw-br,by);
      ctx.quadraticCurveTo(bx+bw,by,bx+bw,by+br);
      ctx.lineTo(bx+bw,by+bh-br);
      ctx.quadraticCurveTo(bx+bw,by+bh,bx+bw-br,by+bh);
      ctx.lineTo(bx+br,by+bh);
      ctx.quadraticCurveTo(bx,by+bh,bx,by+bh-br);
      ctx.lineTo(bx,by+br);
      ctx.quadraticCurveTo(bx,by,bx+br,by);
      ctx.closePath();
      ctx.fillStyle = _rgba(acc,0.08); ctx.fill();
      ctx.strokeStyle = _rgba(acc,0.28); ctx.lineWidth=1; ctx.stroke();

      var cta = name
        ? 'Can YOU beat ' + _safe(name,14) + ' at ' + (_safe(_r.game,16)||'DuelZone') + '?'
        : 'Play ' + (_safe(_r.game,18)||'DuelZone') + ' on DuelZone — beat this score!';
      ctx.font = '14px Arial,sans-serif';
      ctx.fillStyle = acc;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cta.slice(0,68), W/2, by+20);

      ctx.font = '13px Arial,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.48)';
      ctx.fillText('Tap the link below to accept the challenge!', W/2, by+42);

      /* ── Divider ─────────────────────────────────────────────────── */
      var dg = ctx.createLinearGradient(60,0,W-60,0);
      dg.addColorStop(0,'rgba(255,255,255,0)');
      dg.addColorStop(0.5,'rgba(255,255,255,0.07)');
      dg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.strokeStyle=dg; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(60,367); ctx.lineTo(W-60,367); ctx.stroke();

      /* ── Challenge URL ───────────────────────────────────────────── */
      var urlStr = _buildURL(name);
      if (urlStr.length > 72) urlStr = urlStr.slice(0,72) + '...';
      ctx.font = '11px Arial,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(urlStr, W/2, 408);

      /* ── Export ──────────────────────────────────────────────────── */
      if (timedOut) return;

      var dataURL = '';
      try { dataURL = cv.toDataURL('image/png'); } catch(e) {
        console.warn('[DZShare] PNG failed:', e);
      }

      var ok = dataURL && dataURL.indexOf('data:image') === 0 && dataURL.length > 500;

      if (!ok) {
        try { dataURL = cv.toDataURL('image/jpeg', 0.9); } catch(e2) {
          console.warn('[DZShare] JPEG failed:', e2);
        }
        ok = dataURL && dataURL.indexOf('data:image') === 0 && dataURL.length > 500;
      }

      if (!ok) throw new Error('toDataURL produced invalid output');

      clearTimeout(tid);
      _cache = dataURL;
      console.log('[DZShare] Card OK —', Math.round(dataURL.length/1024) + 'KB');
      callback(_cache);

    } catch (err) {
      clearTimeout(tid);
      console.error('[DZShare] _drawCard failed:', err);
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
    var preview = document.getElementById('dz-share-preview');
    var status  = document.getElementById('dz-share-status');
    if (!preview) return;

    if (state === 'loading') {
      preview.innerHTML = '<div class="dz-share-spinner"></div>';
      if (status) { status.textContent = 'Generating your card...'; status.style.display = 'block'; }

    } else if (state === 'done' && dataURL) {
      var img = document.createElement('img');
      img.alt = 'DuelZone challenge card';
      img.style.cssText = 'width:100%;border-radius:8px;display:block;';
      img.onerror = function () {
        preview.innerHTML = _errorHTML();
      };
      preview.innerHTML = '';
      preview.appendChild(img);
      img.src = dataURL; /* assigned AFTER append — fixes Safari race */
      if (status) status.style.display = 'none';

    } else {
      preview.innerHTML = _errorHTML();
      if (status) status.style.display = 'none';
    }
  }

  function _errorHTML() {
    return '<div style="color:rgba(255,255,255,0.32);padding:26px;text-align:center;' +
      'font-size:0.82rem;line-height:1.7;">Preview unavailable.<br>' +
      'You can still use Copy Link or Save Image.</div>';
  }

  /* ================================================================
     openModal
     ================================================================ */
  function openModal() {
    var modal    = document.getElementById('dz-share-modal');
    var backdrop = document.getElementById('dz-share-backdrop');
    if (!modal) { console.error('[DZShare] modal not in DOM'); return; }

    /* Restore last used name */
    var inp = document.getElementById('dz-share-name');
    if (inp && !inp.value) {
      try { var saved = localStorage.getItem('dz_player_name'); if (saved) inp.value = saved; } catch(e) {}
    }

    if (backdrop) backdrop.classList.add('active');
    modal.classList.add('active');
    _setPreview('loading');

    /* 50 ms defer — lets the browser paint the spinner before canvas work */
    var name = _getName();
    setTimeout(function () {
      if (!modal.classList.contains('active')) return; /* modal closed already */
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
     Name input — live card regeneration (debounced 600 ms)
     ================================================================ */
  var _debounce = null;
  function _onNameChange() {
    var inp = document.getElementById('dz-share-name');
    if (!inp) return;
    var name = inp.value.trim();
    try { if (name) localStorage.setItem('dz_player_name', name); } catch(e) {}
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

  function _wa() {
    var name = _getName() || 'Someone';
    var game = _r.game || 'DuelZone';
    var text = [
      name + ' is challenging you to ' + game + ' on DuelZone!',
      _r.detail ? _r.detail : '',
      'Beat their score if you dare:',
      _buildURL(_getName())
    ].filter(Boolean).join('\n');

    var a = document.createElement('a');
    a.href = 'https://wa.me/?text=' + encodeURIComponent(text);
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function _ig() {
    var name    = _getName() || 'Someone';
    var caption = name + ' is challenging you to ' + (_r.game||'DuelZone') + ' on DuelZone!\n' +
      (_r.detail ? _r.detail + '\n' : '') +
      'Beat their score: ' + _buildURL(_getName());

    var box  = document.getElementById('dz-share-ig-caption');
    var wrap = document.getElementById('dz-share-ig-wrap');
    if (box)  box.textContent  = caption;
    if (wrap) wrap.style.display = 'block';

    function _withFile(url) {
      if (!navigator.share || !navigator.canShare) return false;
      try {
        var p  = url.split(','), mime = p[0].match(/:(.*?);/)[1];
        var r  = atob(p[1]), n = r.length, u8 = new Uint8Array(n);
        while (n--) u8[n] = r.charCodeAt(n);
        var f  = new File([u8], 'duelzone-challenge.png', {type:mime});
        if (!navigator.canShare({files:[f]})) return false;
        navigator.share({title: (_r.game||'DuelZone')+' Challenge', text:caption, files:[f]}).catch(function(){});
        return true;
      } catch(e) { return false; }
    }

    function _textOnly() {
      if (!navigator.share) return false;
      navigator.share({title: (_r.game||'DuelZone')+' Challenge', text:caption}).catch(function(){});
      return true;
    }

    if (_cache) {
      if (!_withFile(_cache) && !_textOnly()) _saveImg();
      return;
    }
    _drawCard(_getName(), function(url) {
      if (url) { if (!_withFile(url) && !_textOnly()) _saveImg(); }
      else _textOnly();
    });
  }

  function _copy() {
    var link = _buildURL(_getName());
    var btn  = document.getElementById('dz-share-copy-btn');
    function done() {
      if (btn) { btn.textContent = 'Copied!'; setTimeout(function(){ btn.textContent = 'Copy Link'; }, 2000); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(function(){ _fbCopy(link); done(); });
    } else { _fbCopy(link); done(); }
  }

  function _copyCaption() {
    var box = document.getElementById('dz-share-ig-caption');
    var btn = document.getElementById('dz-share-ig-copy');
    if (!box) return;
    var text = box.textContent;
    function done() {
      if (btn) { btn.textContent = 'Copied!'; setTimeout(function(){ btn.textContent = 'Copy Caption'; }, 2000); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function(){ _fbCopy(text); done(); });
    } else { _fbCopy(text); done(); }
  }

  function _saveImg() {
    function doSave(url) {
      if (!url) { alert('Image unavailable — try Copy Link instead.'); return; }
      var a = document.createElement('a');
      a.href = url; a.download = 'duelzone-challenge.png';
      a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    if (_cache) { doSave(_cache); return; }
    _drawCard(_getName(), doSave);
  }

  function _fbCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  }

  /* ================================================================
     Beat-score popup — shown when Player 2 beats the challenge
     ================================================================ */
  function _showBeatPopup() {
    var pop = document.getElementById('dz-beat-popup');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'dz-beat-popup';
      pop.innerHTML =
        '<div class="dz-beat-inner">' +
          '<div class="dz-beat-emoji">&#127881;</div>' +
          '<div class="dz-beat-title">You beat ' +
            '<span id="dz-beat-name"></span>\'s score!</div>' +
          '<div class="dz-beat-detail" id="dz-beat-detail"></div>' +
          '<div class="dz-beat-btns">' +
            '<button class="dz-beat-share-btn" onclick="DZShare.openModal();' +
              'document.getElementById(\'dz-beat-popup\').classList.remove(\'active\')">' +
              'Share it back!</button>' +
            '<button class="dz-beat-close-btn" ' +
              'onclick="document.getElementById(\'dz-beat-popup\').classList.remove(\'active\')">' +
              'Maybe later</button>' +
          '</div></div>';
      document.body.appendChild(pop);
    }
    var n = document.getElementById('dz-beat-name');
    var d = document.getElementById('dz-beat-detail');
    if (n) n.textContent = _ch.name;
    if (d) d.textContent = _r.detail || '';
    pop.classList.add('active');
  }

  /* ================================================================
     Challenge banner — shown when page opens via challenge link.
     Shows: "Beat Arjun's score of 24 (Easy) in Chess!"
     Waits 2s so the game has time to load its UI first.
     ================================================================ */
  function _showChallengeBanner() {
    if (!_ch.name) return; /* no challenge param in URL */

    /* Pretty-print the slug as game name e.g. "air-hockey" → "Air Hockey" */
    var gamePretty = _ch.slug
      ? _ch.slug.replace(/-/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); })
      : 'DuelZone';

    var scoreDisplay = _ch.score
      ? (_ch.score + (_ch.diff
          ? ' (' + _ch.diff.charAt(0).toUpperCase() + _ch.diff.slice(1) + ')'
          : ''))
      : '';

    var banner = document.getElementById('dz-challenge-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dz-challenge-banner';
      banner.innerHTML =
        '<span class="dz-cb-icon">&#127942;</span>' +
        '<span class="dz-cb-text">Beat <strong>' + _safe(_ch.name, 20) + '</strong>' +
          (scoreDisplay ? '\'s score of <strong>' + scoreDisplay + '</strong>' : '') +
          ' in <strong>' + gamePretty + '</strong>!' +
        '</span>' +
        '<button class="dz-cb-close" onclick="this.parentElement.classList.remove(\'active\')">' +
          '&#x2715;</button>';
      document.body.appendChild(banner);
    }

    /* 2 s delay — game screen needs time to render before banner slides in */
    setTimeout(function () { banner.classList.add('active'); }, 2000);
  }

  /* ================================================================
     Init
     ================================================================ */
  function _init() {
    /* Wire name input */
    var inp = document.getElementById('dz-share-name');
    if (inp && !inp.__dzShareReady) {
      inp.__dzShareReady = true;
      inp.addEventListener('input', _onNameChange);
    }

    /* ESC closes modal */
    if (!window.__dzShareEscWired) {
      window.__dzShareEscWired = true;
      document.addEventListener('keydown', function(e) {
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
     Public API — fully backward-compatible
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
