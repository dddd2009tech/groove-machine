'use strict';

/* =========================================================================
   Groove Machine — offline practice sequencer
   Plain JS, no dependencies. All sounds synthesised with the Web Audio API.
   ========================================================================= */

/* ---------------------------------------------------------------- config */

const SIGS = {
  '3/4': { beats: 3, unit: 4 },
  '4/4': { beats: 4, unit: 4 },
  '5/4': { beats: 5, unit: 4 },
  '6/8': { beats: 6, unit: 8 },
};

const KITS = {
  standard:     { label:'Standard',
    kickHi:150, kickLo:52, kickDec:.32, kickGain:1.0, click:.5,
    snTone:185, snDec:.19, snFreq:1800, snNoise:.55, snBody:.3,
    hatHP:7800, hatDec:.045, hatOpen:.26, hatGain:.33 },
  powerful:     { label:'Powerful',
    kickHi:180, kickLo:45, kickDec:.45, kickGain:1.15, click:.7,
    snTone:200, snDec:.25, snFreq:1700, snNoise:.75, snBody:.5,
    hatHP:7000, hatDec:.06, hatOpen:.34, hatGain:.4 },
  monumental:   { label:'Monumental',
    kickHi:200, kickLo:38, kickDec:.7, kickGain:1.3, click:.6,
    snTone:150, snDec:.42, snFreq:1500, snNoise:.85, snBody:.55,
    hatHP:6200, hatDec:.1, hatOpen:.5, hatGain:.45 },
  fresh:        { label:'Fresh',
    kickHi:120, kickLo:60, kickDec:.22, kickGain:.85, click:.45,
    snTone:240, snDec:.14, snFreq:2600, snNoise:.5, snBody:.22,
    hatHP:9500, hatDec:.03, hatOpen:.18, hatGain:.3 },
  minimalistic: { label:'Minimalistic',
    kickHi:110, kickLo:55, kickDec:.18, kickGain:.7, click:.25,
    snTone:200, snDec:.1, snFreq:2000, snNoise:.3, snBody:.15,
    hatHP:10500, hatDec:.022, hatOpen:.13, hatGain:.22 },
  energetic:    { label:'Energetic',
    kickHi:165, kickLo:50, kickDec:.26, kickGain:1.05, click:.65,
    snTone:210, snDec:.17, snFreq:2200, snNoise:.7, snBody:.35,
    hatHP:8200, hatDec:.035, hatOpen:.22, hatGain:.38 },
};

/* Essential grooves. Strum steps use D (accented down), d (down),
   u (up), U (accented up), . or '' (rest). Two characters in one step
   means two 16th-note hits inside that step, e.g. "du". */
const ESSENTIALS = [
  { name:'1. d d D d', sig:'4/4', sub:8,
    hat:[1,1,1,1,1,1,1,1], snare:[0,0,1,0,0,0,1,0], kick:[1,0,0,0,1,0,0,0],
    strum:['d','','d','','D','','d',''] },
  { name:'2. d D d D', sig:'4/4', sub:8,
    hat:[1,1,1,1,1,1,1,1], snare:[0,0,1,0,0,0,1,0], kick:[1,0,0,0,1,0,0,0],
    strum:['d','','D','','d','','D',''] },
  { name:'3. D d d D d d D d', sig:'4/4', sub:8,
    hat:[1,1,1,1,1,1,1,1], snare:[0,0,1,0,0,0,1,0], kick:[1,0,0,0,1,0,0,0],
    strum:['D','d','d','D','d','d','D','d'] },
  { name:'4. D d d D d d', sig:'6/8', sub:8,
    hat:[1,1,1,1,1,1], snare:[0,0,0,1,0,0], kick:[1,0,0,0,0,0],
    strum:['D','d','d','D','d','d'] },
  { name:'5. d d D du.ud D d', sig:'4/4', sub:8,
    hat:[1,1,1,1,1,1,1,1], snare:[0,0,1,0,0,0,1,0], kick:[1,0,0,0,1,0,0,0],
    strum:['d','d','D','du','','ud','D','d'] },
  { name:'6. d D .uDu', sig:'4/4', sub:8,
    hat:[1,1,1,1,1,1,1,1], snare:[0,0,1,0,0,0,1,0], kick:[1,0,0,0,1,0,0,0],
    strum:['d','','D','','','u','D','u'] },
];

