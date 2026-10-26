/* ============ Lucky Hands · 猜拳核心流程 ============ */
(() => {
  const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
  const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  const CHOICES = ['rock', 'paper', 'scissors'];
  const CHANTS = ['Rock…', 'Paper…', 'Scissors…'];

  // 英文台词库（暧昧酒吧风）
  const IDLE_LINES = [
    'Your move, handsome~',
    'Pick one, if you dare~',
    "Come on, don't be shy~",
    'Feeling lucky tonight?~',
    'Rock, paper, or scissors?~',
  ];
  const WIN_SUBS = ['Well played, cutie~', 'Lucky hands indeed~', 'Okay… that impressed me~'];
  const LOSE_SUBS = ['Better luck next time, sweetheart~', 'The house always wins~', 'Try again, tiger~'];
  const TIE_SUBS = ['Great minds think alike~', 'Stop copying me~', "We're too alike, hmm~"];

  const els = {
    you: document.getElementById('scoreYou'),
    priya: document.getElementById('scorePriya'),
    stage: document.getElementById('stage'),
    bubble: document.getElementById('bubble'),
    chant: document.getElementById('chant'),
    result: document.getElementById('result'),
    resultTitle: document.getElementById('resultTitle'),
    resultSub: document.getElementById('resultSub'),
    handYou: document.getElementById('handYou'),
    handPriya: document.getElementById('handPriya'),
    buttons: Array.from(document.querySelectorAll('.choice')),
    flare: document.getElementById('flare'),
  };

  let state = 'idle'; // idle | shaking | result
  let score = loadScore();
  let priyaHistory = [];
  let talkTimer = null;

  function loadScore() {
    try {
      return { you: 0, tie: 0, priya: 0, ...JSON.parse(localStorage.getItem('luckyHandsScore') || '{}') };
    } catch {
      return { you: 0, tie: 0, priya: 0 };
    }
  }

  function saveScore() {
    localStorage.setItem('luckyHandsScore', JSON.stringify(score));
  }

  function renderScore() {
    els.you.textContent = score.you;
    els.priya.textContent = score.priya;
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- 视频状态机：4 路视频池常驻，交叉淡化切换 + 烛光光效 ----------
  const videos = {};
  document.querySelectorAll('.arch [data-video]').forEach((v) => {
    videos[v.dataset.video] = v;
  });

  let activeVideo = null;
  let reactionTimer = null;

  function flashFlare() {
    retrigger(els.flare, 'go');
  }

  function showVideo(name, { flare = false } = {}) {
    const next = videos[name];
    if (!next) return;
    if (flare) flashFlare();

    if (name !== 'idle') next.currentTime = 0; // 反应视频每次从头播

    next.play().catch(() => {});
    next.classList.add('active');

    const old = activeVideo;
    activeVideo = next;
    if (old && old !== next) {
      // 等交叉淡化结束再停掉旧视频
      setTimeout(() => {
        if (activeVideo !== old) {
          old.classList.remove('active');
          old.pause();
        }
      }, 380);
    }
  }

  function react(outcome) {
    clearTimeout(reactionTimer);
    showVideo(outcome, { flare: true });
    // 反应视频约 4s，播完自动回到待机循环
    reactionTimer = setTimeout(() => showVideo('idle'), 4000);
  }

  ['win', 'lose', 'tie'].forEach((n) => {
    videos[n].addEventListener('ended', () => {
      if (activeVideo === videos[n]) showVideo('idle');
    });
  });

  // Priya 出拳带一点"人味"：不会连续 3 次出同一个拳
  function priyaPick() {
    const lastTwo = priyaHistory.slice(-2);
    let pool = CHOICES;
    if (lastTwo.length === 2 && lastTwo[0] === lastTwo[1]) {
      pool = CHOICES.filter((c) => c !== lastTwo[0]);
    }
    const choice = pick(pool);
    priyaHistory.push(choice);
    if (priyaHistory.length > 4) priyaHistory.shift();
    return choice;
  }

  // 重启 CSS 动画的小技巧：移除类 → 强制回流 → 加回类
  function retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // 她开口说话时，立绘轻微呼吸浮动
  function talk() {
    els.stage.classList.add('talking');
    clearTimeout(talkTimer);
    talkTimer = setTimeout(() => els.stage.classList.remove('talking'), 2400);
  }

  function say(text) {
    // 波浪号前加不换行空格，避免小屏折行时 "~" 单独掉到第二行
    els.bubble.textContent = text.replace(/~/g, '\u00A0~');
    retrigger(els.bubble, 'pop');
    talk();
  }

  function chant(text) {
    els.chant.textContent = text;
    retrigger(els.chant, 'show');
  }

  function setHand(el, choice) {
    el.textContent = EMOJI[choice];
    retrigger(el, 'pop');
  }

  function setButtons(enabled) {
    els.buttons.forEach((b) => (b.disabled = !enabled));
  }

  function showResult(kind, title, sub) {
    els.resultTitle.textContent = title;
    els.resultSub.textContent = sub;
    els.result.className = 'result ' + kind;
    void els.result.offsetWidth;
    els.result.classList.add('show');
  }

  function hideResult() {
    els.result.classList.remove('show');
  }

  function play(playerChoice) {
    if (state !== 'idle') return;
    state = 'shaking';
    setButtons(false);
    hideResult();
    els.bubble.classList.add('hide');

    AudioFX.playVoice('countdown');
    CHANTS.forEach((word, i) =>
      setTimeout(() => {
        chant(word);
        AudioFX.tick();
      }, i * 450));

    setTimeout(() => resolve(playerChoice), CHANTS.length * 450 + 150);
  }

  function resolve(playerChoice) {
    els.chant.classList.remove('show');

    // 亮拳音效：挥动 + 烛光闪 + 弹出
    AudioFX.whoosh();
    AudioFX.shimmer();
    setTimeout(() => AudioFX.pop(), 130);

    const priyaChoice = priyaPick();
    setHand(els.handPriya, priyaChoice);
    setHand(els.handYou, playerChoice);

    let outcome;
    if (playerChoice === priyaChoice) outcome = 'tie';
    else if (BEATS[playerChoice] === priyaChoice) outcome = 'win';
    else outcome = 'lose';

    const TITLES = { win: 'You Win!', lose: 'Priya Wins!', tie: 'Tie!' };
    const SUBS = { win: WIN_SUBS, lose: LOSE_SUBS, tie: TIE_SUBS };
    const STINGS = { win: AudioFX.stingWin, lose: AudioFX.stingLose, tie: AudioFX.stingTie };
    const SCORE_KEY = { win: 'you', lose: 'priya', tie: 'tie' };

    score[SCORE_KEY[outcome]]++;
    const idx = Math.floor(Math.random() * SUBS[outcome].length);
    const line = SUBS[outcome][idx];

    showResult(outcome, TITLES[outcome], line);
    react(outcome);
    talk();

    // 结果音效 + 语音台词（语音文件与文本一一对应）
    setTimeout(() => STINGS[outcome](), 320);
    setTimeout(() => AudioFX.playVoice(outcome + (idx + 1)), 560);

    saveScore();
    renderScore();
    state = 'result';

    setTimeout(() => {
      hideResult();
      setButtons(true);
      state = 'idle';
      els.bubble.classList.remove('hide');
      setTimeout(() => say(pick(IDLE_LINES)), 200);
    }, 2200);
  }

  let lastAction = Date.now();
  els.buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      lastAction = Date.now();
      AudioFX.click();
      play(btn.dataset.choice);
    });
  });

  // 待机超过 7 秒没出拳，Priya 主动搭话（气泡与语音同一条台词）
  setInterval(() => {
    if (state !== 'idle' || Date.now() - lastAction < 7000) return;
    lastAction = Date.now();
    const i = Math.floor(Math.random() * IDLE_LINES.length);
    say(IDLE_LINES[i]);
    AudioFX.playVoice('idle' + (i + 1));
  }, 1000);

  // 静音开关
  const muteBtn = document.getElementById('muteBtn');
  const renderMute = () => {
    muteBtn.textContent = AudioFX.isMuted() ? '🔇' : '🔊';
  };
  muteBtn.addEventListener('click', () => {
    AudioFX.toggleMute();
    renderMute();
  });
  renderMute();

  // 启动：强制缓冲所有视频（反应视频隐身播一帧再暂停，保证切换零延迟）
  Object.values(videos).forEach((v) => {
    v.load();
    if (v.dataset.video !== 'idle') {
      v.play().then(() => {
        if (activeVideo !== v) v.pause();
      }).catch(() => {});
    }
  });
  showVideo('idle');

  renderScore();
  say(pick(IDLE_LINES));
})();
