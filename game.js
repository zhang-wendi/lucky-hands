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
    tie: document.getElementById('scoreTie'),
    priya: document.getElementById('scorePriya'),
    handYou: document.getElementById('handYou'),
    handPriya: document.getElementById('handPriya'),
    bubble: document.getElementById('bubble'),
    reveal: document.getElementById('reveal'),
    banner: document.getElementById('banner'),
    bannerTitle: document.getElementById('bannerTitle'),
    bannerSub: document.getElementById('bannerSub'),
    buttons: Array.from(document.querySelectorAll('.choice')),
    flare: document.getElementById('flare'),
  };

  let state = 'idle'; // idle | shaking | result
  let score = loadScore();
  let priyaHistory = [];

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
    els.tie.textContent = score.tie;
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

    const isReaction = name !== 'idle';
    if (isReaction) next.currentTime = 0; // 反应视频每次从头播

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

  // 反应视频自然播完也回待机（timer 兜底）
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

  function say(text) {
    els.bubble.textContent = text;
    retrigger(els.bubble, 'pop');
  }

  function setHand(el, choice) {
    el.textContent = EMOJI[choice];
    retrigger(el, 'pop');
  }

  function setButtons(enabled) {
    els.buttons.forEach((b) => (b.disabled = !enabled));
  }

  function showBanner(kind, title, sub) {
    els.bannerTitle.textContent = title;
    els.bannerSub.textContent = sub;
    els.banner.className = 'banner ' + kind;
    void els.banner.offsetWidth;
    els.banner.classList.add('show');
    setTimeout(() => els.banner.classList.remove('show'), 1600);
  }

  function play(playerChoice) {
    if (state !== 'idle') return;
    state = 'shaking';
    setButtons(false);
    els.banner.classList.remove('show');
    els.handYou.textContent = EMOJI.rock;
    els.handPriya.textContent = EMOJI.rock;
    els.reveal.classList.add('shaking');

    AudioFX.playVoice('countdown');
    CHANTS.forEach((chant, i) =>
      setTimeout(() => {
        say(chant);
        AudioFX.tick();
      }, i * 450));
    setTimeout(() => resolve(playerChoice), CHANTS.length * 450 + 150);
  }

  function resolve(playerChoice) {
    els.reveal.classList.remove('shaking');

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

    const TITLES = { win: 'You Win! 🎉', lose: 'Priya Wins! 💋', tie: "It's a Tie! 😏" };
    const SUBS = { win: WIN_SUBS, lose: LOSE_SUBS, tie: TIE_SUBS };
    const STINGS = { win: AudioFX.stingWin, lose: AudioFX.stingLose, tie: AudioFX.stingTie };
    const SCORE_KEY = { win: 'you', lose: 'priya', tie: 'tie' };

    score[SCORE_KEY[outcome]]++;
    const idx = Math.floor(Math.random() * SUBS[outcome].length);
    const line = SUBS[outcome][idx];
    showBanner(outcome, TITLES[outcome], line);
    react(outcome);

    // 结果音效 + 语音台词（横幅弹出后依次进场；语音文件与气泡文本一一对应）
    setTimeout(() => STINGS[outcome](), 320);
    setTimeout(() => AudioFX.playVoice(outcome + (idx + 1)), 560);

    saveScore();
    renderScore();
    state = 'result';

    setTimeout(() => {
      say(pick(IDLE_LINES));
      setButtons(true);
      state = 'idle';
    }, 1900);
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