const SAVE_KEY = 'groove-machine:v1';
const MINE_KEY = 'groove-machine:mine:v1';

/* ----------------------------------------------------------------- state */

const state = {
  bpm: 90,
  sig: '4/4',
  sub: 8,
  swing8: false,
  swing16: false,
  swingAmt: 0.67,
  kit: 'standard',
  autoFills: false,
  autoHat: false,
  practice: 0,
  volume: 1,
  hat:   { muted:false, steps:[1,1,1,1,1,1,1,1] },
  snare: { muted:false, steps:[0,0,1,0,0,0,1,0] },
  kick:  { muted:false, steps:[1,0,0,0,1,0,0,0] },
  strums: [],
};

const DRUMS = ['hat','snare','kick'];
const DRUM_LABEL = { hat:'Hi-hat', snare:'Snare drum', kick:'Bass drum' };
const DRUM_SHORT = { hat:'Hat', snare:'Snare', kick:'Kick' };

/* Long label on roomy screens, short one on a phone — CSS picks which. */
function labelHtml(long, short){
  return `<span class="name"><span class="lg">${long}</span><span class="sm">${short}</span></span>`;
}

function barSteps(){
  const sig = SIGS[state.sig];
  return sig.unit === 8 ? (state.sub === 16 ? sig.beats*2 : sig.beats)
                        : sig.beats * (state.sub/4);
}
function beatStride(){
  const sig = SIGS[state.sig];
  return sig.unit === 8 ? (state.sub === 16 ? 6 : 3) : state.sub/4;
}
function stepDur(){
  return (60 / state.bpm) / (state.sub / 4);
}

/* ----------------------------------------------------------------- audio */

let ctx = null, noiseBuf = null;
let drumBus, strumBus, practiceGain, volumeGain;

function initAudio(){
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  ctx.onstatechange = audioStatus;

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  volumeGain   = ctx.createGain();
  practiceGain = ctx.createGain();
  drumBus      = ctx.createGain();
  strumBus     = ctx.createGain();

  strumBus.gain.value = 0.9;
  volumeGain.gain.value = state.volume;
  practiceGain.gain.value = 1;

  drumBus.connect(practiceGain);
  strumBus.connect(practiceGain);
  practiceGain.connect(volumeGain);
  volumeGain.connect(ctx.destination);
}

/* iOS doesn't just suspend an AudioContext when the app goes to the
   background — it *interrupts* it (a call, a route change, a long spell
   behind another app). An interrupted context often refuses to resume, and
   its clock stops advancing, so the scheduler queues nothing and you get
   silence behind a UI that still looks alive. Try to resume; if that fails,
   throw the context away and build a fresh one. */
async function resumeAudio(){
  initAudio();
  if (ctx.state === 'running') return true;

  try { await ctx.resume(); } catch (e) { /* fall through to a rebuild */ }
  if (ctx.state === 'running') return true;

  const dead = ctx;
  ctx = null;
  // close() rejects a promise rather than throwing, so it has to be awaited
  // inside the try for the catch to see it.
  try { if (dead.state !== 'closed') await dead.close(); } catch (e) {}
  initAudio();
  try { await ctx.resume(); } catch (e) {}
  return ctx.state === 'running';
}

function env(param, t, peak, decay){
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + 0.003);
  param.exponentialRampToValueAtTime(0.0001, t + decay);
}

function playKick(t, vel){
  const k = KITS[state.kit];
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(k.kickHi, t);
  osc.frequency.exponentialRampToValueAtTime(k.kickLo, t + 0.055);
  env(g.gain, t, vel * k.kickGain, k.kickDec);
  osc.connect(g); g.connect(drumBus);
  osc.start(t); osc.stop(t + k.kickDec + 0.08);

  if (k.click > 0){
    const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), cg = ctx.createGain();
    n.buffer = noiseBuf;
    hp.type = 'highpass'; hp.frequency.value = 1200;
    env(cg.gain, t, vel * k.click * 0.25, 0.02);
    n.connect(hp); hp.connect(cg); cg.connect(drumBus);
    n.start(t); n.stop(t + 0.05);
  }
}

