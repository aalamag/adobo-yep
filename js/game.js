import { RULES } from './data.js';
import { loadConfig, loadGame, saveGame, clearGame, openChannel, esc } from './store.js';
import { sfx } from './audio.js';

const IS_BOARD = new URLSearchParams(location.search).get('view') === 'board';
const app = document.getElementById('app');

let S = null;            // the whole game state (host owns it; board mirrors it)
let history = [];        // undo stack (host only)
let lastFx = 0;          // last effect this window has played
let boardSeenAt = 0;     // last ping from an audience screen
let timerHandle = null;
let lastScreenKey = '';    // entrance animation only plays when the screen changes

const MULT_NAME = { 1: 'Normal na', 2: 'Dobleng', 3: 'Tripleng' };
const other = (t) => 1 - t;
const roundOf = () => S.rounds[S.ri];
const fmPoints = (qi, e) => (e && e.m >= 0 ? S.fmQs[qi].answers[e.m].p : 0);

// ---------------------------------------------------------------- state

function resolveConfig(cfg) {
  const byId = Object.fromEntries(cfg.bank.map((q) => [q.id, q]));
  const toQ = (q) => ({ q: q.q, answers: q.answers.map(([t, p]) => ({ t, p: Number(p) || 0 })) });
  const rounds = cfg.rounds.filter((r) => byId[r.qid]).map((r) => ({ ...toQ(byId[r.qid]), mult: Number(r.mult) || 1, label: r.label || `${MULT_NAME[r.mult] || ''} Puntos` }));
  const fmQs = cfg.fastMoney.enabled === false ? [] : cfg.fastMoney.qids.filter((id) => byId[id]).map((id) => toQ(byId[id]));
  return { rounds, fmQs };
}

function newGame() {
  const cfg = loadConfig();
  const { rounds, fmQs } = resolveConfig(cfg);
  return {
    v: cfg.version,
    screen: 'title',
    meta: { title: cfg.title, subtitle: cfg.subtitle, season: cfg.season },
    teams: cfg.teams.map((name) => ({ name, players: ['', '', '', '', ''], score: 0 })),
    rounds, fmQs, fmCfg: cfg.fastMoney,
    ri: 0, round: null, fm: null,
    fx: null, fxId: 0,
  };
}

function fx(k, extra = {}) { S.fx = { k, id: ++S.fxId, ...extra }; }

function startRound(ri) {
  S.ri = ri;
  S.round = { revealed: roundOf().answers.map(() => false), strikes: 0, control: null, phase: 'faceoff', bank: 0, awarded: null, won: 0 };
  S.screen = 'intro';
  fx('whoosh');
}

function award(team) {
  const r = S.round;
  const won = r.bank * roundOf().mult;
  S.teams[team].score += won;
  r.awarded = team; r.won = won; r.phase = 'done';
  fx('award', { team });
}

function leader() { return S.teams[1].score > S.teams[0].score ? 1 : 0; }

function startFastMoney(team) {
  const blank = () => S.fmQs.map(() => ({ text: '', m: -1 }));
  S.fm = {
    team, players: ['', ''], cur: 0, stage: 'answer',
    time: S.fmCfg.timers[0], running: false,
    entries: [blank(), blank()],
    shown: [S.fmQs.map(() => 0), S.fmQs.map(() => 0)], // 0 hidden · 1 answer · 2 answer+points
    applied: false,
  };
}

function fmTotal() {
  if (!S.fm) return 0;
  let t = 0;
  S.fm.entries.forEach((col, p) => col.forEach((e, qi) => { if (S.fm.shown[p][qi] >= 2) t += fmPoints(qi, e); }));
  return t;
}

// ---------------------------------------------------------------- commit / sync

const channel = openChannel((msg) => {
  if (IS_BOARD) {
    if (msg.t === 'state') { S = msg.S; render(); }
  } else {
    if (msg.t === 'hello' || msg.t === 'ping') {
      const wasAlive = boardAlive();
      boardSeenAt = Date.now();
      if (msg.t === 'hello') channel.post({ t: 'state', S });
      if (!wasAlive) renderHostBar();
    }
  }
});

const boardAlive = () => Date.now() - boardSeenAt < 5000;

function commit(mutate, { undoable = true, rerender = true } = {}) {
  if (undoable) { history.push(JSON.stringify(S)); if (history.length > 150) history.shift(); }
  mutate();
  saveGame(S);
  channel.post({ t: 'state', S });
  if (rerender) render();
}

function undo() {
  if (!history.length) return;
  stopTimer();
  S = JSON.parse(history.pop());
  S.fx = null;
  if (S.fm) S.fm.running = false;
  saveGame(S); channel.post({ t: 'state', S }); render();
}

// ---------------------------------------------------------------- Fast Money timer

function stopTimer() { clearInterval(timerHandle); timerHandle = null; }

function startTimer() {
  stopTimer();
  timerHandle = setInterval(() => {
    const f = S.fm;
    if (!f || !f.running) return stopTimer();
    commit(() => {
      f.time = Math.max(0, f.time - 1);
      if (f.time === 0) { f.running = false; fx('buzz'); } else if (f.time <= 5) fx('tick');
    }, { undoable: false, rerender: false });
    playFx();
    const el = document.getElementById('fm-timer');
    if (el) { el.textContent = f.time; el.classList.toggle('low', f.time <= 5); }
    if (!f.running) { stopTimer(); renderControls(); }
  }, 1000);
}

// ---------------------------------------------------------------- actions (host)

