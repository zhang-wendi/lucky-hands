/* ============ Lucky Hands · 音频引擎 ============ */
/* BGM 与全部音效由 WebAudio 实时合成（无需音频文件）； */
/* 英文女声台词使用浏览器内置 SpeechSynthesis。         */
window.AudioFX = (() => {
  let ctx = null;        // AudioContext，首次用户手势后创建
  let master = null;     // 总增益（静音开关）
  let musicBus = null;   // BGM 通道
  let sfxBus = null;     // 音效通道
  let muted = localStorage.getItem('luckyHandsMuted') === '1';
  let bgmStarted = false;
  let bgmLoopTimer = null;
  const MUSIC_LEVEL = 0.5; // BGM 总线电平（曾为 0.16，听感上等于没有音乐）

  /* ---------- 基础设施 ---------- */
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_LEVEL;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    // 挂起→运行的瞬间自动补启 BGM 并隐藏提示
    ctx.onstatechange = () => {
      if (ctx.state === 'running') {
        hideHint();
        if (!bgmStarted) startBGM();
      }
    };
    return ctx;
  }

  /* ---------- 音频解锁：加载即尝试，被自动播放策略拦截则等首次交互 ---------- */
  function startAudio() {
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    if (!bgmStarted && c.state === 'running') startBGM();
  }

  ['pointerdown', 'click', 'touchend', 'keydown'].forEach((ev) =>
    document.addEventListener(ev, startAudio, { capture: true })
  );

  window.addEventListener('load', () => {
    startAudio(); // 部分浏览器允许免手势直接出声
    if (!ctx || ctx.state !== 'running') showHint();
  });

  /* ---------- “点按开启音乐”提示 ---------- */
  function showHint() {
    if (muted) return; // 上次主动静音的用户不打扰
    const el = document.getElementById('audioHint');
    if (el) el.hidden = false;
  }

  function hideHint() {
    const el = document.getElementById('audioHint');
    if (el) el.hidden = true;
  }

  // 页面切后台挂起、切回恢复（省电）
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  /* ---------- 合成基元 ---------- */
  let noiseBuf = null;
  function getNoise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function playTone({ t, freq, freqEnd = null, dur = 0.3, gain = 0.2, type = 'sine', attack = 0.005, bus = sfxBus, vibrato = 0 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 8;
      const lg = ctx.createGain();
      lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function playNoise({ t, dur = 0.2, gain = 0.2, type = 'bandpass', f0 = 1000, f1 = null, q = 1, bus = sfxBus }) {
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f0, t);
    if (f1) filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /* ---------- 音效 ---------- */
  // 按钮点击：轻快木质感短音
  function click() {
    if (!ctx) return;
    playTone({ t: ctx.currentTime, freq: 520, freqEnd: 260, dur: 0.07, gain: 0.18, type: 'triangle' });
  }

  // 摇拳鼓点：低音鼓一次
  function tick() {
    if (!ctx) return;
    playTone({ t: ctx.currentTime, freq: 160, freqEnd: 95, dur: 0.12, gain: 0.3 });
  }

  // 亮拳挥动
  function whoosh() {
    if (!ctx) return;
    playNoise({ t: ctx.currentTime, dur: 0.28, gain: 0.16, type: 'bandpass', f0: 300, f1: 1900, q: 1 });
  }

  // 手势弹出
  function pop() {
    if (!ctx) return;
    const t = ctx.currentTime;
    playTone({ t, freq: 340, freqEnd: 760, dur: 0.1, gain: 0.25 });
    playNoise({ t, dur: 0.02, gain: 0.12, type: 'highpass', f0: 2500 });
  }

  // 烛光光效配的柔闪
  function shimmer() {
    if (!ctx) return;
    playNoise({ t: ctx.currentTime, dur: 0.45, gain: 0.09, type: 'highpass', f0: 3200 });
  }

  // 胜利：D 大调琶音 + 三下掌声 + 尾音星芒
  function stingWin() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [293.66, 369.99, 440.0, 587.33].forEach((f, i) =>
      playTone({ t: t + i * 0.09, freq: f, dur: 0.4, gain: 0.2, type: 'triangle', attack: 0.01 }));
    [0, 0.13, 0.26].forEach((d) =>
      playNoise({ t: t + d, dur: 0.035, gain: 0.28, type: 'bandpass', f0: 1500, q: 1.2 }));
    playTone({ t: t + 0.42, freq: 1567.98, dur: 0.35, gain: 0.07 });
  }

  // 失败：柔和下行双音（刻意做成安慰感，不做 buzzer）
  function stingLose() {
    if (!ctx) return;
    const t = ctx.currentTime;
    playTone({ t, freq: 440, dur: 0.5, gain: 0.13, attack: 0.12 });
    playTone({ t: t + 0.32, freq: 349.23, dur: 0.7, gain: 0.13, attack: 0.12 });
  }

  // 平局：俏皮 boing 弹簧音
  function stingTie() {
    if (!ctx) return;
    playTone({ t: ctx.currentTime, freq: 330, dur: 0.45, gain: 0.2, vibrato: 55 });
  }

  /* ---------- BGM：印度酒吧小循环 ---------- */
  // D 小调五声（D E F G A C），92 BPM，8 小节（32 拍）无缝循环
  const BPM = 92;
  const BEAT = 60 / BPM;
  const N = { D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33 };
  // 长笛旋律：[音高, 持续拍数]
  const MELODY = [
    [N.D4, 1], [N.E4, 1], [N.F4, 2], [N.A4, 1], [N.G4, 1], [N.F4, 2],
    [N.E4, 1], [N.D4, 1], [N.E4, 2], [N.A4, 2], [N.G4, 2],
    [N.F4, 1], [N.G4, 1], [N.A4, 2], [N.C5, 1], [N.D5, 1], [N.C5, 2],
    [N.A4, 1], [N.G4, 1], [N.F4, 1], [N.E4, 1], [N.D4, 4],
  ];
  // 塔布拉鼓型：每小节 8 个八分音符位 [位置, 鼓音]
  const TABLA = [[0, 'dha'], [1, 'ge'], [3, 'na'], [5, 'ti'], [6, 'na']];

  function drone() {
    // 坦普拉琴持续低音（D2 + A2），带极慢呼吸感
    [[73.42, 0.1], [110.0, 0.08]].forEach(([f, g]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const gn = ctx.createGain();
      gn.gain.value = g;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lg = ctx.createGain();
      lg.gain.value = g * 0.35;
      lfo.connect(lg).connect(gn.gain);
      o.connect(gn).connect(musicBus);
      o.start();
      lfo.start();
    });
  }

  function flute(freq, t, dur) {
    // 暖调长笛：三角波 + 轻颤音 + 低通
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.value = 3.5;
    vib.connect(vg).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.07);
    g.gain.setValueAtTime(0.3, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(lp).connect(musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
    vib.start(t);
    vib.stop(t + dur + 0.05);
  }

  function tabla(kind, t) {
    if (kind === 'dha' || kind === 'ge') {
      // 低音鼓（贝扬）
      playTone({ t, freq: kind === 'dha' ? 105 : 95, freqEnd: 70, dur: 0.22, gain: 0.32, bus: musicBus });
    } else {
      // 高音鼓（达扬）
      playTone({ t, freq: 640, freqEnd: 590, dur: 0.06, gain: 0.14, bus: musicBus });
      playNoise({ t, dur: 0.03, gain: 0.07, type: 'highpass', f0: 3500, bus: musicBus });
    }
  }

  function scheduleLoop(startTime) {
    let t = startTime;
    for (const [freq, beats] of MELODY) {
      if (freq) flute(freq, t, beats * BEAT * 0.95);
      t += beats * BEAT;
    }
    for (let bar = 0; bar < 8; bar++) {
      const bt = startTime + bar * 4 * BEAT;
      TABLA.forEach(([slot, kind]) => tabla(kind, bt + slot * BEAT / 2));
      if (bar % 4 === 3) tabla('ge', bt + 7 * BEAT / 2); // 每 4 小节加一记填充
    }
  }

  function startBGM() {
    if (!ctx || bgmStarted) return;
    bgmStarted = true;
    // 1.2 秒淡入，避免音乐突然砸出来
    const now = ctx.currentTime;
    musicBus.gain.setValueAtTime(0.0001, now);
    musicBus.gain.exponentialRampToValueAtTime(MUSIC_LEVEL, now + 1.2);
    drone();
    const loopLen = 32 * BEAT; // ≈20.9s
    let next = ctx.currentTime + 0.1;
    const pump = () => {
      // 后台挂起时跳过调度，避免恢复瞬间事件堆叠
      if (document.hidden) {
        bgmLoopTimer = setTimeout(pump, 1000);
        return;
      }
      scheduleLoop(next);
      next += loopLen;
      bgmLoopTimer = setTimeout(pump, Math.max(0, (next - ctx.currentTime - 0.5) * 1000));
    };
    pump();
  }

  // 说话时自动压低 BGM（ducking）
  function duckMusic(on) {
    if (!ctx || !bgmStarted) return;
    musicBus.gain.setTargetAtTime(on ? MUSIC_LEVEL * 0.35 : MUSIC_LEVEL, ctx.currentTime, 0.15);
  }

  /* ---------- 语音（edge-tts 预生成 · 印度英文女声 Neerja） ---------- */
  const VOICE_FILES = {
    countdown: 'voice/countdown.mp3',
    idle1: 'voice/idle1.mp3', idle2: 'voice/idle2.mp3', idle3: 'voice/idle3.mp3',
    idle4: 'voice/idle4.mp3', idle5: 'voice/idle5.mp3',
    win1: 'voice/win1.mp3', win2: 'voice/win2.mp3', win3: 'voice/win3.mp3',
    lose1: 'voice/lose1.mp3', lose2: 'voice/lose2.mp3', lose3: 'voice/lose3.mp3',
    tie1: 'voice/tie1.mp3', tie2: 'voice/tie2.mp3', tie3: 'voice/tie3.mp3',
  };
  const voiceEls = {};
  let currentVoice = null;

  // 播放预生成语音；新语音会打断上一条，说话时自动压低 BGM（ducking）
  function playVoice(key) {
    if (muted) return;
    if (!VOICE_FILES[key]) return;
    if (!voiceEls[key]) {
      const a = new Audio(VOICE_FILES[key]);
      a.preload = 'auto';
      voiceEls[key] = a;
    }
    if (currentVoice && currentVoice !== voiceEls[key]) {
      currentVoice.pause();
      currentVoice.currentTime = 0;
      duckMusic(false);
    }
    const a = voiceEls[key];
    a.currentTime = 0;
    currentVoice = a;
    duckMusic(true);
    a.onended = a.onerror = () => {
      if (currentVoice === a) duckMusic(false);
    };
    a.play().catch(() => duckMusic(false));
  }

  /* ---------- 静音 ---------- */
  function setMuted(m) {
    muted = m;
    localStorage.setItem('luckyHandsMuted', m ? '1' : '0');
    if (m) hideHint();
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {}); // 解除静音时顺带唤醒音频
      master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
    }
    if (m && currentVoice) {
      currentVoice.pause();
      duckMusic(false);
    }
  }

  return {
    unlock: startAudio,
    click,
    tick,
    whoosh,
    pop,
    shimmer,
    stingWin,
    stingLose,
    stingTie,
    playVoice,
    toggleMute: () => {
      setMuted(!muted);
      return muted;
    },
    isMuted: () => muted,
  };
})();