function playSnare(t, vel){
  const k = KITS[state.kit];
  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(),
        hp = ctx.createBiquadFilter(), ng = ctx.createGain();
  n.buffer = noiseBuf;
  bp.type = 'bandpass'; bp.frequency.value = k.snFreq; bp.Q.value = 0.8;
  hp.type = 'highpass'; hp.frequency.value = 420;
  env(ng.gain, t, vel * k.snNoise, k.snDec);
  n.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(drumBus);
  n.start(t); n.stop(t + k.snDec + 0.08);

  const o = ctx.createOscillator(), og = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(k.snTone, t);
  o.frequency.exponentialRampToValueAtTime(k.snTone * 0.68, t + 0.09);
  env(og.gain, t, vel * k.snBody, Math.min(k.snDec, 0.16));
  o.connect(og); og.connect(drumBus);
  o.start(t); o.stop(t + 0.25);
}

function playHat(t, vel, open){
  const k = KITS[state.kit];
  const dur = open ? k.hatOpen : k.hatDec;
  const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf;
  hp.type = 'highpass'; hp.frequency.value = k.hatHP;
  env(g.gain, t, vel * k.hatGain, dur);
  n.connect(hp); hp.connect(g); g.connect(drumBus);
  n.start(t); n.stop(t + dur + 0.06);
}

/* A strum is a short percussive "chuck": filtered noise for the pick attack
   plus a damped low body so downstrokes sit under upstrokes. */
function playStrum(t, ch){
  const up      = ch === 'u' || ch === 'U';
  const accent  = ch === 'D' || ch === 'U';
  const vel     = accent ? 1 : 0.5;
  const dur     = up ? 0.085 : 0.14;

  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf;
  bp.type = 'bandpass';
  bp.frequency.value = up ? 2700 : 1600;
  bp.Q.value = 1.1;
  env(g.gain, t, vel * 0.42, dur);
  n.connect(bp); bp.connect(g); g.connect(strumBus);
  n.start(t); n.stop(t + dur + 0.06);

  if (!up){
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(up ? 220 : 130, t);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    env(og.gain, t, vel * 0.18, 0.1);
    o.connect(lp); lp.connect(og); og.connect(strumBus);
    o.start(t); o.stop(t + 0.18);
  }
}

/* ------------------------------------------------------------- sequencer */

let playing = false, timer = null, wasPlaying = false;
let curStep = 0, nextTime = 0, bar = 0, countIn = false;
let lastFadeBar = -1;
const LOOKAHEAD = 25, AHEAD = 0.12;
const drawQueue = [];

function swingOffset(i, sd){
  const amt = (state.swingAmt - 0.5) * 2;
  if (amt <= 0) return 0;
  if (state.sub === 16){
    if (state.swing16 && i % 2 === 1) return amt * sd;
    if (state.swing8  && i % 4 === 2) return amt * sd * 2;
  } else if (state.swing8 && i % 2 === 1){
    return amt * sd;
  }
  return 0;
}

function isBeat(i){ return i % beatStride() === 0; }

function scheduleStep(i, t){
  const sd = stepDur();
  const when = t + swingOffset(i, sd);
  const n = barSteps();

  if (countIn){
    if (isBeat(i)) playHat(when, i === 0 ? 1 : 0.6, false);
    drawQueue.push({ step:i, time:when });
    return;
  }

  // Fill: on every 4th bar, the final beat is replaced by a snare fill.
  const stride = beatStride();
  const inFill = state.autoFills && (bar % 4 === 3) && i >= n - stride;

  if (inFill){
    const pos = i - (n - stride);
    playSnare(when, 0.55 + 0.45 * (pos / Math.max(1, stride - 1)));
    if (i === n - 1) playHat(when, 0.8, true);
  } else {
    const hatOn = state.autoHat ? (state.sub === 16 ? i % 2 === 0 : true)
                                : !!state.hat.steps[i];
    if (hatOn && !state.hat.muted)       playHat(when, isBeat(i) ? 0.95 : 0.7, false);
    if (state.snare.steps[i] && !state.snare.muted) playSnare(when, 1);
    if (state.kick.steps[i]  && !state.kick.muted)  playKick(when, 1);
  }

  for (const tr of state.strums){
    if (tr.muted) continue;
    const v = (tr.steps[i] || '').replace(/\./g, '');
    if (!v) continue;
    playStrum(when, v[0]);
    if (v.length > 1) playStrum(when + sd / 2, v[1]);
  }

  // If rAF is throttled or stopped (app backgrounded), stop the draw queue
  // from growing without bound — the audio clock is unaffected either way.
  if (drawQueue.length > 256) drawQueue.splice(0, drawQueue.length - 64);
  drawQueue.push({ step:i, time:when });
}