const A = {
  next() {
    const s = S.screen;
    commit(() => {
      if (s === 'title') S.screen = 'teams';
      else if (s === 'teams') S.screen = 'rules';
      else if (s === 'rules') startRound(0);
      else if (s === 'intro') { S.screen = 'board'; fx('whoosh'); }
      else if (s === 'board') {
        if (S.ri < S.rounds.length - 1) startRound(S.ri + 1);
        else if (S.fmQs.length) { S.screen = 'mid'; fx('fanfare'); }
        else S.screen = 'final';
      }
      else if (s === 'mid') { S.screen = S.fmQs.length ? 'fmIntro' : 'final'; S.fmTeamPick = leader(); }
      else if (s === 'fmIntro') { startFastMoney(S.fmTeamPick ?? leader()); S.fm.players = S.fmPlayersPick || ['', '']; S.screen = 'fm'; fx('whoosh'); }
      else if (s === 'fm') {
        if (!S.fm.applied && S.fmCfg.countsToScore) {
          const tot = fmTotal();
          S.teams[S.fm.team].score += tot + (tot >= S.fmCfg.target ? Number(S.fmCfg.bonus) || 0 : 0);
          S.fm.applied = true;
        }
        S.screen = 'final';
      }
      else if (s === 'final') { S.screen = 'champion'; fx('fanfare'); }
    });
  },

  reveal({ i }) {
    i = Number(i);
    const r = S.round;
    if (S.screen !== 'board' || !r || r.revealed[i] || i >= r.revealed.length) return;
    commit(() => {
      r.revealed[i] = true;
      fx('ding', { i });
      if (r.phase === 'done') { (r.late = r.late || []).push(i); return; }  // leftovers — no points
      r.bank += roundOf().answers[i].p;
      if (r.phase === 'steal') award(other(r.control));
      else if (r.phase === 'play' && r.revealed.every(Boolean)) award(r.control);
    });
  },

  strike() {
    const r = S.round;
    if (S.screen !== 'board' || !r || r.phase === 'done') return;
    commit(() => {
      if (r.phase === 'faceoff') return fx('strike', { n: 1 });
      if (r.phase === 'steal') { fx('strike', { n: 1 }); return award(r.control); }
      r.strikes = Math.min(3, r.strikes + 1);
      fx('strike', { n: r.strikes });
      if (r.strikes === 3) r.phase = 'steal';
    });
  },

  control({ team }) { commit(() => { S.round.control = Number(team); S.round.phase = 'play'; fx('whoosh'); }); },
  stealFail() { commit(() => { fx('strike', { n: 1 }); award(S.round.control); }); },
  awardTo({ team }) { commit(() => award(Number(team))); },
  revealRest() {
    commit(() => {
      const r = S.round;
      r.late = (r.late || []).concat(r.revealed.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0));
      r.revealed = r.revealed.map(() => true); fx('ding');
    });
  },
  adjust({ team, d }) { commit(() => { S.teams[team].score = Math.max(0, S.teams[team].score + Number(d)); }); },

  fmTeam({ team }) { commit(() => { S.fmTeamPick = Number(team); }); },
  fmTimer({ op }) {
    const f = S.fm;
    commit(() => {
      if (op === 'start') { if (f.time === 0) f.time = S.fmCfg.timers[f.cur]; f.running = true; }
      if (op === 'pause') f.running = false;
      if (op === 'reset') { f.running = false; f.time = S.fmCfg.timers[f.cur]; }
      if (op === 'plus') f.time += 5;
    }, { undoable: false });
    f.running ? startTimer() : stopTimer();
  },
  fmToReveal() { stopTimer(); commit(() => { S.fm.running = false; S.fm.stage = 'reveal'; }); },
  fmStep({ q }) {
    const f = S.fm, p = f.cur, qi = Number(q);
    if (f.shown[p][qi] >= 2) return;
    commit(() => {
      f.shown[p][qi] += 1;
      if (f.shown[p][qi] === 2) fmPoints(qi, f.entries[p][qi]) > 0 ? fx('ding') : fx('strike', { n: 1 });
      else fx('whoosh');
      if (f.shown[p].every((v) => v === 2) && fmTotal() >= S.fmCfg.target) fx('fanfare');
    });
  },
  fmRevealAll() {
    const f = S.fm;
    commit(() => { f.shown[f.cur] = f.shown[f.cur].map(() => 2); fx(fmTotal() >= S.fmCfg.target ? 'fanfare' : 'ding'); });
  },
  fmNextPlayer() {
    commit(() => { const f = S.fm; f.cur = 1; f.stage = 'answer'; f.running = false; f.time = S.fmCfg.timers[1]; fx('whoosh'); });
  },
  fmFinish() { commit(() => { S.fm.stage = 'done'; }); },

  newGame() {
    if (S.screen !== 'title' && !confirm('Magsimula ng bagong laro? Mabubura ang kasalukuyang puntos.')) return;
    stopTimer(); history = []; clearGame();
    S = newGame(); saveGame(S); channel.post({ t: 'state', S }); render();
  },
  undo,
  openBoard() { window.open('?view=board', 'adobo-feud-board', 'width=1280,height=720'); },
  mute() { sfx.setMuted(!sfx.isMuted()); renderHostBar(); },
  fullscreen() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); },
  enableSound() { sfx.unlock(); document.body.classList.add('sound-on'); },
};

