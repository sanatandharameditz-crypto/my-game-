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

    /* ── Beat-challenge check ────────────────────────────────────────
       Fires when Player 2 wins the SAME game Arjun challenged them in.
       For games where lower score = better (chess moves, time-based),
       Player 2 beats Arjun if their score < Arjun's score.
       For all other games Player 2 beats Arjun if score > Arjun's.
       If there is no numeric score to compare, just winning is enough.
       ─────────────────────────────────────────────────────────────── */
    if (_r.isWin && _ch.name && _ch.slug &&
        (_r.slug === _ch.slug || _r.slug === '')) {

      var lowerBetter = ['chess', 'minesweeper', 'sudoku'];
      var beats;

      if (_r.score > 0 && _ch.score > 0) {
        /* Both have a numeric score — compare properly */
        beats = lowerBetter.indexOf(_r.slug) !== -1
          ? (_r.score < _ch.score)   /* fewer moves/seconds = better */
          : (_r.score >= _ch.score); /* higher score = better (or equal — they matched!) */
      } else {
        /* No numeric score on either side — just winning counts as beating */
        beats = true;
      }

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

  /* ================================================================
     _gameMsg — dare/challenge tone messages for every game.

     The goal: Player 2 must feel like they're being dared.
     "Rahul beat Chess AI on Hard in 38 moves — do you dare?"
     Not a boring score share — a personal challenge.

     Returns: { headline, subline, cta, wa }
       headline — big card text
       subline  — score/detail line
       cta      — call to action on card
       wa       — full WhatsApp/share message text
     ================================================================ */
  function _gameMsg(name) {
    var n      = (name || '').trim();
    var slug   = _r.slug || '';
    var diff   = _r.diff ? (_r.diff.charAt(0).toUpperCase() + _r.diff.slice(1)) : '';
    var detail = _safe(_r.detail, 54);
    var win    = _r.isWin;
    var game   = _safe(_r.game, 22) || 'DuelZone';

    /* ── Generic fallback (used when no slug matches) ── */
    var headline, subline, cta, wa;

    if (n) {
      headline = win ? n + '\'s Challenge!' : n + '\'s Dare!';
      subline  = detail || (diff ? diff + ' mode' : '');
      cta      = 'Do you dare to accept?';
      wa       = n + ' is challenging you at ' + game + ' on DuelZone!\n' +
                 (detail ? detail + '\n' : '') +
                 'Accept the challenge: ';
    } else {
      headline = _safe(_r.winner, 28) || game;
      subline  = detail || '';
      cta      = 'Can you beat this?';
      wa       = 'Someone just played ' + game + ' on DuelZone!\n' +
                 (detail ? detail + '\n' : '') + 'Think you can do better? ';
    }

    /* ═══════════════════════════════════════════════════════
       PER-GAME MESSAGES
       ─────────────────────────────────────────────────────
       win=true  → player beat the bot / won the round
       win=false → player lost to bot ("can you do what they couldn\'t?")
       n = player\'s typed name
       diff = Easy / Medium / Hard etc.
       detail = exact detail string from setResult
    ═══════════════════════════════════════════════════════ */

    /* ── CHESS ─────────────────────────────────────────── */
    if (slug === 'chess') {
      var moves = _r.score ? _r.score + ' moves' : '';
      if (n) {
        if (win) {
          headline = n + ' dares you at Chess!';
          subline  = 'Beat the AI on ' + (diff||'?') + (moves ? ' in ' + moves : '');
          cta      = 'Can YOU beat it in fewer moves?';
          wa       = n + ' just beat the Chess AI on ' + (diff||'') +
                     (moves ? ' in just ' + moves : '') + '!' +
                     '\nThink you can do better? I dare you to try:';
        } else {
          headline = n + ' lost to Chess AI!';
          subline  = 'Failed on ' + (diff||'') + (moves ? ' · ' + moves : '');
          cta      = 'Can YOU beat the bot they couldn\'t?';
          wa       = n + ' lost to the Chess AI on ' + (diff||'') + '.' +
                     '\nCan YOU beat the bot where they couldn\'t? Prove it:';
        }
      }
    }

    /* ── CHECKERS ──────────────────────────────────────── */
    else if (slug === 'checkers') {
      if (n) {
        if (win) {
          headline = n + ' dares you at Checkers!';
          subline  = 'Beat the AI on ' + (diff||'this') + ' level';
          cta      = 'Accept the challenge?';
          wa       = n + ' just crushed the Checkers AI on ' + (diff||'') + '!' +
                     '\nDare to take them on? Click here:';
        } else {
          headline = n + ' got destroyed at Checkers!';
          subline  = 'Lost on ' + (diff||'') + ' — can YOU win?';
          cta      = 'Beat the bot they couldn\'t!';
          wa       = n + ' lost to the Checkers AI on ' + (diff||'') + '.' +
                     '\nCan YOU beat the bot that beat them? Accept the dare:';
        }
      }
    }

    /* ── SUDOKU ────────────────────────────────────────── */
    else if (slug === 'sudoku') {
      if (n) {
        if (win) {
          headline = n + ' dares you at Sudoku!';
          subline  = detail || (diff ? diff + ' puzzle' : '');
          cta      = 'Solve it faster if you can!';
          wa       = n + ' solved a ' + (diff||'') + ' Sudoku on DuelZone!' +
                     (detail ? '\n' + detail : '') +
                     '\nThink you can solve it faster? I dare you:';
        } else {
          headline = n + ' failed ' + (diff||'') + ' Sudoku!';
          subline  = 'Too many mistakes — your turn to try';
          cta      = 'Finish what they couldn\'t!';
          wa       = n + ' couldn\'t finish the ' + (diff||'') + ' Sudoku!' +
                     '\nCan YOU do what they couldn\'t? Accept the challenge:';
        }
      }
    }

    /* ── MINESWEEPER ───────────────────────────────────── */
    else if (slug === 'minesweeper') {
      var time = _r.score ? _r.score + 's' : '';
      if (n) {
        if (win) {
          headline = n + ' dares you at Minesweeper!';
          subline  = 'Cleared ' + (diff||'') + (time ? ' in ' + time : '') + ' — beat that!';
          cta      = 'Defuse it faster if you dare!';
          wa       = n + ' cleared ' + (diff||'') + ' Minesweeper' +
                     (time ? ' in ' + time : '') + ' without blowing up!' +
                     '\nDare to beat their time? Go here:';
        } else {
          headline = n + ' hit a mine!';
          subline  = 'BOOM on ' + (diff||'') + ' — think YOU can survive?';
          cta      = 'Don\'t blow up like they did!';
          wa       = n + ' hit a mine on ' + (diff||'') + ' Minesweeper!' +
                     '\nThink YOU can clear it without exploding? Prove it:';
        }
      }
    }

    /* ── HAND CRICKET ──────────────────────────────────── */
    else if (slug === 'hand-cricket') {
      if (n) {
        if (win) {
          headline = n + ' dares you at Hand Cricket!';
          subline  = detail || 'Beat their score!';
          cta      = 'Score more runs if you dare!';
          wa       = n + ' just dominated Hand Cricket on DuelZone!' +
                     (detail ? '\n' + detail : '') +
                     '\nThink your cricket is better? Accept the dare:';
        } else {
          headline = n + ' got out at Hand Cricket!';
          subline  = detail || 'Bot won — your turn!';
          cta      = 'Can YOU score where they got out?';
          wa       = n + ' got out against the cricket bot!' +
                     (detail ? '\n' + detail : '') +
                     '\nCan YOU score where they failed? Accept the challenge:';
        }
      }
    }

    /* ── DARTS ─────────────────────────────────────────── */
    else if (slug === 'darts') {
      if (n) {
        if (win) {
          headline = n + ' dares you at Darts!';
          subline  = 'Beat the ' + (diff||'') + ' bot — if you can!';
          cta      = 'Is your aim better than theirs?';
          wa       = n + ' just bullseyed the Darts bot on ' + (diff||'') + ' difficulty!' +
                     (detail ? '\n' + detail : '') +
                     '\nThink your aim is sharper? I dare you to prove it:';
        } else {
          headline = n + ' missed at Darts!';
          subline  = 'Bot won on ' + (diff||'') + ' — can YOU hit the bullseye?';
          cta      = 'Better aim than them?';
          wa       = n + ' missed against the Darts bot on ' + (diff||'') + '!' +
                     '\nCan YOUR aim beat the bot? Accept the dare:';
        }
      }
    }

    /* ── LUDO ──────────────────────────────────────────── */
    else if (slug === 'ludo') {
      var turns = _r.score ? _r.score + ' turns' : '';
      if (n) {
        if (win) {
          headline = n + ' dares you at Ludo!';
          subline  = 'Beat ' + (diff||'') + ' bot' + (turns ? ' in ' + turns : '');
          cta      = 'Can YOU finish faster?';
          wa       = n + ' just beat the Ludo bot' +
                     (diff ? ' on ' + diff : '') +
                     (turns ? ' in ' + turns : '') + '!' +
                     '\nCan YOU finish in fewer turns? Accept the dare:';
        } else {
          headline = n + ' lost at Ludo!';
          subline  = 'Knocked out by ' + (diff||'') + ' bot!';
          cta      = 'Beat the bot they couldn\'t!';
          wa       = n + ' got knocked out by the Ludo bot' +
                     (diff ? ' on ' + diff : '') + '!' +
                     '\nCan YOU beat the bot where they failed? Accept the challenge:';
        }
      }
    }

    /* ── CARROM ────────────────────────────────────────── */
    else if (slug === 'carrom') {
      if (n) {
        if (win) {
          headline = n + ' dares you at Carrom!';
          subline  = detail || (diff ? 'Beat ' + diff + ' bot' : 'Pocketed everything!');
          cta      = 'Can YOU pocket more?';
          wa       = n + ' just dominated Carrom on DuelZone!' +
                     (detail ? '\n' + detail : '') +
                     '\nDare to beat their pocket count? Go here:';
        } else {
          headline = n + ' lost at Carrom!';
          subline  = 'Bot won — can YOU do better?';
          cta      = 'Accept the Carrom challenge!';
          wa       = n + ' lost at Carrom!' +
                     (detail ? '\n' + detail : '') +
                     '\nCan YOU win where they lost? Prove it:';
        }
      }
    }

    /* ── PING PONG ─────────────────────────────────────── */
    else if (slug === 'ping-pong') {
      if (n) {
        if (win) {
          headline = n + ' dares you at Ping Pong!';
          subline  = detail || 'Think you can return their serve?';
          cta      = 'Return the challenge!';
          wa       = n + ' is challenging you to Ping Pong on DuelZone!' +
                     (detail ? '\n' + detail : '') +
                     '\nDare to take them on? Click here:';
        } else {
          headline = n + ' lost at Ping Pong!';
          subline  = detail || 'Can YOU win where they lost?';
          cta      = 'Win the match they couldn\'t!';
          wa       = n + ' lost at Ping Pong on DuelZone!' +
                     '\nCan YOU win where they lost? Accept the dare:';
        }
      }
    }

    /* ── AIR HOCKEY ────────────────────────────────────── */
    else if (slug === 'air-hockey') {
      if (n) {
        headline = n + (win ? ' dares you at Air Hockey!' : ' got smashed at Air Hockey!');
        subline  = detail || (win ? 'Think you can score more?' : 'Can YOU do better?');
        cta      = win ? 'Defend against their power shot!' : 'Win where they lost!';
        wa       = n + (win ? ' is dominating Air Hockey on DuelZone!' : ' got smashed at Air Hockey!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Dare to score more? Go here:' : 'Can YOU win where they couldn\'t?');
      }
    }

    /* ── BATTLESHIP ────────────────────────────────────── */
    else if (slug === 'battleship') {
      if (n) {
        if (win) {
          headline = n + ' sank your fleet!';
          subline  = detail || 'Can YOUR navy survive?';
          cta      = 'Return fire if you dare!';
          wa       = n + ' just sank the entire fleet in Battleship on DuelZone!' +
                     (detail ? '\n' + detail : '') +
                     '\nThink YOUR navy can survive? I dare you to try:';
        } else {
          headline = n + '\'s fleet got sunk!';
          subline  = 'Can YOU keep YOUR fleet afloat?';
          cta      = 'Win the battle they lost!';
          wa       = n + '\'s fleet got completely destroyed in Battleship!' +
                     '\nCan YOU win where they sank? Accept the dare:';
        }
      }
    }

    /* ── REACTION DUEL ─────────────────────────────────── */
    else if (slug === 'reaction-duel') {
      if (n) {
        headline = win ? n + '\'s reflexes dare you!' : n + ' was too slow!';
        subline  = detail || (win ? 'Can YOUR reaction beat theirs?' : 'Can YOU be faster?');
        cta      = win ? 'Think you\'re faster? Prove it!' : 'Be faster than they were!';
        wa       = n + (win ? ' just smashed Reaction Duel!' : ' was too slow at Reaction Duel!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOUR reflexes are faster? Dare to find out:' : 'Can YOU react faster? Accept the dare:');
      }
    }

    /* ── TETRIS ────────────────────────────────────────── */
    else if (slug === 'tetris') {
      if (n) {
        headline = win ? n + ' dares you at Tetris!' : n + ' got topped out!';
        subline  = detail || (win ? 'Can YOU stack higher?' : 'Can YOU survive longer?');
        cta      = win ? 'Stack better than them!' : 'Don\'t top out like they did!';
        wa       = n + (win ? ' dominated Tetris Battle!' : ' got topped out at Tetris!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOU can stack better? Accept the dare:' : 'Can YOU survive longer? Prove it:');
      }
    }

    /* ── BOMBERMAN ─────────────────────────────────────── */
    else if (slug === 'bomberman') {
      if (n) {
        headline = win ? n + ' dares you at Bomberman!' : n + ' got blown up!';
        subline  = detail || (win ? 'Can YOU outlast them?' : 'Don\'t blow up like they did!');
        cta      = win ? 'Can YOUR bomb game beat theirs?' : 'Survive where they exploded!';
        wa       = n + (win ? ' dominated Bomberman on DuelZone!' : ' got blown up in Bomberman!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOUR bomb skills are better? Accept the dare:' : 'Can YOU survive the blast? Prove it:');
      }
    }

    /* ── TANKS ─────────────────────────────────────────── */
    else if (slug === 'tanks') {
      if (n) {
        headline = win ? n + '\'s tank dares you!' : n + '\'s tank got destroyed!';
        subline  = detail || (diff ? diff + ' bot' : '');
        cta      = win ? 'Can YOUR tank destroy theirs?' : 'Win the battle they lost!';
        wa       = n + (win ? '\'s tank just dominated on DuelZone!' : '\'s tank got blown up!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOUR tank is stronger? Accept the dare:' : 'Can YOUR tank win where theirs failed?');
      }
    }

    /* ── STAR CATCHER ──────────────────────────────────── */
    else if (slug === 'star-catcher') {
      if (n) {
        headline = win ? n + ' dares you at Star Catcher!' : n + ' dropped the stars!';
        subline  = detail || (win ? 'Catch more stars if you can!' : 'Can YOU catch them all?');
        cta      = win ? 'Out-catch them if you dare!' : 'Catch what they dropped!';
        wa       = n + (win ? ' is catching stars on DuelZone!' : ' dropped the ball at Star Catcher!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOU can catch more? Accept the dare:' : 'Can YOU do better? Prove it:');
      }
    }

    /* ── SPACE DODGE ───────────────────────────────────── */
    else if (slug === 'space-dodge') {
      if (n) {
        headline = win ? n + ' dares you at Space Dodge!' : n + '\'s ship got hit!';
        subline  = detail || (win ? 'Dodge longer if you dare!' : 'Don\'t get hit like they did!');
        cta      = win ? 'Survive longer than them!' : 'Dodge what destroyed them!';
        wa       = n + (win ? ' survived Space Dodge on DuelZone!' : '\'s ship got destroyed in Space Dodge!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOU can dodge longer? Accept the dare:' : 'Can YOU dodge what took them down?');
      }
    }

    /* ── TERRITORY WAR ─────────────────────────────────── */
    else if (slug === 'territory') {
      if (n) {
        headline = win ? n + ' conquered the map!' : n + ' lost the territory!';
        subline  = detail || (win ? 'Can YOU claim more?' : 'Can YOU hold the ground?');
        cta      = win ? 'Claim more territory than them!' : 'Win the war they lost!';
        wa       = n + (win ? ' just conquered Territory War on DuelZone!' : ' lost the territory war!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOU can claim more territory? Accept the dare:' : 'Can YOU hold the ground where they lost?');
      }
    }

    /* ── TIC TAC TOE ───────────────────────────────────── */
    else if (slug === 'tic-tac-toe') {
      if (n) {
        headline = win ? n + ' dares you at Tic Tac Toe!' : n + ' lost at Tic Tac Toe!';
        subline  = diff ? (win ? 'Beat ' + diff + ' bot — can YOU?' : 'Beaten on ' + diff + ' — your turn!') : detail;
        cta      = win ? 'Out-think them!' : 'Win where they lost!';
        wa       = n + (win ? ' beat the Tic Tac Toe bot on ' + (diff||'') + '!' : ' lost to the Tic Tac Toe bot on ' + (diff||'') + '!') +
                   '\n' + (win ? 'Think YOUR strategy is better? Accept the dare:' : 'Can YOU beat the bot where they couldn\'t?');
      }
    }

    /* ── CONNECT FOUR ──────────────────────────────────── */
    else if (slug === 'connect-four') {
      if (n) {
        headline = win ? n + ' dares you at Connect Four!' : n + ' got connected!';
        subline  = diff && diff.toLowerCase() !== 'pvp' ? (win ? 'Beat ' + diff + ' bot!' : 'Lost on ' + diff) : detail;
        cta      = win ? 'Can YOU connect before them?' : 'Win what they lost!';
        wa       = n + (win ? ' just beat the Connect Four bot' + (diff ? ' on ' + diff : '') + '!' : ' lost at Connect Four!') +
                   '\n' + (win ? 'Think YOUR strategy can beat theirs? Accept the dare:' : 'Can YOU win where they lost?');
      }
    }

    /* ── ROCK PAPER SCISSORS ───────────────────────────── */
    else if (slug === 'rock-paper-scissors') {
      if (n) {
        headline = win ? n + ' dares you at RPS!' : n + ' got beaten at RPS!';
        subline  = detail || (win ? 'Best your luck!' : 'Can YOU win the match?');
        cta      = win ? 'Rock, Paper or Scissors — choose!' : 'Beat them in the rematch!';
        wa       = n + (win ? ' just dominated Rock Paper Scissors on DuelZone!' : ' got beaten at Rock Paper Scissors!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOUR hand can beat theirs? Accept the dare:' : 'Can YOU win the rematch?');
      }
    }

    /* ── TAP BATTLE ────────────────────────────────────── */
    else if (slug === 'tap-battle') {
      if (n) {
        headline = win ? n + '\'s thumbs dare yours!' : n + '\'s thumbs lost!';
        subline  = diff ? (win ? diff + ' speed — beat that!' : 'Outrun on ' + diff + ' speed') : 'First to 100 taps';
        cta      = win ? 'Can YOUR thumbs keep up?' : 'Tap faster than they did!';
        wa       = n + (win ? '\'s thumbs just won Tap Battle on DuelZone!' : '\'s thumbs couldn\'t keep up in Tap Battle!') +
                   '\n' + (win ? 'Think YOUR thumbs are faster? Accept the dare:' : 'Think YOUR thumbs are faster?');
      }
    }

    /* ── 2048 DUEL ─────────────────────────────────────── */
    else if (slug === '2048-duel') {
      if (n) {
        headline = win ? n + ' dares you at 2048!' : n + '\'s tiles collapsed!';
        subline  = detail || (win ? 'Merge higher than them!' : 'Can YOU merge higher?');
        cta      = win ? 'Can YOU get a higher tile?' : 'Merge where they failed!';
        wa       = n + (win ? ' just won 2048 Duel on DuelZone!' : '\'s tiles collapsed at 2048!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOU can merge higher? Accept the dare:' : 'Can YOU merge higher than they did?');
      }
    }

    /* ── MEMORY FLIP ───────────────────────────────────── */
    else if (slug === 'memory-flip') {
      if (n) {
        headline = win ? n + ' dares YOUR memory!' : n + '\'s memory failed!';
        subline  = detail || (win ? 'Can YOU remember more pairs?' : 'Can YOU flip better?');
        cta      = win ? 'Think YOUR memory is better?' : 'Flip better than they did!';
        wa       = n + (win ? ' dominated Memory Flip Duel on DuelZone!' : '\'s memory failed at Memory Flip!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOUR memory is sharper? Accept the dare:' : 'Can YOU flip better? Prove it:');
      }
    }

    /* ── CONNECT DOTS ──────────────────────────────────── */
    else if (slug === 'connect-dots') {
      if (n) {
        headline = win ? n + ' dares you at Connect Dots!' : n + ' lost the dots!';
        subline  = detail || (win ? 'Claim more boxes if you can!' : 'Can YOU claim more?');
        cta      = win ? 'Out-connect them if you dare!' : 'Win the dots they lost!';
        wa       = n + (win ? ' dominated Connect Dots on DuelZone!' : ' lost at Connect Dots!') +
                   (detail ? '\n' + detail : '') +
                   '\n' + (win ? 'Think YOU can claim more boxes? Accept the dare:' : 'Can YOU win where they lost?');
      }
    }

    /* ── PASSWORD BREAKER ──────────────────────────────── */
    else if (slug === 'password-breaker') {
      if (n) {
        if (win) {
          headline = n + ' cracked YOUR code!';
          subline  = detail || 'Can YOU crack it faster?';
          cta      = 'Crack it faster if you dare!';
          wa       = n + ' cracked the Password Breaker code on DuelZone!' +
                     (detail ? '\n' + detail : '') +
                     '\nThink YOU can crack it faster? Accept the dare:';
        } else {
          headline = n + ' couldn\'t crack the code!';
          subline  = 'Can YOU break what broke them?';
          cta      = 'Crack what they couldn\'t!';
          wa       = n + ' couldn\'t crack the Password Breaker code!' +
                     '\nThink YOU can crack it where they failed? Accept the dare:';
        }
      }
    }

    return { headline: headline, subline: subline, cta: cta, wa: wa };
  }


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

      /* ── Headline — game-specific contextual message ─────────────── */
      var _msg = _gameMsg(name);
      var headline = _safe(_msg.headline, 34) || (_safe(_r.winner,28) || 'WINNER');
      var subline  = _safe(_msg.subline,  54) || '';

      ctx.font = 'bold 30px Arial,sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      /* shrink font if too long */
      if (ctx.measureText(headline).width > W - 80) {
        ctx.font = 'bold 24px Arial,sans-serif';
      }
      ctx.fillText(headline, W/2, 214);

      if (subline) {
        ctx.font = '14px Arial,sans-serif';
        ctx.fillStyle = _rgba(acc,0.85);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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

      var cta = _safe(_msg.cta || (name
        ? 'Can YOU beat ' + _safe(name,14) + ' at ' + (_safe(_r.game,16)||'DuelZone') + '?'
        : 'Play ' + (_safe(_r.game,18)||'DuelZone') + ' on DuelZone!'), 68);
      ctx.font = '14px Arial,sans-serif';
      ctx.fillStyle = acc;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cta, W/2, by+20);

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

  /* ================================================================
     _shareWithImage
     ─────────────────────────────────────────────────────────────────
     Core share helper used by both _wa() and _ig().

     Priority order:
       1. Web Share API with PNG file attached (Android Chrome, iOS Safari 15+)
          → opens native share sheet with image + text + link
       2. Web Share API text only (older mobile browsers)
          → opens native share sheet with text + link only
       3. Desktop fallback → opens wa.me or copies caption
          (image cannot be attached on desktop without user saving first —
           this is a browser security restriction, not something we can bypass)
     ================================================================ */
  function _dataURLtoFile(dataURL, filename) {
    try {
      var arr  = dataURL.split(',');
      var mime = arr[0].match(/:(.*?);/)[1];
      var raw  = atob(arr[1]);
      var n    = raw.length;
      var u8   = new Uint8Array(n);
      while (n--) u8[n] = raw.charCodeAt(n);
      return new File([u8], filename, { type: mime });
    } catch (e) { return null; }
  }

  function _shareWithImage(text, url, onDesktopFallback) {
    var link    = url || _buildURL(_getName());
    var fullMsg = text + '\n' + link;
    var fname   = 'duelzone-challenge.png';

    /* ── Try Web Share API with file (best: image + text + link) ── */
    function _tryWithFile(dataURL) {
      if (!navigator.share || !navigator.canShare) return false;
      var f = _dataURLtoFile(dataURL, fname);
      if (!f) return false;
      try {
        if (!navigator.canShare({ files: [f] })) return false;
        navigator.share({
          title: (_r.game || 'DuelZone') + ' Challenge — DuelZone',
          text:  fullMsg,
          files: [f]
        }).catch(function () {});
        return true;
      } catch (e) { return false; }
    }

    /* ── Try Web Share API text + link only (no file) ─────────── */
    function _tryTextOnly() {
      if (!navigator.share) return false;
      navigator.share({
        title: (_r.game || 'DuelZone') + ' Challenge — DuelZone',
        text:  fullMsg
      }).catch(function () {});
      return true;
    }

    /* ── Generate card then share ──────────────────────────────── */
    if (_cache) {
      if (!_tryWithFile(_cache) && !_tryTextOnly()) onDesktopFallback(link, fullMsg);
      return;
    }
    _drawCard(_getName(), function (dataURL) {
      if (dataURL) {
        if (!_tryWithFile(dataURL) && !_tryTextOnly()) onDesktopFallback(link, fullMsg);
      } else {
        if (!_tryTextOnly()) onDesktopFallback(link, fullMsg);
      }
    });
  }

  /* ── WhatsApp ──────────────────────────────────────────────────
     Mobile: native share sheet opens (image + text + link attached)
     Desktop: wa.me link opens in browser with text + link          */
  function _wa() {
    var name = _getName() || 'Someone';
    var msg  = _gameMsg(name);
    var text = msg.wa || (name + ' is challenging you at ' + (_r.game||'DuelZone') + '!');

    _shareWithImage(text, _buildURL(_getName()), function (link, fullMsg) {
      /* Desktop fallback — open WhatsApp web with text */
      var a     = document.createElement('a');
      a.href    = 'https://wa.me/?text=' + encodeURIComponent(fullMsg);
      a.target  = '_blank';
      a.rel     = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });
  }

  /* ── Instagram / General Share ─────────────────────────────────
     Mobile: native share sheet opens (image + text + link attached)
     Desktop: copies the challenge link to clipboard + shows notice  */
  function _ig() {
    var name = _getName() || 'Someone';
    var msg  = _gameMsg(name);
    var text = msg.wa || (name + ' is challenging you at ' + (_r.game||'DuelZone') + '!');

    _shareWithImage(text, _buildURL(_getName()), function (link) {
      /* Desktop fallback — copy link */
      _fbCopy(link);
      var btn = document.getElementById('dz-share-ig-btn');
      if (btn) {
        btn.textContent = '&#10003; Link Copied!';
        setTimeout(function () { btn.innerHTML = '&#128248; Share / IG'; }, 2500);
      }
    });
  }

  /* ── Copy Link ─────────────────────────────────────────────────── */
  function _copy() {
    var link = _buildURL(_getName());
    var btn  = document.getElementById('dz-share-copy-btn');
    function done() {
      if (btn) {
        btn.innerHTML = '&#10003; Copied!';
        setTimeout(function () { btn.innerHTML = '&#128279; Copy Link'; }, 2000);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(function () { _fbCopy(link); done(); });
    } else { _fbCopy(link); done(); }
  }

  /* ── Clipboard textarea fallback ───────────────────────────────── */
  function _fbCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
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
          '<div class="dz-beat-title" id="dz-beat-title"></div>' +
          '<div class="dz-beat-detail" id="dz-beat-detail"></div>' +
          '<div class="dz-beat-btns">' +
            '<button class="dz-beat-share-btn" onclick="DZShare.openModal();' +
              'document.getElementById(\'dz-beat-popup\').classList.remove(\'active\')">' +
              'Send them your scorecard!</button>' +
            '<button class="dz-beat-close-btn" ' +
              'onclick="document.getElementById(\'dz-beat-popup\').classList.remove(\'active\')">' +
              'Skip</button>' +
          '</div></div>';
      document.body.appendChild(pop);
    }

    /* Build title — personalised per game */
    var chName = _safe(_ch.name, 20);
    var myDetail = _r.detail ? _safe(_r.detail, 50) : '';
    var chScore  = _ch.score;
    var myScore  = _r.score;

    var title, detail;

    /* Score comparison text */
    var lowerBetter = ['chess', 'minesweeper', 'sudoku'];
    var scoreMsg = '';
    if (myScore > 0 && chScore > 0) {
      if (lowerBetter.indexOf(_r.slug) !== -1) {
        scoreMsg = 'You did it in ' + myScore + ', they needed ' + chScore + '!';
      } else {
        scoreMsg = 'Your score: ' + myScore + '  |  ' + chName + '\'s score: ' + chScore;
      }
    }

    title = 'You beat ' + chName + '\'s challenge!';
    detail = (myDetail || scoreMsg) +
             (myDetail && scoreMsg ? '\n' + scoreMsg : '');

    var t = document.getElementById('dz-beat-title');
    var d = document.getElementById('dz-beat-detail');
    if (t) t.textContent = title;
    if (d) d.textContent = detail;
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

    /* Wait for the game to actually be on screen before showing the banner.
       We poll until screen-hub is hidden (meaning a game is showing),
       then add the 'active' class. Max wait: 5 s. */
    var _bannerTries = 0;
    function _tryShowBanner() {
      _bannerTries++;
      var hub = document.getElementById('screen-hub');
      var hubHidden = hub && (hub.classList.contains('hidden') ||
                              hub.style.display === 'none');
      if (hubHidden || _bannerTries > 25) {
        setTimeout(function () { banner.classList.add('active'); }, 600);
      } else {
        setTimeout(_tryShowBanner, 200);
      }
    }
    setTimeout(_tryShowBanner, 400);
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

    /* Hide the Save Image button if it still exists in the DOM
       (some users may have an old cached version of index.html) */
    var saveBtn = document.getElementById('dz-share-save-btn');
    if (saveBtn) saveBtn.style.display = 'none';
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
    _copy:        _copy
  };

})(window);