/* Practice mode: ramp the kit down and back up around a quiet window,
   while the clock keeps running underneath. */
function schedulePracticeFade(barStart){
  if (!state.practice || lastFadeBar === bar) return;
  lastFadeBar = bar;
  const g = practiceGain.gain, R = 0.3;
  g.cancelScheduledValues(barStart);
  g.setValueAtTime(1, barStart);
  g.linearRampToValueAtTime(0.0001, barStart + R);
  const back = barStart + R + state.practice;
  g.setValueAtTime(0.0001, back);
  g.linearRampToValueAtTime(1, back + R);
}

function advance(){
  nextTime += stepDur();
  curStep++;
  if (curStep >= barSteps()){
    curStep = 0;
    if (countIn) countIn = false; else bar++;
  }
}

function scheduler(){
  // The clock died under us — park the transport instead of leaving a lit
  // play button over silence.
  if (!ctx || ctx.state !== 'running'){ wasPlaying = true; stop(); audioStatus(); return; }

  while (nextTime < ctx.currentTime + AHEAD){
    if (curStep === 0 && !countIn && state.practice && bar > 0 && bar % 4 === 0){
      schedulePracticeFade(nextTime);
    }
    scheduleStep(curStep, nextTime);
    advance();
  }
}

async function start(){
  if (!(await resumeAudio())){ audioStatus(); return; }
  wasPlaying = false;
  playing = true;
  curStep = 0; bar = 0; lastFadeBar = -1;
  countIn = state.autoFills;
  practiceGain.gain.cancelScheduledValues(ctx.currentTime);
  practiceGain.gain.setValueAtTime(1, ctx.currentTime);
  nextTime = ctx.currentTime + 0.08;
  timer = setInterval(scheduler, LOOKAHEAD);
  requestAnimationFrame(draw);
  $('#play').classList.add('playing');
  $('#play').setAttribute('aria-label', 'Stop');
  requestWakeLock();
  audioStatus();
}

function stop(){
  playing = false;
  clearInterval(timer); timer = null;
  drawQueue.length = 0;
  if (ctx && practiceGain){
    practiceGain.gain.cancelScheduledValues(ctx.currentTime);
    practiceGain.gain.setValueAtTime(1, ctx.currentTime);
  }
  $('#play').classList.remove('playing');
  $('#play').setAttribute('aria-label', 'Play');
  $$('.pad.cur').forEach(p => p.classList.remove('cur'));
  releaseWakeLock();
}

function toggle(){ playing ? stop() : start(); }

let shownStep = -1;
function draw(){
  if (!playing) return;
  while (drawQueue.length && drawQueue[0].time <= ctx.currentTime){
    const ev = drawQueue.shift();
    if (ev.step !== shownStep){
      shownStep = ev.step;
      $$('.pad.cur').forEach(p => p.classList.remove('cur'));
      $$(`.pad[data-step="${ev.step}"]`).forEach(p => p.classList.add('cur'));
    }
  }
  requestAnimationFrame(draw);
}

/* ------------------------------------------------------------- wake lock */

let wakeLock = null;
async function requestWakeLock(){
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }
  catch (e) { /* not fatal */ }
}
function releaseWakeLock(){
  try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
}
/* Coming back to the app: get the screen lock back if we're still playing,
   and wake the audio hardware so the next tap of play is instant rather than
   silent. Playback is not auto-restarted — nobody wants sound to burst out of
   a phone they just unlocked. */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  if (playing) requestWakeLock();
  if (ctx && ctx.state !== 'running') await resumeAudio();
  audioStatus();
});

/* ---------------------------------------------------------- audio status */

/* One line under the transport that names the reason for silence. Without it
   a dead context and a volume slider at zero look identical: nothing happens. */
function audioStatus(){
  const el = document.getElementById('audioNote');
  if (!el) return;
  let msg = '';
  if (state.volume <= 0.005){
    msg = 'Volume is at 0% — slide it up.';
  } else if (wasPlaying && (!ctx || ctx.state !== 'running')){
    msg = 'Sound was interrupted while the app was in the background. Tap play to start it again.';
  } else if (ctx && ctx.state !== 'running' && !playing){
    msg = 'Sound is asleep. Tap play to wake it.';
  }
  el.textContent = msg;
  el.hidden = !msg;
}

