// game.js — ゲームエンジン本体（ステージ制・10ステージ）

const Game = {
  // 状態
  state: 'title', // title | game | result
  vehicle: null,
  stage: 1,
  combo: 0,
  maxCombo: 0,
  perfectCount: 0,
  goodCount: 0,
  missCount: 0,

  // ゲームプレイ状態
  sequence: [],
  gameStartTime: 0,
  isJumping: false,
  jumpStartTime: 0,
  norinoriLevel: 0,
  obstacles: [],
  particles: [],
  animFrame: null,
  titleAnimFrame: null,
  readyTimeouts: [],
  judgeFeedbackTimer: null,
  roundDuration: 0,
  roundProgress: 0,
  stageParams: null,

  // 進捗
  bestStage: 0,

  // DOM要素キャッシュ
  els: {},

  // 定数
  JUMP_DURATION: 700,
  JUMP_HEIGHT: 110,
  VEHICLE_X_RATIO: 0.25,
  VEHICLE_HITBOX_W: 20,
  OBSTACLE_HITBOX_W: 15,
  OBSTACLE_HITBOX_H: 40,
  BIG_OBSTACLE_HITBOX_H: 70, // px 大障害物の当たり判定高さ（110のジャンプで余裕あり）

  init() {
    this.cacheElements();
    this.loadProgress();
    this.bindEvents();
    this.showScreen('title');
    this.animateTitle();
  },

  cacheElements() {
    this.els = {
      screens: {
        title: document.getElementById('screen-title'),
        game: document.getElementById('screen-game'),
        result: document.getElementById('screen-result'),
      },
      title: {
        playBtn: document.getElementById('btn-play'),
        parade: document.getElementById('title-parade'),
      },
      game: {
        vehicleEmoji: document.getElementById('game-vehicle'),
        vehicleContainer: document.getElementById('vehicle-container'),
        obstacleLayer: document.getElementById('obstacle-layer'),
        bgFar: document.getElementById('bg-far'),
        bgNear: document.getElementById('bg-near'),
        ground: document.getElementById('ground'),
        stageLabel: document.getElementById('stage-label'),
        vehicleLabel: document.getElementById('vehicle-label'),
        comboCount: document.getElementById('combo-count'),
        comboContainer: document.getElementById('combo-container'),
        progressBar: document.getElementById('progress-fill'),
        judgeFeedback: document.getElementById('judge-feedback'),
        tapArea: document.getElementById('tap-area'),
        homeBtn: document.getElementById('btn-home'),
        gameField: document.getElementById('game-field'),
        readyOverlay: document.getElementById('ready-overlay'),
        readyText: document.getElementById('ready-text'),
        goalOverlay: document.getElementById('goal-overlay'),
        goalEmoji: document.getElementById('goal-emoji'),
        goalText: document.getElementById('goal-text'),
      },
      result: {
        vehicleEmoji: document.getElementById('result-vehicle'),
        vehicleName: document.getElementById('result-vehicle-name'),
        maxCombo: document.getElementById('result-combo'),
        clearRate: document.getElementById('result-clear-rate'),
        perfectNum: document.getElementById('result-perfect'),
        goodNum: document.getElementById('result-good'),
        missNum: document.getElementById('result-miss'),
        rank: document.getElementById('result-rank'),
        nextBtn: document.getElementById('btn-next'),
        retryBtn: document.getElementById('btn-retry'),
      },
    };
  },

  bindEvents() {
    // タイトル
    this.els.title.playBtn.addEventListener('click', () => {
      AudioEngine.init();
      AudioEngine.resume();
      AudioEngine.stopTitleBGM();
      AudioEngine.playClickSound();
      this.stopTitleAnimation();
      this.startFromStage(1);
    });

    // タイトルBGM（どのインタラクションでも即座に開始）
    const startTitleBGM = () => {
      AudioEngine.init();
      AudioEngine.resume();
      AudioEngine.startTitleBGM();
      document.removeEventListener('click', startTitleBGM);
      document.removeEventListener('touchstart', startTitleBGM);
      document.removeEventListener('keydown', startTitleBGM);
    };
    document.addEventListener('click', startTitleBGM);
    document.addEventListener('touchstart', startTitleBGM);
    document.addEventListener('keydown', startTitleBGM);

    // ゲーム中タップ
    let touchHandled = false;
    this.els.game.tapArea.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchHandled = true;
      this.onTap();
    }, { passive: false });
    this.els.game.tapArea.addEventListener('click', (e) => {
      e.preventDefault();
      if (touchHandled) { touchHandled = false; return; }
      this.onTap();
    });

    // スペースキー
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'title') {
          this.els.title.playBtn.click();
        } else if (this.state === 'game') {
          this.onTap();
        } else if (this.state === 'result') {
          this.els.result.nextBtn.click();
        }
      }
    });

    // ホームボタン
    this.els.game.homeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioEngine.playClickSound();
      this.stopGame();
      this.showScreen('title');
    });

    // リザルト
    this.els.result.nextBtn.addEventListener('click', () => {
      AudioEngine.playClickSound();
      if (this.stage < COURSES.TOTAL_STAGES) {
        this.startFromStage(this.stage + 1);
      } else {
        this.showScreen('title');
      }
    });
    this.els.result.retryBtn.addEventListener('click', () => {
      AudioEngine.playClickSound();
      this.startFromStage(this.stage);
    });
  },

  // === 画面管理 ===

  showScreen(name) {
    this.state = name;
    Object.values(this.els.screens).forEach(el => el.classList.remove('active'));
    this.els.screens[name].classList.add('active');

    if (name === 'title') {
      document.body.style.background = 'linear-gradient(135deg, #a8d8ea 0%, #f8c8dc 50%, #ffeaa7 100%)';
      this.animateTitle();
      AudioEngine.startTitleBGM();
    } else {
      AudioEngine.stopTitleBGM();
    }
  },

  // === タイトル画面 ===

  animateTitle() {
    const parade = this.els.title.parade;
    const emojis = COURSES.vehicles.map(v => v.emoji);
    parade.textContent = emojis.join('  ');

    let pos = window.innerWidth;
    const animate = () => {
      pos -= 1.5;
      if (pos < -parade.offsetWidth) pos = window.innerWidth;
      parade.style.transform = `translateX(${pos}px)`;
      this.titleAnimFrame = requestAnimationFrame(animate);
    };
    animate();
  },

  stopTitleAnimation() {
    if (this.titleAnimFrame) {
      cancelAnimationFrame(this.titleAnimFrame);
      this.titleAnimFrame = null;
    }
  },

  // === ステージ開始 ===

  startFromStage(stage) {
    this.stage = stage;
    this.vehicle = COURSES.getStageVehicle(stage);
    this.stageParams = COURSES.getStageParams(stage);
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.norinoriLevel = 0;

    this.showScreen('game');
    this.applyTheme(this.vehicle);
    this.startStage();
  },

  applyTheme(vehicle) {
    const isDark = vehicle.id === 'police' || vehicle.id === 'racecar';
    document.body.style.background = `linear-gradient(180deg, ${vehicle.bgColor1} 0%, ${vehicle.bgColor2} 100%)`;

    this.els.game.vehicleEmoji.textContent = vehicle.emoji;
    this.els.game.vehicleEmoji.style.display = 'inline-block';
    this.els.game.vehicleEmoji.style.transform = vehicle.flipX ? 'scaleX(-1)' : 'none';
    this.els.game.ground.style.backgroundColor = vehicle.groundColor;

    this.setupBackgroundEmojis(vehicle);

    const gameScreen = this.els.screens.game;
    if (isDark) {
      gameScreen.classList.add('dark-theme');
    } else {
      gameScreen.classList.remove('dark-theme');
    }
  },

  setupBackgroundEmojis(vehicle) {
    const bgFar = this.els.game.bgFar;
    const bgNear = this.els.game.bgNear;
    bgFar.innerHTML = '';
    bgNear.innerHTML = '';

    for (let i = 0; i < 8; i++) {
      const span = document.createElement('span');
      span.className = 'bg-emoji far';
      span.textContent = vehicle.bgEmojis[i % vehicle.bgEmojis.length];
      span.style.left = `${i * 13 + Math.random() * 5}%`;
      span.style.bottom = `${10 + Math.random() * 30}%`;
      span.style.fontSize = `${1.2 + Math.random() * 0.8}rem`;
      span.style.opacity = '0.4';
      bgFar.appendChild(span);
    }

    for (let i = 0; i < 5; i++) {
      const span = document.createElement('span');
      span.className = 'bg-emoji near';
      span.textContent = vehicle.bgEmojis[i % vehicle.bgEmojis.length];
      span.style.left = `${i * 20 + Math.random() * 10}%`;
      span.style.bottom = `${25 + Math.random() * 15}%`;
      span.style.fontSize = `${1.8 + Math.random() * 1}rem`;
      span.style.opacity = '0.25';
      bgNear.appendChild(span);
    }
  },

  // === ステージ管理 ===

  startStage() {
    this.sequence = MelodyGenerator.generate(this.vehicle, this.stageParams);
    this.roundDuration = MelodyGenerator.getRoundDuration(this.sequence);
    this.obstacles = [];
    this.particles = [];
    this.isJumping = false;
    this.roundProgress = 0;

    // UI更新
    this.els.game.stageLabel.textContent = `ステージ ${this.stage} / ${COURSES.TOTAL_STAGES}`;
    this.els.game.vehicleLabel.textContent = `${this.vehicle.emoji} ${this.vehicle.name}`;
    this.updateHUD();
    this.clearObstacleLayer();

    this.showReadyAnimation();
  },

  showReadyAnimation() {
    const overlay = this.els.game.readyOverlay;
    const text = this.els.game.readyText;

    overlay.classList.add('show');
    this._setReadyText(text, `ステージ ${this.stage}`);

    const steps = [
      [700, `${this.vehicle.emoji} ${this.vehicle.name}`],
      [1400, 'さあ いくよ！'],
      [2000, '3'],
      [2300, '2'],
      [2600, '1'],
      [2900, 'GO!'],
    ];

    steps.forEach(([delay, msg]) => {
      const tid = setTimeout(() => this._setReadyText(text, msg), delay);
      this.readyTimeouts.push(tid);
    });

    const finalTid = setTimeout(() => {
      overlay.classList.remove('show');
      this.beginPlay();
    }, 3300);
    this.readyTimeouts.push(finalTid);
  },

  _setReadyText(el, msg) {
    el.textContent = msg;
    el.classList.remove('animate');
    void el.offsetWidth;
    el.classList.add('animate');
  },

  beginPlay() {
    AudioEngine.startBacking(this.vehicle, this.stageParams.bpm);
    this.gameStartTime = AudioEngine.getCurrentTime();
    this.spawnAllObstacles();
    this.gameLoop();
  },

  // === 障害物生成 ===

  spawnAllObstacles() {
    const fieldWidth = this.els.game.gameField.offsetWidth;
    this.obstacles = [];

    this.sequence.forEach((note, idx) => {
      this.obstacles.push({
        time: note.time,
        x: fieldWidth + 50,
        cleared: false,
        judged: false,
        big: note.big || false,
        freq: note.freq,
        note: note.note,
        waveType: this.vehicle.waveType,
        duration: note.duration,
        el: null,
        idx: idx,
      });
    });
  },

  // === ゲームループ ===

  gameLoop() {
    if (this.state !== 'game') return;

    const now = AudioEngine.getCurrentTime();
    const elapsed = now - this.gameStartTime;
    const fieldWidth = this.els.game.gameField.offsetWidth;
    const vehicleX = fieldWidth * this.VEHICLE_X_RATIO;
    const approachTime = this.stageParams.approachTime;

    // ノリノリ速度倍率
    const speedMult = this.norinoriLevel === 2 ? 1.3 : this.norinoriLevel === 1 ? 1.15 : 1.0;

    // プログレス更新
    this.roundProgress = Math.min(1, elapsed / this.roundDuration);
    this.els.game.progressBar.style.width = `${this.roundProgress * 100}%`;

    // 背景スクロール
    const scrollSpeed = this.stageParams.scrollSpeed;
    const scrollOffset = elapsed * scrollSpeed * speedMult;
    const bgFarOffset = (scrollOffset * 0.3) % (fieldWidth * 2);
    const bgNearOffset = (scrollOffset * 0.6) % (fieldWidth * 2);
    this.els.game.bgFar.style.transform = `translateX(${-bgFarOffset}px)`;
    this.els.game.bgNear.style.transform = `translateX(${-bgNearOffset}px)`;
    this.els.game.ground.style.backgroundPosition = `${-scrollOffset}px 0`;

    // 障害物位置更新
    this.obstacles.forEach(obs => {
      const timeUntilHit = obs.time - elapsed;
      obs.x = vehicleX + (timeUntilHit / approachTime) * (fieldWidth - vehicleX);

      if (!obs.el) {
        obs.el = this.createObstacleElement(obs);
        this.els.game.obstacleLayer.appendChild(obs.el);
      }

      obs.el.style.transform = `translateX(${obs.x}px)`;

      if (obs.judged && obs.cleared) {
        obs.el.style.opacity = '0.35';
      } else if (obs.judged && !obs.cleared) {
        obs.el.style.opacity = '0.5';
      }

      // 光るリング効果
      const proximity = 1 - Math.min(1, Math.abs(timeUntilHit) / approachTime);
      const ring = obs.el.querySelector('.obs-ring');
      if (ring) {
        ring.style.opacity = obs.judged ? 0 : proximity * 0.8;
        ring.style.transform = `scale(${1 + proximity * 0.3})`;
      }

      // 位置ベース当たり判定（障害物が乗り物の真横に来た時のみ）
      if (!obs.judged) {
        // 障害物が乗り物を通過中かどうか（狭い判定幅）
        const dx = obs.x - vehicleX;
        const hitboxRange = 10; // px — 非常に狭い判定幅

        // 障害物が判定ゾーンに入った
        if (Math.abs(dx) < hitboxRange) {
          const vehicleY = this.getCurrentJumpHeight();
          const hitH = obs.big ? this.BIG_OBSTACLE_HITBOX_H : this.OBSTACLE_HITBOX_H;

          // ジャンプのフェーズ判定
          const jumpElapsed = performance.now() - this.jumpStartTime;
          const jumpT = this.isJumping ? jumpElapsed / this.JUMP_DURATION : 1;
          // 下降中（ピークの60%以降）は判定が厳しい
          const isDescending = this.isJumping && jumpT > 0.5;
          // 着地直前（80%以降）はほぼミス確定
          const isLanding = this.isJumping && jumpT > 0.75;

          if (!this.isJumping || isLanding) {
            // 地上または着地直前→ミス
            this.judgeNote(obs, 'miss');
          } else if (vehicleY > hitH) {
            if (obs.big) {
              // 大障害物: 下降中でも高さがあればgood、上昇中はperfect可能
              if (isDescending) {
                this.judgeNote(obs, 'good');
              } else {
                this.judgeNote(obs, vehicleY > this.JUMP_HEIGHT * 0.7 ? 'perfect' : 'good');
              }
            } else {
              // 通常障害物: 従来通り
              if (isDescending) {
                this.judgeNote(obs, 'good');
              } else {
                this.judgeNote(obs, vehicleY > this.JUMP_HEIGHT * 0.8 ? 'perfect' : 'good');
              }
            }
          } else {
            this.judgeNote(obs, 'miss');
          }
        }

        // 障害物が完全に通り過ぎた場合もミス
        if (!obs.judged && dx < -hitboxRange) {
          this.judgeNote(obs, 'miss');
        }
      }
    });

    // ジャンプアニメーション
    this.updateJumpAnimation();

    // ステージ終了チェック
    if (elapsed >= this.roundDuration) {
      this.endStage();
      return;
    }

    this.animFrame = requestAnimationFrame(() => this.gameLoop());
  },

  // === 要素生成 ===

  createObstacleElement(obs) {
    const el = document.createElement('div');
    el.className = obs.big ? 'obstacle big' : 'obstacle normal';
    el.innerHTML = `
      <div class="obs-ring"></div>
      <span class="obs-emoji">${this.vehicle.obstacle}</span>
    `;
    return el;
  },

  clearObstacleLayer() {
    this.els.game.obstacleLayer.innerHTML = '';
  },

  // === タップ処理 ===

  onTap() {
    if (this.state !== 'game') return;
    AudioEngine.resume();
    if (this.isJumping) return;

    this.isJumping = true;
    this.jumpStartTime = performance.now();
    AudioEngine.playJumpSound();
    this.els.game.vehicleContainer.classList.add('jumping');
  },

  getCurrentJumpHeight() {
    if (!this.isJumping) return 0;
    const elapsed = performance.now() - this.jumpStartTime;
    const t = Math.min(1, elapsed / this.JUMP_DURATION);
    const peak = 0.42;
    let height;
    if (t <= peak) {
      const p = t / peak;
      height = Math.sin(p * Math.PI / 2);
    } else if (t <= 0.65) {
      height = 1;
    } else {
      const p = (t - 0.65) / 0.35;
      height = Math.cos(p * Math.PI / 2);
    }
    return height * this.JUMP_HEIGHT;
  },

  // === 判定処理 ===

  judgeNote(obs, result) {
    obs.judged = true;

    if (result === 'perfect' || result === 'good') {
      obs.cleared = true;
      this.combo++;
      if (result === 'perfect') this.perfectCount++;
      else this.goodCount++;
      AudioEngine.playNote(obs.freq, obs.waveType, obs.duration, undefined);

      if (this.combo >= 3) {
        this.showJudgeFeedback(`🔥 ${this.combo}つれんぞく！`, 'combo');
      } else {
        this.showJudgeFeedback('✨ ナイス！', 'good');
      }
      this.spawnParticle(obs.x, '✨');
    } else {
      obs.cleared = false;
      this.missCount++;
      this.combo = 0;
      this.norinoriLevel = 0;
      AudioEngine.playMissSound();
      this.showJudgeFeedback('💦 おしい...', 'miss');
      this.els.game.vehicleContainer.classList.add('shake');
      setTimeout(() => this.els.game.vehicleContainer.classList.remove('shake'), 300);
    }

    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // ノリノリモード
    if (this.combo >= 10 && this.norinoriLevel < 2) {
      this.norinoriLevel = 2;
      AudioEngine.playFeverSound();
      this.els.game.gameField.classList.remove('norinori-1');
      this.els.game.gameField.classList.add('norinori-2');
    } else if (this.combo >= 5 && this.norinoriLevel < 1) {
      this.norinoriLevel = 1;
      this.els.game.gameField.classList.add('norinori-1');
    }

    if (this.combo === 0) {
      this.els.game.gameField.classList.remove('norinori-1', 'norinori-2');
    }

    this.updateHUD();
  },

  showJudgeFeedback(text, type) {
    if (this.judgeFeedbackTimer) clearTimeout(this.judgeFeedbackTimer);
    const el = this.els.game.judgeFeedback;
    el.textContent = text;
    el.className = `judge-feedback show ${type}`;
    this.judgeFeedbackTimer = setTimeout(() => {
      el.classList.remove('show');
      this.judgeFeedbackTimer = null;
    }, 600);
  },

  // === ジャンプアニメーション ===

  updateJumpAnimation() {
    if (!this.isJumping) return;

    const jumpElapsed = performance.now() - this.jumpStartTime;

    if (jumpElapsed >= this.JUMP_DURATION) {
      this.isJumping = false;
      this.els.game.vehicleContainer.classList.remove('jumping');
      this.els.game.vehicleContainer.style.transform = `translateX(-50%) translateY(0)`;
    } else {
      const height = this.getCurrentJumpHeight();
      const t = jumpElapsed / this.JUMP_DURATION;
      let scaleX = 1, scaleY = 1;
      if (t < 0.08) {
        scaleX = 1.08; scaleY = 0.92;
      } else if (t < 0.2) {
        scaleX = 0.95; scaleY = 1.05;
      } else if (t > 0.88) {
        scaleX = 1.06; scaleY = 0.94;
      }
      this.els.game.vehicleContainer.style.transform = `translateX(-50%) translateY(${-height}px) scaleX(${scaleX}) scaleY(${scaleY})`;
    }
  },

  // === パーティクル ===

  spawnParticle(x, emoji) {
    const el = document.createElement('div');
    el.className = 'particle';
    el.textContent = emoji;
    el.style.left = `${x}px`;
    el.style.bottom = '120px';
    this.els.game.obstacleLayer.appendChild(el);
    setTimeout(() => el.remove(), 800);
  },

  // === HUD更新 ===

  updateHUD() {
    this.els.game.comboCount.textContent = this.combo;
    if (this.combo >= 5) {
      this.els.game.comboContainer.classList.add('hot');
    } else {
      this.els.game.comboContainer.classList.remove('hot');
    }
  },

  // === ステージ終了 ===

  endStage() {
    AudioEngine.stopBacking();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);

    const judgedObs = this.obstacles.filter(o => o.judged);
    const allCleared = judgedObs.length > 0 && judgedObs.every(o => o.cleared);

    if (allCleared) {
      this.showAllClearEffect(() => this.showGoalAndResult());
    } else {
      this.showGoalAndResult();
    }
  },

  showGoalAndResult() {
    AudioEngine.playGoalSound();
    const overlay = this.els.game.goalOverlay;
    this.els.game.goalEmoji.textContent = this.vehicle.goalEmoji;
    this.els.game.goalText.textContent = this.vehicle.goalText;
    this.els.game.goalText.className = 'goal-text';
    overlay.classList.add('show');

    const tid = setTimeout(() => {
      overlay.classList.remove('show');
      this.showResult();
    }, 2500);
    this.readyTimeouts.push(tid);
  },

  showAllClearEffect(callback) {
    const overlay = this.els.game.goalOverlay;
    this.els.game.goalEmoji.textContent = '🌟';
    this.els.game.goalText.textContent = 'パーフェクト！';
    this.els.game.goalText.className = 'goal-text perfect-flash';
    overlay.classList.add('show');
    AudioEngine.playPerfectSound();

    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const x = Math.random() * (this.els.game.gameField.offsetWidth);
        this.spawnParticle(x, ['✨', '🌟', '🎉', '✨'][i % 4]);
      }, i * 100);
    }

    const tid = setTimeout(() => {
      overlay.classList.remove('show');
      this.els.game.goalText.className = 'goal-text';
      callback();
    }, 2000);
    this.readyTimeouts.push(tid);
  },

  // === リザルト ===

  showResult() {
    this.clearObstacleLayer();
    this.els.game.gameField.classList.remove('norinori-1', 'norinori-2');

    // 進捗保存
    if (this.stage > this.bestStage) {
      this.bestStage = this.stage;
      this.saveProgress();
    }

    const total = this.perfectCount + this.goodCount + this.missCount;
    const clearRate = total > 0 ? Math.round(((this.perfectCount + this.goodCount) / total) * 100) : 0;

    this.els.result.vehicleEmoji.textContent = this.vehicle.emoji;
    this.els.result.vehicleName.textContent = `ステージ ${this.stage} — ${this.vehicle.name}`;
    this.els.result.maxCombo.textContent = this.maxCombo;
    this.els.result.clearRate.textContent = `${clearRate}%`;
    this.els.result.perfectNum.textContent = this.perfectCount;
    this.els.result.goodNum.textContent = this.goodCount;
    this.els.result.missNum.textContent = this.missCount;

    if (this.missCount === 0) {
      this.els.result.rank.textContent = '🌟 パーフェクト！';
      this.els.result.rank.className = 'result-rank rank-perfect';
    } else if (clearRate >= 70) {
      this.els.result.rank.textContent = '🎉 すごい！';
      this.els.result.rank.className = 'result-rank rank-great';
    } else {
      this.els.result.rank.textContent = '😊 がんばったね！';
      this.els.result.rank.className = 'result-rank rank-good';
    }

    // 次のステージボタン
    if (this.stage < COURSES.TOTAL_STAGES) {
      const nextVehicle = COURSES.getStageVehicle(this.stage + 1);
      this.els.result.nextBtn.textContent = `▶️ つぎ: ${nextVehicle.emoji} ${nextVehicle.name}`;
      this.els.result.nextBtn.style.display = '';
    } else {
      this.els.result.nextBtn.textContent = '🏠 おわり';
      this.els.result.nextBtn.style.display = '';
    }

    this.showScreen('result');
  },

  // === ゲーム停止 ===

  stopGame() {
    AudioEngine.stopBacking();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.readyTimeouts.forEach(tid => clearTimeout(tid));
    this.readyTimeouts = [];
    if (this.judgeFeedbackTimer) { clearTimeout(this.judgeFeedbackTimer); this.judgeFeedbackTimer = null; }
    this.els.game.readyOverlay.classList.remove('show');
    this.els.game.goalOverlay.classList.remove('show');
    this.clearObstacleLayer();
    this.els.game.gameField.classList.remove('norinori-1', 'norinori-2');
  },

  // === 進捗管理 ===

  loadProgress() {
    try {
      const saved = localStorage.getItem('vrr-progress');
      if (saved) {
        const data = JSON.parse(saved);
        this.bestStage = data.bestStage || 0;
      }
    } catch {
      this.bestStage = 0;
    }
  },

  saveProgress() {
    try {
      localStorage.setItem('vrr-progress', JSON.stringify({
        bestStage: this.bestStage,
      }));
    } catch {
      // localStorage unavailable
    }
  },
};

document.addEventListener('DOMContentLoaded', () => Game.init());