// Typing in inputs updates state without re-rendering (keeps focus).
function onInput(el) {
  const { field, team, idx, q } = el.dataset;
  commit(() => {
    if (field === 'teamName') S.teams[team].name = el.value;
    if (field === 'player') S.teams[team].players[idx] = el.value;
    if (field === 'fmPlayer') { S.fmPlayersPick = S.fmPlayersPick || ['', '']; S.fmPlayersPick[idx] = el.value; }
    if (field === 'fmText') S.fm.entries[S.fm.cur][q].text = el.value;
    if (field === 'fmMatch') S.fm.entries[S.fm.cur][q].m = Number(el.value);
  }, { undoable: false, rerender: false });
  if (field === 'fmMatch') {
    const e = S.fm.entries[S.fm.cur][q];
    const pts = document.querySelector(`[data-pts="${q}"]`);
    if (pts) pts.textContent = e.m === -2 ? 'dup' : fmPoints(Number(q), e);
    const dupWarn = document.querySelector(`[data-dupwarn="${q}"]`);
    if (dupWarn) dupWarn.hidden = !(S.fm.cur === 1 && e.m >= 0 && S.fm.entries[0][q].m === e.m);
  }
}

// ---------------------------------------------------------------- rendering helpers

const petalSvg = (fill = '#C8414B', stroke = '#9E2A35') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 8.7l7.1-.6z" fill="${fill}" stroke="${stroke}" stroke-width="0.9" stroke-linejoin="round"/></svg>`;

const footer = () => `<div class="st-footer">${esc(S.meta.season)} · ${esc(S.meta.subtitle)}</div>`;