/* -------------------------------------------------------------------- UI */

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const SPEAKER = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 010 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const MUTED   = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

function resize(oldSub, newSub){
  const map = arr => {
    if (oldSub === newSub) return arr;
    if (newSub === 16) { const o=[]; arr.forEach(v => { o.push(v); o.push(typeof v==='string'?'':0); }); return o; }
    return arr.filter((_, i) => i % 2 === 0);
  };
  for (const d of DRUMS) state[d].steps = fit(map(state[d].steps), 0);
  for (const t of state.strums) t.steps = fit(map(t.steps), '');
}
function fit(arr, blank){
  const n = barSteps(), out = arr.slice(0, n);
  while (out.length < n) out.push(blank);
  return out;
}
function refit(){
  for (const d of DRUMS) state[d].steps = fit(state[d].steps, 0);
  for (const t of state.strums) t.steps = fit(t.steps, '');
}

function renderGrid(){
  const grid = $('#grid');
  const n = barSteps();
  grid.style.setProperty('--steps', n);
  grid.innerHTML = '';

  for (const d of DRUMS){
    const row = document.createElement('div');
    row.className = `row ${d}` + (state[d].muted ? ' muted' : '');

    const head = document.createElement('div');
    head.className = 'rowhead';
    head.innerHTML =
      `<button class="iconbtn${state[d].muted?' muted':''}" data-mute="${d}" aria-label="Mute ${DRUM_LABEL[d]}">${state[d].muted?MUTED:SPEAKER}</button>` +
      `<div class="headstack">` + labelHtml(DRUM_LABEL[d], DRUM_SHORT[d]) +
      (d === 'hat'
        ? `<label class="sub"><input type="checkbox" id="autoHat" ${state.autoHat?'checked':''}>` +
          `<span class="lg">Auto 8ths</span><span class="sm">Auto</span></label>`
        : '') +
      `</div>`;
    row.appendChild(head);

    for (let i = 0; i < n; i++){
      const b = document.createElement('button');
      b.className = 'pad' + (isBeat(i) ? ' beat' : '') + (state[d].steps[i] ? ' on' : '');
      b.dataset.step = i; b.dataset.track = d;
      b.setAttribute('aria-label', `${DRUM_LABEL[d]} step ${i+1}`);
      if (isBeat(i) && !state[d].steps[i]) b.textContent = String(i / beatStride() + 1);
      if (d === 'hat' && state.autoHat) b.classList.add('ghosted');
      row.appendChild(b);
    }
    grid.appendChild(row);
  }

  state.strums.forEach((tr, idx) => {
    const row = document.createElement('div');
    row.className = 'row strum' + (tr.muted ? ' muted' : '');
    const head = document.createElement('div');
    head.className = 'rowhead';
    head.innerHTML =
      `<button class="iconbtn${tr.muted?' muted':''}" data-smute="${idx}" aria-label="Mute ${tr.name}">${tr.muted?MUTED:SPEAKER}</button>` +
      `<div class="headstack">` +
        `<input class="trackname" type="text" maxlength="18" data-sname="${idx}" ` +
        `value="${escapeHtml(tr.name)}" aria-label="Track ${idx+1} name" ` +
        `autocapitalize="off" autocomplete="off" spellcheck="false">` +
      `</div>` +
      `<button class="iconbtn" data-sdel="${idx}" aria-label="Remove ${tr.name}">&times;</button>`;
    row.appendChild(head);

    for (let i = 0; i < n; i++){
      const inp = document.createElement('input');
      inp.className = 'pad' + (isBeat(i) ? ' beat' : '');
      inp.type = 'text'; inp.maxLength = 2;
      inp.value = tr.steps[i] || '';
      inp.dataset.step = i; inp.dataset.strum = idx;
      inp.setAttribute('aria-label', `${tr.name} step ${i+1}`);
      inp.autocapitalize = 'off'; inp.autocomplete = 'off'; inp.spellcheck = false;
      row.appendChild(inp);
    }
    grid.appendChild(row);
  });

  updateMeta();
}

