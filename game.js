// game.js — ゲームエンジン本体（PixiJS版・10ステージ）

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
  shakeEndTime: 0,

  // 進捗
  bestStage: 0,

  // PixiJS
  app: null,
  pixi: {},
  vehicleSprite: null,

  // DOM要素キャッシュ
  els: {},

  // 定数
  JUMP_DURATION: 700,
  JUMP_HEIGHT: 110,
  VEHICLE_X_RATIO: 0.25,
  VEHICLE_HITBOX_W: 20,
  OBSTACLE_HITBOX_W: 15,
  OBSTACLE_HITBOX_H: 40,
  BIG_OBSTACLE_HITBOX_H: 70,

  init() {
    this.cacheElements();
    this.initPixi();
    this.loadProgress();
    this.bindEvents();
    this.showScreen('title');
    this.animateTitle();
  },

  initPixi() {
    const gameField = this.els.game.gameField;
    this.app = new PIXI.Application({
      resizeTo: gameField,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    const view = this.app.view;
    view.style.position = 'absolute';
    view.style.top = '0';
    view.style.left = '0';
    view.style.width = '100%';
    view.style.height = '100%';
    view.style.pointerEvents = 'none';
    view.style.zIndex = '1';
    gameField.insertBefore(view, gameField.firstChild);

    // レイヤー（z順）
    this.pixi.bgFar = new PIXI.Container();
    this.pixi.bgNear = new PIXI.Container();
    this.pixi.ground = new PIXI.Graphics();
    this.pixi.obstacleLayer = new PIXI.Container();
    this.pixi.vehicleContainer = new PIXI.Container();
    this.pixi.particleLayer = new PIXI.Container();

    this.app.stage.addChild(this.pixi.bgFar);
    this.app.stage.addChild(this.pixi.bgNear);
    this.app.stage.addChild(this.pixi.ground);
    this.app.stage.addChild(this.pixi.obstacleLayer);
    this.app.stage.addChild(this.pixi.vehicleContainer);
    this.app.stage.addChild(this.pixi.particleLayer);

    // 乗り物スプライト
    this.vehicleSprite = new PIXI.Text('\u{1F683}', { fontSize: 48 });
    this.vehicleSprite.anchor.set(0.5, 1);
    this.pixi.vehicleContainer.addChild(this.vehicleSprite);
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
        gameField: document.getElementById('game-field'),
        stageLabel: document.getElementById('stage-label'),
        vehicleLabel: document.getElementById('vehicle-label'),
        comboCount: document.getElementById('combo-count'),
        comboContainer: document.getElementById('combo-container'),
        progressBar: document.getElementById('progress-fill'),
        judgeFeedback: document.getElementById('judge-feedback'),
        tapArea: document.getElementById('tap-area'),
        homeBtn: document.getElementById('btn-home'),
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

    // タイトルBGM
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

    // 乗り物スプライト更新
    const vSize = this._responsiveSize(40, 0.08, 64);
    this.vehicleSprite.text = vehicle.emoji;
    this.vehicleSprite.style.fontSize = vSize;
    this.vehicleSprite.scale.x = vehicle.flipX ? -1 : 1;

    // 地面
    this._drawGround(vehicle.groundColor);

    // 背景絵文字
    this.setupBackgroundEmojis(vehicle);

    const gameScreen = this.els.screens.game;
    if (isDark) {
      gameScreen.classList.add('dark-theme');
    } else {
      gameScreen.classList.remove('dark-theme');
    }
  },

  _drawGround(cssColor) {
    const g = this.pixi.ground;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    g.clear();
    g.beginFill(this._cssToHex(cssColor));
    g.drawRect(0, h * 0.75, w, h * 0.25);
    g.endFill();
  },

  _cssToHex(color) {
    return parseInt(color.replace('#', ''), 16);
  },

  _responsiveSize(min, ratio, max) {
    const w = this.app ? this.app.screen.width : window.innerWidth;
    return Math.min(max, Math.max(min, w * ratio));
  },

  setupBackgroundEmojis(vehicle) {
    this.pixi.bgFar.removeChildren().forEach(c => c.destroy());
    this.pixi.bgNear.removeChildren().forEach(c => c.destroy());

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const totalW = w * 2;

    // 遠景レイヤー
    for (let i = 0; i < 8; i++) {
      const emoji = vehicle.bgEmojis[i % vehicle.bgEmojis.length];
      const size = 19 + Math.random() * 13;
      const text = new PIXI.Text(emoji, { fontSize: size });
      text.anchor.set(0.5, 1);
      text.x = (i * 0.13 + Math.random() * 0.05) * totalW;
      text.y = h * (0.6 + Math.random() * 0.1);
      text.alpha = 0.4;
      this.pixi.bgFar.addChild(text);
    }

    // 近景レイヤー
    for (let i = 0; i < 5; i++) {
      const emoji = vehicle.bgEmojis[i % vehicle.bgEmojis.length];
      const size = 29 + Math.random() * 16;
      const text = new PIXI.Text(emoji, { fontSize: size });
      text.anchor.set(0.5, 1);
      text.x = (i * 0.2 + Math.random() * 0.1) * totalW;
      text.y = h * (0.55 + Math.random() * 0.1);
      text.alpha = 0.25;
      this.pixi.bgNear.addChild(text);
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
    this.els.game.stageLabel.textContent = `\u30b9\u30c6\u30fc\u30b8 ${this.stage} / ${COURSES.TOTAL_STAGES}`;
    this.els.game.vehicleLabel.textContent = `${this.vehicle.emoji} ${this.vehicle.name}`;
    this.updateHUD();
    this.clearObstacleLayer();

    this.showReadyAnimation();
  },

  showReadyAnimation() {
    const overlay = this.els.game.readyOverlay;
    const text = this.els.game.readyText;

    overlay.classList.add('show');
    this._setReadyText(text, `\u30b9\u30c6\u30fc\u30b8 ${this.stage}`);

    const steps = [
      [700, `${this.vehicle.emoji} ${this.vehicle.name}`],
      [1400, '\u3055\u3042 \u3044\u304f\u3088\uff01'],
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
    const fieldWidth = this.app.screen.width;
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
        sprite: null,
        idx: idx,
      });
    });
  },

  // === ゲームループ ===

  gameLoop() {
    if (this.state !== 'game') return;

    const now = AudioEngine.getCurrentTime();
    const elapsed = now - this.gameStartTime;
    const fieldWidth = this.app.screen.width;
    const fieldHeight = this.app.screen.height;
    const vehicleX = fieldWidth * this.VEHICLE_X_RATIO;
    const approachTime = this.stageParams.approachTime;
    const groundY = fieldHeight * 0.75;

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
    this.pixi.bgFar.x = -bgFarOffset;
    this.pixi.bgNear.x = -bgNearOffset;

    // 障害物位置更新
    this.obstacles.forEach(obs => {
      const timeUntilHit = obs.time - elapsed;
      obs.x = vehicleX + (timeUntilHit / approachTime) * (fieldWidth - vehicleX);

      // スプライト未作成なら作成
      if (!obs.sprite) {
        obs.sprite = this._createObstacleSprite(obs);
      }

      obs.sprite.container.x = obs.x;
      obs.sprite.container.y = groundY;

      if (obs.judged && obs.cleared) {
        obs.sprite.container.alpha = 0.35;
      } else if (obs.judged && !obs.cleared) {
        obs.sprite.container.alpha = 0.5;
      }

      // リング効果
      const proximity = 1 - Math.min(1, Math.abs(timeUntilHit) / approachTime);
      obs.sprite.ring.alpha = obs.judged ? 0 : proximity * 0.8;
      obs.sprite.ring.scale.set(1 + proximity * 0.3);

      // 大障害物パルス
      if (obs.big && !obs.judged) {
        const pulse = 1 + 0.1 * Math.sin(performance.now() * 0.008 * Math.PI);
        obs.sprite.text.scale.set(pulse);
      }

      // 位置ベース当たり判定
      if (!obs.judged) {
        const dx = obs.x - vehicleX;
        const hitboxRange = 10;

        if (Math.abs(dx) < hitboxRange) {
          const vehicleY = this.getCurrentJumpHeight();
          const hitH = obs.big ? this.BIG_OBSTACLE_HITBOX_H : this.OBSTACLE_HITBOX_H;

          const jumpElapsed = performance.now() - this.jumpStartTime;
          const jumpT = this.isJumping ? jumpElapsed / this.JUMP_DURATION : 1;
          const isDescending = this.isJumping && jumpT > 0.5;
          const isLanding = this.isJumping && jumpT > 0.75;

          if (!this.isJumping || isLanding) {
            this.judgeNote(obs, 'miss');
          } else if (vehicleY > hitH) {
            if (obs.big) {
              if (isDescending) {
                this.judgeNote(obs, 'good');
              } else {
                this.judgeNote(obs, vehicleY > this.JUMP_HEIGHT * 0.7 ? 'perfect' : 'good');
              }
            } else {
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

        if (!obs.judged && dx < -hitboxRange) {
          this.judgeNote(obs, 'miss');
        }
      }
    });

    // 乗り物位置更新
    this._updateVehiclePosition(vehicleX, groundY);

    // パーティクル更新
    this._updateParticles();

    // ステージ終了チェック
    if (elapsed >= this.roundDuration) {
      this.endStage();
      return;
    }

    this.animFrame = requestAnimationFrame(() => this.gameLoop());
  },

  // === 障害物スプライト生成 ===

  _createObstacleSprite(obs) {
    const container = new PIXI.Container();
    const size = obs.big
      ? this._responsiveSize(45, 0.09, 64)
      : this._responsiveSize(29, 0.06, 40);

    const text = new PIXI.Text(this.vehicle.obstacle, { fontSize: size });
    text.anchor.set(0.5, 1);

    // リング
    const ring = new PIXI.Graphics();
    ring.lineStyle(3, 0xFFD700, 0.7);
    ring.drawCircle(0, -size * 0.5, size * 0.6);
    ring.alpha = 0;

    container.addChild(ring);
    container.addChild(text);

    // 大障害物グロー
    if (obs.big) {
      const glow = new PIXI.Graphics();
      glow.beginFill(0xFF3232, 0.15);
      glow.drawCircle(0, -size * 0.5, size * 0.8);
      glow.endFill();
      container.addChildAt(glow, 0);
    }

    this.pixi.obstacleLayer.addChild(container);
    return { container, text, ring };
  },

  clearObstacleLayer() {
    this.pixi.obstacleLayer.removeChildren().forEach(c => c.destroy({ children: true }));
    this.pixi.particleLayer.removeChildren().forEach(c => c.destroy());
    this.particles = [];
  },

  // === タップ処理 ===

  onTap() {
    if (this.state !== 'game') return;
    AudioEngine.resume();
    if (this.isJumping) return;

    this.isJumping = true;
    this.jumpStartTime = performance.now();
    AudioEngine.playJumpSound();
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

  // === 乗り物位置更新 ===

  _updateVehiclePosition(vehicleX, groundY) {
    let height = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (this.isJumping) {
      const jumpElapsed = performance.now() - this.jumpStartTime;
      if (jumpElapsed >= this.JUMP_DURATION) {
        this.isJumping = false;
      } else {
        height = this.getCurrentJumpHeight();
        const t = jumpElapsed / this.JUMP_DURATION;
        if (t < 0.08) {
          scaleX = 1.08; scaleY = 0.92;
        } else if (t < 0.2) {
          scaleX = 0.95; scaleY = 1.05;
        } else if (t > 0.88) {
          scaleX = 1.06; scaleY = 0.94;
        }
      }
    }

    // シェイク
    let shakeX = 0;
    if (performance.now() < this.shakeEndTime) {
      const remain = (this.shakeEndTime - performance.now()) / 300;
      shakeX = Math.sin(performance.now() * 0.03) * 5 * remain;
    }

    const flip = this.vehicle && this.vehicle.flipX ? -1 : 1;
    this.vehicleSprite.x = vehicleX + shakeX;
    this.vehicleSprite.y = groundY - height;
    this.vehicleSprite.scale.set(flip * scaleX, scaleY);
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
        this.showJudgeFeedback(`\u{1F525} ${this.combo}\u3064\u308c\u3093\u305e\u304f\uff01`, 'combo');
      } else {
        this.showJudgeFeedback('\u2728 \u30ca\u30a4\u30b9\uff01', 'good');
      }
      this.spawnParticle(obs.x, '\u2728');
    } else {
      obs.cleared = false;
      this.missCount++;
      this.combo = 0;
      this.norinoriLevel = 0;
      AudioEngine.playMissSound();
      this.showJudgeFeedback('\u{1F4A6} \u304a\u3057\u3044...', 'miss');
      this.shakeEndTime = performance.now() + 300;
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

  // === パーティクル ===

  spawnParticle(x, emoji) {
    const h = this.app.screen.height;
    const text = new PIXI.Text(emoji, { fontSize: 24 });
    text.anchor.set(0.5, 0.5);
    text.x = x;
    text.y = h * 0.75 - 60;
    this.pixi.particleLayer.addChild(text);

    this.particles.push({
      sprite: text,
      startTime: performance.now(),
      startY: text.y,
    });
  },

  _updateParticles() {
    const now = performance.now();
    this.particles = this.particles.filter(p => {
      const t = (now - p.startTime) / 800;
      if (t >= 1) {
        this.pixi.particleLayer.removeChild(p.sprite);
        p.sprite.destroy();
        return false;
      }
      p.sprite.y = p.startY - 80 * t;
      p.sprite.scale.set(1 - 0.7 * t);
      p.sprite.alpha = 1 - t;
      return true;
    });
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
    this.els.game.goalEmoji.textContent = '\u{1F31F}';
    this.els.game.goalText.textContent = '\u30d1\u30fc\u30d5\u30a7\u30af\u30c8\uff01';
    this.els.game.goalText.className = 'goal-text perfect-flash';
    overlay.classList.add('show');
    AudioEngine.playPerfectSound();

    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const x = Math.random() * this.app.screen.width;
        this.spawnParticle(x, ['\u2728', '\u{1F31F}', '\u{1F389}', '\u2728'][i % 4]);
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

    if (this.stage > this.bestStage) {
      this.bestStage = this.stage;
      this.saveProgress();
    }

    const total = this.perfectCount + this.goodCount + this.missCount;
    const clearRate = total > 0 ? Math.round(((this.perfectCount + this.goodCount) / total) * 100) : 0;

    this.els.result.vehicleEmoji.textContent = this.vehicle.emoji;
    this.els.result.vehicleName.textContent = `\u30b9\u30c6\u30fc\u30b8 ${this.stage} \u2014 ${this.vehicle.name}`;
    this.els.result.maxCombo.textContent = this.maxCombo;
    this.els.result.clearRate.textContent = `${clearRate}%`;
    this.els.result.perfectNum.textContent = this.perfectCount;
    this.els.result.goodNum.textContent = this.goodCount;
    this.els.result.missNum.textContent = this.missCount;

    if (this.missCount === 0) {
      this.els.result.rank.textContent = '\u{1F31F} \u30d1\u30fc\u30d5\u30a7\u30af\u30c8\uff01';
      this.els.result.rank.className = 'result-rank rank-perfect';
    } else if (clearRate >= 70) {
      this.els.result.rank.textContent = '\u{1F389} \u3059\u3054\u3044\uff01';
      this.els.result.rank.className = 'result-rank rank-great';
    } else {
      this.els.result.rank.textContent = '\u{1F60A} \u304c\u3093\u3070\u3063\u305f\u306d\uff01';
      this.els.result.rank.className = 'result-rank rank-good';
    }

    if (this.stage < COURSES.TOTAL_STAGES) {
      const nextVehicle = COURSES.getStageVehicle(this.stage + 1);
      this.els.result.nextBtn.textContent = `\u25b6\ufe0f \u3064\u304e: ${nextVehicle.emoji} ${nextVehicle.name}`;
      this.els.result.nextBtn.style.display = '';
    } else {
      this.els.result.nextBtn.textContent = '\u{1F3E0} \u304a\u308f\u308a';
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