function teamPanel(t, { compact = false } = {}) {
  const team = S.teams[t];
  const r = S.round;
  const ctl = S.screen === 'board' && r && (r.phase === 'play' && r.control === t || r.phase === 'steal' && other(r.control) === t);
  return `<div class="team-panel team-${t} ${ctl ? 'in-control' : ''} ${compact ? 'compact' : ''}">
    <div class="tp-name">${esc(team.name)}</div>
    <div class="tp-score">${team.score}</div>
    ${ctl ? `<div class="tp-flag">${r.phase === 'steal' ? 'AGAWAN' : 'MAY KONTROL'}</div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- stage screens

function stageTitle() {
  return `<div class="screen center title-screen">
    <div class="kicker">Maligayang pagdating sa</div>
    <h1 class="display">${esc(S.meta.title)}</h1>
    <div class="display-sub">${esc(S.meta.subtitle)}</div>
    <div class="feud-mark">Family Feud</div>
    <p class="lede">Labanan ng dalawang team sa survey · Maligayang Pasko!</p>
    <div class="vs-line"><span class="chip team-0">Team ${esc(S.teams[0].name)}</span><span class="vs">vs</span><span class="chip team-1">Team ${esc(S.teams[1].name)}</span></div>
    <div class="pills"><span>${S.rounds.length} na round</span><span>may agawan</span><span>tripleng puntos</span>${S.fmQs.length ? '<span>Fast Money</span>' : '<span>pinakamataas, panalo</span>'}</div>
    ${footer()}
  </div>`;
}

function stageTeams() {
  const col = (t) => `<div class="team-card team-${t}">
    <div class="tc-head">Team ${esc(S.teams[t].name)}</div>
    <ol>${S.teams[t].players.map((p, i) => `<li>${esc(p) || `Manlalaro ${i + 1}`}</li>`).join('')}</ol>
  </div>`;
  return `<div class="screen">
    <div class="eyebrow">Kilalanin ang mga team</div><h2 class="h2">Ang Maglalaban</h2>
    <div class="team-cards">${col(0)}<div class="vs big">VS</div>${col(1)}</div>
    <div class="banner-soft">Susunod: Round 1</div>${footer()}
  </div>`;
}

function stageRules() {
  return `<div class="screen">
    <div class="eyebrow">Mga patakaran</div><h2 class="h2">Paano Maglaro</h2>
    <ol class="rules">${RULES.filter((r) => S.fmQs.length || !r.includes('Fast Money')).map((r, i) => `<li><span class="rn">${i + 1}</span>${esc(r)}</li>`).join('')}</ol>
    ${footer()}
  </div>`;
}

function stageIntro() {
  const rd = roundOf();
  return `<div class="screen center">
    <div class="round-num">${S.ri === S.rounds.length - 1 && !S.fmQs.length ? 'Huling Round' : `Round ${S.ri + 1}`}</div>
    <div class="mult-badge m${rd.mult}">${esc(rd.label)}${rd.mult > 1 ? ` · ×${rd.mult}` : ''}</div>
    <div class="survey-says">Sabi ng survey…</div>
    <div class="q-card">${esc(rd.q)}</div>
    <div class="faceoff"><b>Face-off</b> · Ang may mas mataas na sagot sa board ang may kontrol.</div>
    ${footer()}
  </div>`;
}

function stageBoard(fresh) {
  const rd = roundOf(), r = S.round;
  const n = rd.answers.length;
  const slots = Math.max(8, n + (n % 2));
  const half = slots / 2;
  const tile = (i) => {
    if (i >= n) return `<div class="tile empty"></div>`;
    const a = rd.answers[i];
    const anim = fresh && S.fx.k === 'ding' && S.fx.i === i ? ' flip' : '';
    const open = r.revealed[i] ? ' open' : '';
    const late = r.late && r.late.includes(i) ? ' late' : '';
    return `<button class="tile${open}${late}${anim}" ${IS_BOARD ? 'tabindex="-1"' : `data-action="reveal" data-i="${i}"`} aria-label="Answer ${i + 1}">
      <span class="tile-inner">
        <span class="tile-front"><span class="tile-num">${i + 1}</span></span>
        <span class="tile-back"><span class="tile-ans">${esc(a.t)}</span><span class="tile-pts">${a.p}</span></span>
      </span></button>`;
  };
  const order = []; for (let k = 0; k < half; k++) order.push(k, k + half); // column-major like the show
  let banner = '';
  if (r.phase === 'faceoff') banner = `<div class="phase faceoff-b">Face-off!</div>`;
  if (r.phase === 'steal') banner = `<div class="phase steal-b">${esc(S.teams[other(r.control)].name)}, agaw!</div>`;
  if (r.phase === 'done' && r.awarded !== null) banner = `<div class="phase done-b">+${r.won} para sa ${esc(S.teams[r.awarded].name)}</div>`;
  const strikes = [0, 1, 2].map((k) => `<span class="strike ${k < r.strikes ? 'on' : ''}">✕</span>`).join('');
  return `<div class="screen board-screen">
    <div class="board-top">
      ${teamPanel(0)}
      <div class="board-center">
        <div class="round-tag">Round ${S.ri + 1} · ${esc(rd.label)}</div>
        <div class="board-q">${esc(rd.q)}</div>
        <div class="bank"><span class="bank-num">${r.bank}</span>${rd.mult > 1 ? `<span class="bank-mult">×${rd.mult}</span>` : ''}<span class="bank-lbl">puntos ng round</span></div>
      </div>
      ${teamPanel(1)}
    </div>
    <div class="tiles">${order.map(tile).join('')}</div>
    <div class="board-bottom"><div class="strikes">${strikes}</div>${banner}</div>
  </div>`;
}

function stageScores(kind) {
  const mid = kind === 'mid';
  return `<div class="screen center">
    <div class="eyebrow">${mid ? 'Kalagitnaan ng laro' : 'Ang huling bilang'}</div>
    <h2 class="h2">${mid ? 'Kabuuang Puntos' : 'Huling Puntos'}</h2>
    <div class="big-scores">
      <div class="big-score team-0"><div class="bs-name">Team ${esc(S.teams[0].name)}</div><div class="bs-num">${S.teams[0].score}</div><div class="bs-lbl">${mid ? 'Kabuuang' : 'Huling'} puntos</div></div>
      <div class="big-score team-1"><div class="bs-name">Team ${esc(S.teams[1].name)}</div><div class="bs-num">${S.teams[1].score}</div><div class="bs-lbl">${mid ? 'Kabuuang' : 'Huling'} puntos</div></div>
    </div>
    <div class="banner-soft">${mid ? 'Susunod: Fast Money' : 'At ang kampeon ay…'}</div>
    ${footer()}
  </div>`;
}

function stageFmIntro() {
  const c = S.fmCfg;
  return `<div class="screen center">
    <div class="eyebrow">Huling hamon</div>
    <h1 class="display fm-title">Fast Money</h1>
    <p class="lede">${c.players === 2 ? 'Dalawang manlalaro' : 'Isang manlalaro'} ang kakatawan sa team. ${S.fmQs.length} na mabilisang tanong.</p>
    <div class="fm-facts">
      <div><b>${S.fmQs.length}</b><span>tanong</span></div>
      <div><b>${c.timers.slice(0, c.players).join(' / ')}s</b><span>na oras</span></div>
      <div class="target"><b>${c.target}</b><span>target</span></div>
    </div>
    <div class="banner-soft">Maglalaro: Team ${esc(S.teams[S.fmTeamPick ?? leader()].name)}</div>
    ${footer()}
  </div>`;
}

function stageFm() {
  const f = S.fm, c = S.fmCfg;
  const total = fmTotal();
  const cell = (p, qi) => {
    const e = f.entries[p][qi], sh = f.shown[p][qi];
    const coverP1 = p === 0 && f.cur === 1 && f.stage === 'answer';
    if (coverP1 || sh === 0) return `<div class="fm-cell"><span class="fm-ans blank"></span><span class="fm-pts blank"></span></div>`;
    const label = e.text || (e.m >= 0 ? S.fmQs[qi].answers[e.m].t : '—');
    const pts = fmPoints(qi, e);
    return `<div class="fm-cell ${sh === 2 && pts === 0 ? 'zero' : ''}"><span class="fm-ans">${esc(label)}</span><span class="fm-pts ${sh < 2 ? 'blank' : ''}">${sh === 2 ? pts : ''}</span></div>`;
  };
  const showP2 = c.players === 2;
  const pct = Math.min(100, Math.round((total / c.target) * 100));
  return `<div class="screen fm-screen">
    <div class="fm-head">
      <div><div class="eyebrow">Fast Money · Team ${esc(S.teams[f.team].name)}</div>
      <div class="fm-player">${f.stage === 'done' ? 'Kabuuan' : `Manlalaro ${f.cur + 1}${f.players[f.cur] ? ` — ${esc(f.players[f.cur])}` : ''}`}</div></div>
      ${total >= c.target ? `<div class="phase done-b fm-win">Naabot ang target!</div>` : ''}
      <div id="fm-timer" class="fm-timer ${f.time <= 5 ? 'low' : ''} ${f.running ? 'running' : ''}">${f.time}</div>
    </div>
    <div class="fm-grid ${showP2 ? 'two' : ''}">
      ${S.fmQs.map((q, qi) => `<div class="fm-row"><div class="fm-q"><span>Q${qi + 1}</span>${esc(q.q.replace(/^(Name (an?|the)|Magbigay ng) /i, ''))}</div>${cell(0, qi)}${showP2 ? cell(1, qi) : ''}</div>`).join('')}
    </div>
    <div class="fm-total">
      <div class="fm-bar"><div style="width:${pct}%"></div></div>
      <div class="fm-total-num ${total >= c.target ? 'hit' : ''}">${total}<span> / ${c.target}</span></div>
    </div>
  </div>`;
}

function stageChampion() {
  const [a, b] = S.teams;
  const tie = a.score === b.score;
  const w = a.score > b.score ? 0 : 1;
  const colors = ['#C8414B', '#D9A441', '#2F6497', '#F7FAFD', '#2F7A5B'];
  const confetti = Array.from({ length: 70 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;background:${colors[i % 5]};animation-delay:${((i * 0.13) % 3).toFixed(2)}s;animation-duration:${(3 + (i % 5) * 0.6).toFixed(1)}s"></i>`).join('');
  return `<div class="screen center champion">
    <div class="confetti">${confetti}</div>
    <div class="eyebrow">${tie ? 'Ang galing ng laban!' : 'Ang mga kampeon ng Paskong Feud'}</div>
    <h1 class="display champ-name ${tie ? '' : `team-${w}-text`}">${tie ? 'Tabla!' : `Team ${esc(S.teams[w].name)}`}</h1>
    <div class="champ-score">${tie ? `${a.score} – ${b.score}` : `${S.teams[w].score} puntos`}</div>
    <div class="champ-runner">${tie ? 'Sudden-death face-off na ba?' : `${esc(S.teams[other(w)].name)}: ${S.teams[other(w)].score}`}</div>
    <div class="star-row">${petalSvg()}${petalSvg('#D9A441', '#B8862E')}${petalSvg('#2F6497', '#1C3350')}${petalSvg('#D9A441', '#B8862E')}${petalSvg()}</div>
    ${footer()}
  </div>`;
}

function stageHTML(fresh) {
  switch (S.screen) {
    case 'title': return stageTitle();
    case 'teams': return stageTeams();
    case 'rules': return stageRules();
    case 'intro': return stageIntro();
    case 'board': return stageBoard(fresh);
    case 'mid': return stageScores('mid');
    case 'fmIntro': return stageFmIntro();
    case 'fm': return stageFm();
    case 'final': return stageScores('final');
    case 'champion': return stageChampion();
  }
  return '';
}

function strikeOverlay(fresh) {
  if (!fresh || S.fx.k !== 'strike') return '';
  return `<div class="strike-overlay">${Array.from({ length: S.fx.n || 1 }, () => '<span>✕</span>').join('')}</div>`;
}

// ---------------------------------------------------------------- host controls

const btn = (label, action, data = {}, cls = '') =>
  `<button class="btn ${cls}" data-action="${action}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${label}</button>`;
const primary = (label) => btn(label, 'next', {}, 'primary');

function controlsHTML() {
  const s = S.screen;
  if (s === 'title') return `<div class="ctl-row">${primary('Simulan ang palabas →')}<span class="hint">Tip: buksan muna ang <b>Audience screen</b> sa projector.</span></div>`;
  if (s === 'teams') {
    const team = (t) => `<fieldset class="ctl-team team-${t}"><legend>Team ${t + 1}</legend>
      <input data-field="teamName" data-team="${t}" value="${esc(S.teams[t].name)}" aria-label="Team ${t + 1} name" class="team-name-in">
      ${S.teams[t].players.map((p, i) => `<input data-field="player" data-team="${t}" data-idx="${i}" value="${esc(p)}" placeholder="Player ${i + 1}">`).join('')}
    </fieldset>`;
    return `<div class="ctl-teams">${team(0)}${team(1)}</div><div class="ctl-row">${primary('Susunod: Patakaran →')}</div>`;
  }
  if (s === 'rules') return `<div class="ctl-row">${primary('Susunod: Round 1 →')}</div>`;
  if (s === 'intro') return `<div class="ctl-row">${primary('Ipakita ang board →')}<span class="hint">Basahin nang malakas ang tanong, tapos tawagin ang dalawang manlalaro para sa face-off.</span></div>${answerKey(true)}`;
  if (s === 'board') return boardControls();
  if (s === 'mid') return `<div class="ctl-row">${primary('Susunod: Fast Money →')}</div>${scoreFix()}`;
  if (s === 'fmIntro') {
    const pick = S.fmTeamPick ?? leader();
    const pp = S.fmPlayersPick || ['', ''];
    const opts = S.teams[pick].players.filter(Boolean);
    return `<div class="ctl-row"><span class="ctl-lbl">Which team plays?</span>
      ${[0, 1].map((t) => btn(`${esc(S.teams[t].name)} (${S.teams[t].score})`, 'fmTeam', { team: t }, t === pick ? `sel team-${t}` : '')).join('')}</div>
      <div class="ctl-row">${[0, 1].slice(0, S.fmCfg.players).map((i) => `<label class="ctl-lbl">Player ${i + 1}
        <input data-field="fmPlayer" data-idx="${i}" value="${esc(pp[i])}" list="pl-list" placeholder="name"></label>`).join('')}
        <datalist id="pl-list">${opts.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>
        ${primary('Start Fast Money →')}</div>`;
  }
  if (s === 'fm') return fmControls();
  if (s === 'final') return `<div class="ctl-row">${primary('Ipakita ang kampeon →')}<span class="hint">I-check muna ang puntos ng dalawang team.</span></div>${scoreFix()}`;
  if (s === 'champion') return `<div class="ctl-row">${btn('Bagong laro', 'newGame', {}, 'primary')}</div>`;
  return '';
}

function answerKey(readOnly) {
  const rd = roundOf(), r = S.round;
  return `<div class="key"><div class="key-h">Sagot (host lang)${readOnly ? '' : ' · i-click para ipakita · keys 1–8'}</div>
    <div class="key-grid">${rd.answers.map((a, i) => readOnly
      ? `<div class="key-item"><b>${i + 1}</b> ${esc(a.t)} <em>${a.p}</em></div>`
      : `<button class="key-item ${r.revealed[i] ? 'done' : ''}" data-action="reveal" data-i="${i}"><b>${i + 1}</b> ${esc(a.t)} <em>${a.p}</em></button>`).join('')}</div></div>`;
}

function scoreFix() {
  return `<details class="fix"><summary>Ayusin ang puntos</summary><div class="ctl-row">
    ${[0, 1].map((t) => `<span class="ctl-lbl">${esc(S.teams[t].name)}</span>${btn('−10', 'adjust', { team: t, d: -10 })}${btn('−1', 'adjust', { team: t, d: -1 })}${btn('+1', 'adjust', { team: t, d: 1 })}${btn('+10', 'adjust', { team: t, d: 10 })}`).join('<span class="sep"></span>')}
  </div></details>`;
}

function boardControls() {
  const r = S.round, last = S.ri === S.rounds.length - 1;
  const ctl = r.control, stealer = ctl === null ? null : other(ctl);
  let row = '';
  if (r.phase === 'faceoff') row = `<span class="ctl-lbl">Face-off:</span>${btn('✕ Mali (buzz)', 'strike', {}, 'danger')}
    <span class="sep"></span><span class="ctl-lbl">Team na maglalaro (PLAY):</span>
    ${btn(`${esc(S.teams[0].name)} ang maglalaro`, 'control', { team: 0 }, 'team-0')}${btn(`${esc(S.teams[1].name)} ang maglalaro`, 'control', { team: 1 }, 'team-1')}
    <span class="hint">Kasama sa puntos ng round ang mga sagot na ipapakita sa face-off.</span>`;
  if (r.phase === 'play') row = `<span class="ctl-lbl">${esc(S.teams[ctl].name)} ang may kontrol · strike ${r.strikes}/3</span>${btn('✕ Strike', 'strike', {}, 'danger')}
    <span class="hint">Ipakita ang tamang sagot dito o sa board. Lahat nakita = panalo sa round.</span>`;
  if (r.phase === 'steal') row = `<span class="ctl-lbl">${esc(S.teams[stealer].name)} puwedeng mang-AGAW, isang hula lang.</span>
    <span class="hint">Tama? I-click ang sagot.</span>${btn('✕ Bigo ang agaw', 'stealFail', {}, 'danger')}`;
  if (r.phase === 'done') row = `<span class="ctl-lbl">+${r.won} para sa ${esc(S.teams[r.awarded].name)}</span>
    ${r.revealed.every(Boolean) ? '' : btn('Ipakita ang natitira', 'revealRest')}
    ${primary(last ? (S.fmQs.length ? 'Susunod: Scoreboard →' : 'Susunod: Huling puntos →') : `Susunod: Round ${S.ri + 2} →`)}`;
  return `<div class="ctl-row">${row}</div>${answerKey(false)}${scoreFix()}`;
}

function fmControls() {
  const f = S.fm, c = S.fmCfg, p = f.cur;
  if (f.stage === 'answer') {
    const rows = S.fmQs.map((q, qi) => {
      const e = f.entries[p][qi];
      const opts = [`<option value="-1">No match (0)</option>`]
        .concat(p === 1 ? [`<option value="-2" ${e.m === -2 ? 'selected' : ''}>Duplicate / pass (0)</option>`] : [])
        .concat(q.answers.map((a, i) => `<option value="${i}" ${e.m === i ? 'selected' : ''}>${esc(a.t)} — ${a.p}</option>`));
      const p1 = p === 1 ? f.entries[0][qi] : null;
      const dup = p1 && e.m >= 0 && p1.m === e.m;
      return `<div class="fm-in-row"><div class="fm-in-q"><b>Q${qi + 1}</b> ${esc(q.q)}${p1 ? `<span class="p1said">P1: ${esc(p1.text || (p1.m >= 0 ? q.answers[p1.m].t : '—'))}</span>` : ''}</div>
        <input data-field="fmText" data-q="${qi}" value="${esc(e.text)}" placeholder="What they said">
        <select data-field="fmMatch" data-q="${qi}">${opts.join('')}</select>
        <span class="fm-in-pts" data-pts="${qi}">${e.m === -2 ? 'dup' : fmPoints(qi, e)}</span>
        <span class="warn" data-dupwarn="${qi}" ${dup ? '' : 'hidden'}>Same as Player 1 — buzz &amp; ask again</span></div>`;
    }).join('');
    return `<div class="ctl-row"><span class="ctl-lbl">Player ${p + 1} clock</span>
      ${f.running ? btn('❚❚ Pause', 'fmTimer', { op: 'pause' }) : btn('▶ Start', 'fmTimer', { op: 'start' }, 'primary-lite')}
      ${btn('+5s', 'fmTimer', { op: 'plus' })}${btn('Reset', 'fmTimer', { op: 'reset' })}
      <span class="sep"></span>${btn('Done — reveal answers →', 'fmToReveal', {}, 'primary')}</div>
      <div class="fm-in">${rows}</div>`;
  }
  if (f.stage === 'reveal') {
    const allShown = f.shown[p].every((v) => v === 2);
    const steps = S.fmQs.map((q, qi) => {
      const sh = f.shown[p][qi];
      return btn(`Q${qi + 1}: ${sh === 0 ? 'show answer' : sh === 1 ? 'show points' : '✓'}`, 'fmStep', { q: qi }, sh === 2 ? 'done' : '');
    }).join('');
    const after = !allShown ? btn('Reveal all', 'fmRevealAll')
      : p === 0 && c.players === 2 ? btn('Player 2 →', 'fmNextPlayer', {}, 'primary') : btn('Finish Fast Money →', 'fmFinish', {}, 'primary');
    return `<div class="ctl-row"><span class="ctl-lbl">Reveal Player ${p + 1}</span>${steps}<span class="sep"></span>${after}</div>`;
  }
  const tot = fmTotal();
  const add = c.countsToScore ? tot + (tot >= c.target ? Number(c.bonus) || 0 : 0) : 0;
  return `<div class="ctl-row"><span class="ctl-lbl">Fast Money total ${tot}${tot >= c.target ? ' — target reached!' : ''}</span>
    ${primary(c.countsToScore ? `Add ${add} to ${esc(S.teams[f.team].name)} & show final scores →` : 'Show final scores →')}</div>`;
}

// ---------------------------------------------------------------- render

const SCREEN_NAMES = { title: 'Simula', teams: 'Mga team', rules: 'Patakaran', intro: 'Intro ng round', board: 'Board', mid: 'Scoreboard', fmIntro: 'Fast Money', fm: 'Fast Money', final: 'Huling puntos', champion: 'Kampeon' };

function hostBarHTML() {
  const where = S.screen === 'intro' || S.screen === 'board' ? ` · Round ${S.ri + 1}/${S.rounds.length}` : '';
  return `<div class="brand">${petalSvg()}<span>${esc(S.meta.title)} <em>Family Feud</em></span></div>
    <div class="where">${SCREEN_NAMES[S.screen]}${where}</div>
    <div class="bar-actions">
      ${btn(boardAlive() ? '● Audience screen on' : '▣ Audience screen', 'openBoard', {}, boardAlive() ? 'live' : '')}
      ${btn('↶ Bawiin', 'undo', {}, history.length ? '' : 'dim')}
      ${btn(sfx.isMuted() ? '🔇 Naka-mute' : '🔊 Tunog', 'mute')}
      ${btn('Bagong laro', 'newGame')}
      <a class="btn" href="admin.html">Admin</a>
    </div>`;
}

function renderHostBar() { const bar = document.getElementById('hostbar'); if (bar) bar.innerHTML = hostBarHTML(); }
function renderControls() { const c = document.getElementById('controls'); if (c) c.innerHTML = controlsHTML(); }

function soundHere() { return IS_BOARD || !boardAlive(); }

function playFx() {
  if (!S.fx || S.fx.id === lastFx) return false;
  lastFx = S.fx.id;
  if (soundHere()) {
    const k = S.fx.k;
    if (k === 'strike') sfx.buzz(); else if (sfx[k]) sfx[k]();
  }
  return true;
}

function render() {
  if (!S) return;
  const fresh = !!S.fx && S.fx.id !== lastFx;
  const key = `${S.screen}:${S.ri}:${S.fm ? S.fm.cur : ''}`;
  const enter = key !== lastScreenKey ? ' enter' : '';
  lastScreenKey = key;
  // The skeleton (incl. the animated scenery) is built once; only the content layer is redrawn.
  if (!document.getElementById('stage')) {
    const stage = `<div id="stage" class="stage">${sceneryHTML()}<div id="stage-content" class="stage-content"></div></div>`;
    app.innerHTML = IS_BOARD
      ? `<div class="board-view">${stage}</div>
         <button class="sound-gate" data-action="enableSound">I-click para buksan ang tunog at simulan ang audience screen</button>`
      : `<div class="host">
          <header id="hostbar" class="hostbar"></header>
          <div class="stage-wrap">${stage}</div>
          <section id="controls" class="controls"></section>
        </div>`;
  }
  document.getElementById('stage').className = `stage s-${S.screen}${enter}`;
  document.getElementById('stage-content').innerHTML = stageHTML(fresh) + strikeOverlay(fresh);
  renderHostBar();
  renderControls();
  playFx();
}

// ---------------------------------------------------------------- scenery (snowy Christmas backdrop)

function giftBox(i) {
  const [box, ribbon] = [['#2F6497', '#C8414B'], ['#C8414B', '#F7FAFD'], ['#2F7A5B', '#D9A441'], ['#F7FAFD', '#C8414B']][i];
  return `<span class="gift gift-${i}"><svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="9" width="18" height="13" rx="2" fill="${box}" stroke="#1C3350" stroke-width="1"/>
    <rect x="2" y="6.5" width="20" height="4" rx="1.4" fill="${box}" stroke="#1C3350" stroke-width="1"/>
    <rect x="10.6" y="6.5" width="2.8" height="15.5" fill="${ribbon}"/>
    <path d="M12 6.5 C 8 1 4.5 4 7.5 6.5 Z M12 6.5 C 16 1 19.5 4 16.5 6.5 Z" fill="${ribbon}" stroke="#1C3350" stroke-width=".8"/>
    <circle cx="9.2" cy="15.2" r="1" fill="#1C3350"/><circle cx="14.8" cy="15.2" r="1" fill="#1C3350"/>
    <path d="M10.6 17.4 q1.4 1.2 2.8 0" stroke="#1C3350" stroke-width=".9" fill="none" stroke-linecap="round"/>
  </svg></span>`;
}

// Filipino parol: a 5-point star lantern with tassels, hanging on a string.
function parol(i) {
  const [fill, edge] = i ? ['#F7FAFD', '#2F6497'] : ['#C8414B', '#D9A441'];
  return `<span class="parol parol-${i}"><svg viewBox="0 0 60 110" aria-hidden="true">
    <line x1="30" y1="0" x2="30" y2="26" stroke="#2D4E73" stroke-width="1.5"/>
    <path d="M30 24 l7.5 15.5 17 2.2-12.4 11.8 3.1 16.8L30 62.2 14.8 70.3l3.1-16.8L5.5 41.7l17-2.2z" fill="${fill}" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="30" cy="48" r="7" fill="${edge}" opacity=".9"/><circle cx="30" cy="48" r="3.2" fill="#FBEBC4"/>
    <path d="M18 70 q-2 18 -6 30 M42 70 q2 18 6 30 M30 62 q0 22 0 40" stroke="${edge}" stroke-width="1.6" fill="none" stroke-dasharray="3 2"/>
  </svg></span>`;
}

function lightsHTML() {
  const colors = ['#C8414B', '#D9A441', '#2F7A5B', '#7FA3C8', '#F7FAFD'];
  const bulbs = Array.from({ length: 22 }, (_, k) => {
    const x = 20 + k * 74, y = 26 + Math.sin((k / 21) * Math.PI * 4) * 12 + 6;
    return `<ellipse class="bulb" cx="${x}" cy="${y + 9}" rx="6" ry="9" fill="${colors[k % 5]}" stroke="#1C3350" stroke-width="1.2"/>`;
  }).join('');
  const wire = Array.from({ length: 23 }, (_, k) => `${k ? 'L' : 'M'}${k * 74 - 17} ${(26 + Math.sin(((k - .5) / 21) * Math.PI * 4) * 12).toFixed(1)}`).join(' ');
  return `<svg class="lights" viewBox="0 0 1600 100" preserveAspectRatio="none"><path d="${wire}"/>${bulbs}</svg>`;
}

function sceneryHTML() {
  const flakes = Array.from({ length: 40 }, (_, k) => {
    const size = (0.35 + ((k * 7) % 5) * 0.14).toFixed(2);
    return `<i style="left:${(k * 41) % 100}%;width:${size}cqw;height:${size}cqw;--dx:${((k * 13) % 9) - 4}cqw;animation-duration:${9 + (k % 7) * 1.6}s;animation-delay:-${((k * 1.37) % 14).toFixed(1)}s;opacity:${(0.55 + (k % 4) * 0.12).toFixed(2)}"></i>`;
  }).join('');
  const pine = (x, h, dark = false) => `<path class="pine${dark ? ' dark' : ''}" d="M${x} ${200 - h} l${h * 0.28} ${h * 0.42} h-${h * 0.1} l${h * 0.2} ${h * 0.32} h-${h * 0.1} l${h * 0.2} ${h * 0.3} h-${h * 1.0} l${h * 0.2} -${h * 0.3} h-${h * 0.1} l${h * 0.2} -${h * 0.32} h-${h * 0.1} z"/>`;
  return `<div class="scenery" aria-hidden="true">
    <div class="moon"></div>
    ${lightsHTML()}
    ${[0, 1].map(parol).join('')}
    <svg class="hills" viewBox="0 0 1600 320" preserveAspectRatio="none">
      <path class="hill-far" d="M0 170 C 180 100 360 125 520 150 S 860 80 1060 125 S 1400 150 1600 100 L1600 320 L0 320 Z"/>
      ${pine(250, 90)}${pine(320, 120, true)}${pine(390, 80)}${pine(1180, 110, true)}${pine(1260, 140)}${pine(1340, 95, true)}
      <path class="hill-mid" d="M0 220 C 220 170 420 205 640 205 S 1000 160 1240 180 S 1480 215 1600 195 L1600 320 L0 320 Z"/>
      <path class="hill-near" d="M0 275 C 260 245 520 270 800 262 S 1300 240 1600 268 L1600 320 L0 320 Z"/>
    </svg>
    <div class="flakes">${flakes}</div>
    <div class="gifts">${[0, 1, 2, 3].map(giftBox).join('')}</div>
    <div class="grain"></div>
  </div>`;
}

// ---------------------------------------------------------------- boot

document.addEventListener('click', (e) => {
  sfx.unlock();
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const name = el.dataset.action;
  if (IS_BOARD && !['enableSound', 'fullscreen'].includes(name)) return;
  A[name]?.(el.dataset);
});

if (!IS_BOARD) {
  document.addEventListener('input', (e) => { if (e.target.dataset.field) onInput(e.target); });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key) && S.screen === 'board') return A.reveal({ i: Number(e.key) - 1 });
    if (e.key.toLowerCase() === 'x' && S.screen === 'board') return A.strike();
    if (e.key === 'ArrowRight' || e.key === 'Enter') { const p = document.querySelector('.controls .btn.primary'); if (p) { e.preventDefault(); p.click(); } }
  });
  S = loadGame();
  if (!S || S.v !== loadConfig().version) S = newGame();
  if (S.fm) S.fm.running = false;
  lastFx = S.fx ? S.fx.id : 0;     // don't replay the last sound on refresh
  render();
  channel.post({ t: 'state', S });
  setInterval(() => { const was = boardSeenAt; if (was && !boardAlive()) { boardSeenAt = 0; renderHostBar(); } }, 3000);
} else {
  document.body.classList.add('is-board');
  document.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'f') A.fullscreen(); });
  S = loadGame();
  if (!S || S.v !== loadConfig().version) S = newGame();
  lastFx = S.fx ? S.fx.id : 0;
  render();
  channel.post({ t: 'hello' });
  setInterval(() => channel.post({ t: 'ping' }), 2000);
}