function updateMeta(){
  const feel = (state.swing8 || state.swing16)
    ? `Swing ${Math.round(state.swingAmt * 100)}%` : 'Straight';
  $('#meta').textContent = `${state.sig} / ${state.sub === 16 ? '16ths' : '8ths'} / ${feel}`;
}

function paintPad(d, i){
  const el = $(`.pad[data-track="${d}"][data-step="${i}"]`);
  if (!el) return;
  const on = !!state[d].steps[i];
  el.classList.toggle('on', on);
  el.textContent = (isBeat(i) && !on) ? String(i / beatStride() + 1) : '';
}

/* ------------------------------------------------------------- bindings */

$('#grid').addEventListener('click', e => {
  const pad = e.target.closest('.pad[data-track]');
  if (pad){
    const d = pad.dataset.track, i = +pad.dataset.step;
    state[d].steps[i] = state[d].steps[i] ? 0 : 1;
    paintPad(d, i); save();
    return;
  }
  const mute = e.target.closest('[data-mute]');
  if (mute){ const d = mute.dataset.mute; state[d].muted = !state[d].muted; renderGrid(); save(); return; }
  const sm = e.target.closest('[data-smute]');
  if (sm){ const i = +sm.dataset.smute; state.strums[i].muted = !state.strums[i].muted; renderGrid(); save(); return; }
  const sd = e.target.closest('[data-sdel]');
  if (sd){ state.strums.splice(+sd.dataset.sdel, 1); renumber(); renderGrid(); save(); return; }
});

$('#grid').addEventListener('change', e => {
  if (e.target.id === 'autoHat'){ state.autoHat = e.target.checked; renderGrid(); save(); }
});

$('#grid').addEventListener('input', e => {
  const nameInp = e.target.closest('input.trackname');
  if (nameInp){
    // Rewrite state in place rather than re-rendering, so the caret stays put.
    state.strums[+nameInp.dataset.sname].name = nameInp.value;
    save();
    return;
  }
  const inp = e.target.closest('input.pad[data-strum]');
  if (!inp) return;
  const clean = inp.value.replace(/[^DduU.]/g, '').slice(0, 2);
  inp.value = clean;
  state.strums[+inp.dataset.strum].steps[+inp.dataset.step] = clean;
  save();
});

/* Renumber only the tracks still carrying a default name, so deleting a row
   never renames one the user has titled themselves. */
function renumber(){
  state.strums.forEach((t, i) => {
    if (/^Strum \d+$/.test(t.name)) t.name = `Strum ${i+1}`;
  });
}

$('#addStrum').addEventListener('click', () => {
  state.strums.push({ name:`Strum ${state.strums.length+1}`, muted:false,
                      steps:new Array(barSteps()).fill('') });
  renderGrid(); save();
});

$('#play').addEventListener('click', toggle);

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)){
    e.preventDefault(); toggle();
  }
});

function setBpm(v){
  state.bpm = Math.max(30, Math.min(300, Math.round(v) || 90));
  $('#bpm').value = state.bpm;
  $$('.speeds button').forEach(b => b.classList.toggle('on', +b.dataset.bpm === state.bpm));
  save();
}
$('#bpmDown').addEventListener('click', () => setBpm(state.bpm - 5));
$('#bpmUp').addEventListener('click',   () => setBpm(state.bpm + 5));
$('#bpm').addEventListener('change', e => setBpm(+e.target.value));
$$('.speeds button').forEach(b => b.addEventListener('click', () => setBpm(+b.dataset.bpm)));

let taps = [];
$('#tap').addEventListener('click', () => {
  const now = performance.now();
  taps = taps.filter(t => now - t < 2500);
  taps.push(now);
  if (taps.length >= 2){
    const gaps = taps.slice(1).map((t, i) => t - taps[i]);
    setBpm(60000 / (gaps.reduce((a,b)=>a+b,0) / gaps.length));
  }
});

$('#volume').addEventListener('input', e => {
  state.volume = +e.target.value / 100;
  $('#volOut').textContent = e.target.value + '%';
  if (volumeGain) volumeGain.gain.setTargetAtTime(state.volume, ctx.currentTime, 0.01);
  audioStatus();
  save();
});

