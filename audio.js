// audio.js — Web Audio API シンセサイザー、バッキングトラック、効果音

const AudioEngine = {
  ctx: null,
  masterGain: null,
  melodyGain: null,
  bassGain: null,
  drumGain: null,
  sfxGain: null,
  backingInterval: null,
  isPlaying: false,

  // 初期化（ユーザーインタラクション後に呼ぶ）
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    this.melodyGain = this.ctx.createGain();
    this.melodyGain.gain.value = 0.4;
    this.melodyGain.connect(this.masterGain);

    this.bassGain = this.ctx.createGain();
    this.bassGain.gain.value = 0.25;
    this.bassGain.connect(this.masterGain);

    this.drumGain = this.ctx.createGain();
    this.drumGain.gain.value = 0.3;
    this.drumGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.masterGain);
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // メロディ音を再生
  playNote(freq, waveType, duration, startTime) {
    if (!this.ctx) return;
    const t = startTime || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = waveType || 'square';
    osc.frequency.setValueAtTime(freq, t);

    // エンベロープ（ADSR簡易版）
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.02); // Attack
    gain.gain.linearRampToValueAtTime(0.3, t + 0.08); // Decay → Sustain
    gain.gain.linearRampToValueAtTime(0.0, t + Math.min(duration, 0.5)); // Release

    osc.connect(gain);
    gain.connect(this.melodyGain);
    osc.start(t);
    osc.stop(t + Math.min(duration, 0.6));
  },

  // コイン取得音
  playCoinSound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.linearRampToValueAtTime(1800, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  },

  // ジャンプ音
  playJumpSound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  },

  // Perfect判定音
  playPerfectSound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    [800, 1000, 1200].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, t + i * 0.05);
      gain.gain.linearRampToValueAtTime(0, t + i * 0.05 + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.05);
      osc.stop(t + i * 0.05 + 0.2);
    });
  },

  // ミス音
  playMissSound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.2);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  },

  // ゴール音（ファンファーレ）
  playGoalSound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = t + i * 0.15;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
      gain.gain.linearRampToValueAtTime(i === 3 ? 0.25 : 0.15, start + 0.1);
      gain.gain.linearRampToValueAtTime(0, start + (i === 3 ? 0.8 : 0.2));
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + (i === 3 ? 1.0 : 0.3));
    });
  },

  // フィーバー突入音
  playFeverSound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 800 + i * 200;
      gain.gain.setValueAtTime(0.15, t + i * 0.04);
      gain.gain.linearRampToValueAtTime(0, t + i * 0.04 + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.2);
    }
  },

  // === タイトルBGM ===
  titleBGMInterval: null,
  isTitlePlaying: false,

  startTitleBGM() {
    if (this.isTitlePlaying || !this.ctx) return;
    this.isTitlePlaying = true;

    const bpm = 100;
    const beatDur = 60 / bpm;
    // C major pentatonic の明るいメロディ
    const melody = [
      523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 0,
      783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 0,
    ];
    let step = 0;

    const playStep = () => {
      if (!this.isTitlePlaying || !this.ctx) return;
      const freq = melody[step % melody.length];
      if (freq > 0) {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.03);
        gain.gain.linearRampToValueAtTime(0.08, t + beatDur * 0.3);
        gain.gain.linearRampToValueAtTime(0, t + beatDur * 0.7);
        osc.connect(gain);
        gain.connect(this.melodyGain);
        osc.start(t);
        osc.stop(t + beatDur * 0.8);
      }
      // 軽いドラム
      if (step % 4 === 0) this._playKick(this.ctx.currentTime);
      if (step % 2 === 0) this._playHihat(this.ctx.currentTime);

      step++;
      this.titleBGMInterval = setTimeout(playStep, beatDur * 1000);
    };
    playStep();
  },

  stopTitleBGM() {
    this.isTitlePlaying = false;
    if (this.titleBGMInterval) {
      clearTimeout(this.titleBGMInterval);
      this.titleBGMInterval = null;
    }
  },

  // バッキングトラック開始
  startBacking(vehicle, bpm) {
    this.stopBacking();
    if (!this.ctx) return;

    const beatDuration = 60 / bpm;
    const bassFreq = COURSES.NOTE_FREQ[vehicle.bassNote] || 130.81;
    let beat = 0;

    this.isPlaying = true;

    const playBeat = () => {
      if (!this.isPlaying) return;
      const t = this.ctx.currentTime;

      // キック（1拍目と3拍目）
      if (beat % 4 === 0 || beat % 4 === 2) {
        this._playKick(t);
      }

      // ハイハット（毎拍）
      this._playHihat(t);

      // ベース（1拍目と3拍目）
      if (beat % 4 === 0) {
        this._playBass(bassFreq, beatDuration * 0.8, t);
      } else if (beat % 4 === 2) {
        // 5度上のベース
        this._playBass(bassFreq * 1.5, beatDuration * 0.8, t);
      }

      beat++;
      this.backingInterval = setTimeout(playBeat, beatDuration * 1000);
    };

    playBeat();
  },

  // バッキングトラック停止
  stopBacking() {
    this.isPlaying = false;
    if (this.backingInterval) {
      clearTimeout(this.backingInterval);
      this.backingInterval = null;
    }
  },

  // キックドラム（合成）
  _playKick(t) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.drumGain);
    osc.start(t);
    osc.stop(t + 0.2);
  },

  // ハイハット（合成ノイズ）
  _playHihat(t) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain);
    source.start(t);
    source.stop(t + 0.06);
  },

  // ベース音
  _playBass(freq, duration, t) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.linearRampToValueAtTime(0.2, t + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0, t + duration);

    osc.connect(gain);
    gain.connect(this.bassGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  },

  // UIクリック音
  playClickSound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  },

  // 選択画面プレビュー（乗り物テーマの短いフレーズ）
  playPreview(vehicle) {
    if (!this.ctx) return;
    const scale = COURSES.SCALES[vehicle.scale];
    const t = this.ctx.currentTime;
    const beatDur = 60 / vehicle.baseBPM;

    // スケールの最初の5音を鳴らす
    const previewNotes = scale.slice(0, Math.min(5, scale.length));
    previewNotes.forEach((note, i) => {
      const freq = COURSES.NOTE_FREQ[note];
      if (freq) {
        this.playNote(freq, vehicle.waveType, beatDur * 0.4, t + i * beatDur * 0.3);
      }
    });
  },

  getCurrentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  },
};