$('#sub16').addEventListener('change', e => {
  const old = state.sub;
  state.sub = e.target.checked ? 16 : 8;
  resize(old, state.sub);
  renderGrid(); save();
});
$('#swing8').addEventListener('change',  e => { state.swing8  = e.target.checked; updateMeta(); save(); });
$('#swing16').addEventListener('change', e => { state.swing16 = e.target.checked; updateMeta(); save(); });

$('#swingAmt').addEventListener('input', e => {
  state.swingAmt = +e.target.value / 100;
  $('#swingOut').textContent = e.target.value + '%';
  updateMeta(); save();
});

$$('.practice button').forEach(b => b.addEventListener('click', () => {
  state.practice = +b.dataset.practice;
  $$('.practice button').forEach(x => x.classList.toggle('on', x === b));
  lastFadeBar = -1;
  if (!state.practice && practiceGain){
    practiceGain.gain.cancelScheduledValues(ctx.currentTime);
    practiceGain.gain.setValueAtTime(1, ctx.currentTime);
  }
  save();
}));

$('#autoFills').addEventListener('change', e => { state.autoFills = e.target.checked; save(); });

$$('#sigs button').forEach(b => b.addEventListener('click', () => {
  state.sig = b.dataset.sig;
  $$('#sigs button').forEach(x => x.classList.toggle('on', x === b));
  refit(); renderGrid(); save();
}));

/* kits */
const kitsBox = $('#kits');
Object.entries(KITS).forEach(([id, k]) => {
  const b = document.createElement('button');
  b.textContent = k.label; b.dataset.kit = id;
  if (id === state.kit) b.classList.add('on');
  b.addEventListener('click', () => {
    state.kit = id;
    $$('#kits button').forEach(x => x.classList.toggle('on', x === b));
    save();
  });
  kitsBox.appendChild(b);
});

$('#clearBtn').addEventListener('click', () => {
  for (const d of DRUMS) state[d].steps = new Array(barSteps()).fill(0);
  for (const t of state.strums) t.steps = new Array(barSteps()).fill('');
  renderGrid(); save();
});

/* ------------------------------------------------------------- presets */

const dlg = $('#beatsDlg');
$('#beatsBtn').addEventListener('click', () => { renderMine(); dlg.showModal(); });

function applyGroove(g){
  state.sig = g.sig; state.sub = g.sub;
  $$('#sigs button').forEach(x => x.classList.toggle('on', x.dataset.sig === g.sig));
  $('#sub16').checked = g.sub === 16;
  state.hat.steps   = g.hat.slice();
  state.snare.steps = g.snare.slice();
  state.kick.steps  = g.kick.slice();
  state.strums = g.strums
    ? g.strums.map((s, i) => ({ name:`Strum ${i+1}`, muted:false, steps:s.slice() }))
    : (g.strum ? [{ name:'Strum 1', muted:false, steps:g.strum.slice() }] : []);
  if (g.bpm) setBpm(g.bpm);
  refit(); renderGrid(); save();
}

const essBox = $('#essentials');
ESSENTIALS.forEach(g => {
  const b = document.createElement('button');
  b.textContent = g.name;
  b.addEventListener('click', () => { applyGroove(g); dlg.close(); });
  essBox.appendChild(b);
});

function loadMine(){
  try { return JSON.parse(localStorage.getItem(MINE_KEY)) || []; } catch(e){ return []; }
}
function saveMine(list){
  try { localStorage.setItem(MINE_KEY, JSON.stringify(list)); } catch(e){}
}
function renderMine(){
  const list = loadMine(), box = $('#mine');
  box.innerHTML = '';
  $('#myCount').textContent = list.length ? `(${list.length})` : '';
  if (!list.length){
    box.innerHTML = '<p class="dim small">Nothing saved yet. Build a groove, name it below and hit save.</p>';
    return;
  }
  list.forEach((g, i) => {
    const b = document.createElement('button');
    b.innerHTML = `${escapeHtml(g.name)}<span class="chip-del" data-del="${i}">&times;</span>`;
    b.addEventListener('click', e => {
      if (e.target.dataset.del !== undefined){
        const l = loadMine(); l.splice(+e.target.dataset.del, 1); saveMine(l); renderMine();
      } else { applyGroove(g); dlg.close(); }
    });
    box.appendChild(b);
  });
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

$('#saveForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#saveName').value.trim();
  if (!name) return;
  const list = loadMine();
  list.push({
    name, sig:state.sig, sub:state.sub, bpm:state.bpm,
    hat:state.hat.steps.slice(), snare:state.snare.steps.slice(), kick:state.kick.steps.slice(),
    strums:state.strums.map(t => t.steps.slice()),
  });
  saveMine(list);
  $('#saveName').value = '';
  renderMine();
});

/* ------------------------------------------------------------- sharing */

/* A groove travels as a URL fragment. The fragment never leaves the device
   on its own — it is only ever sent if you hand the link to someone — and it
   is how a groove gets from the iPhone to the iPad, since saved grooves live
   in each device's own storage. */

const SHARE_FIELDS = ['bpm','sig','sub','swing8','swing16','swingAmt','kit',
                      'autoFills','autoHat','hat','snare','kick','strums'];

function b64url(s){
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function unb64url(s){
  const pad = s.replace(/-/g,'+').replace(/_/g,'/');
  return decodeURIComponent(escape(atob(pad + '==='.slice((pad.length + 3) % 4))));
}

function shareUrl(){
  const payload = {};
  for (const f of SHARE_FIELDS) payload[f] = state[f];
  return location.origin + location.pathname + '#g=' + b64url(JSON.stringify(payload));
}

function readShareLink(){
  const m = /[#&]g=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!m) return null;
  let obj = null;
  try { obj = JSON.parse(unb64url(m[1])); } catch(e){ return null; }
  if (!obj || typeof obj !== 'object') return null;
  // Take only the fields we recognise, so a mangled link can't poison state.
  const clean = {};
  for (const f of SHARE_FIELDS) if (f in obj) clean[f] = obj[f];
  history.replaceState(null, '', location.pathname);
  return clean;
}

function note(msg){
  const el = document.getElementById('audioNote');
  if (!el) return;
  el.textContent = msg; el.hidden = false;
  clearTimeout(note._t);
  note._t = setTimeout(audioStatus, 4000);
}

$('#shareBtn').addEventListener('click', async () => {
  const url = shareUrl();
  try {
    if (navigator.share){ await navigator.share({ title:'Groove Machine', url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    await navigator.clipboard.writeText(url);
    note('Link copied. Open it on another device to load this groove.');
  } catch (e) {
    note('Copy this link: ' + url);
  }
});

/* --------------------------------------------------------- persistence */

let saveTimer = null;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e){}
  }, 250);
}
function restore(){
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch(e){}
  if (raw) Object.assign(state, raw);

  // Two strum rows, like the app this replaces. One carries the first
  // essential pattern so the notation explains itself. This also runs for a
  // device saved by an earlier version that opened with no strum row at all,
  // where the trainer simply looked absent.
  if (!Array.isArray(state.strums) || !state.strums.length){
    state.strums = [
      { name:'Strum 1', muted:false, steps:['d','','D','','d','','D',''] },
      { name:'Strum 2', muted:false, steps:new Array(8).fill('') },
    ];
  }

  const shared = readShareLink();
  if (shared) Object.assign(state, shared);

  $('#bpm').value = state.bpm;
  $('#sub16').checked  = state.sub === 16;
  $('#swing8').checked  = state.swing8;
  $('#swing16').checked = state.swing16;
  $('#swingAmt').value = Math.round(state.swingAmt * 100);
  $('#swingOut').textContent = Math.round(state.swingAmt * 100) + '%';
  $('#autoFills').checked = state.autoFills;
  $('#volume').value = Math.round(state.volume * 100);
  $('#volOut').textContent = Math.round(state.volume * 100) + '%';
  $$('#sigs button').forEach(x => x.classList.toggle('on', x.dataset.sig === state.sig));
  $$('#kits button').forEach(x => x.classList.toggle('on', x.dataset.kit === state.kit));
  $$('.speeds button').forEach(b => b.classList.toggle('on', +b.dataset.bpm === state.bpm));
  $$('.practice button').forEach(b => b.classList.toggle('on', +b.dataset.practice === state.practice));
  refit();
}

restore();
renderGrid();
audioStatus();

/* ----------------------------------------------------- service worker */

if ('serviceWorker' in navigator){
  // True only if a worker was already in charge when this page loaded, so the
  // very first install doesn't trigger the reload below.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });

  // A new worker took over, which means a newer version is cached. The page in
  // front of you is still running the old files, so pick them up once.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}
