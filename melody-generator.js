// melody-generator.js — プロシージャルメロディ生成エンジン（ステージ制対応）

const MelodyGenerator = {
  // メロディシーケンスを生成
  // vehicle: courses.jsの乗り物オブジェクト
  // stageParams: COURSES.getStageParams(stage)
  // 返り値: [{time, note, freq, type, duration}, ...]
  //   type: 'obstacle'
  generate(vehicle, stageParams) {
    const scale = COURSES.SCALES[vehicle.scale];
    const beatDuration = 60 / stageParams.bpm;
    // 通常の最低間隔 (ジャンプ0.7s + 着地余裕0.3s)
    const MIN_GAP = 1.0;
    // タイトペアの間隔（ギリギリジャンプで越えられる）
    const TIGHT_GAP = stageParams.tightPairGap || 0.75;

    const sequence = [];
    let currentTime = beatDuration * 2; // 準備時間
    let lastNoteIndex = Math.floor(scale.length / 2);
    let notesGenerated = 0;

    while (notesGenerated < stageParams.noteCount) {
      const phraseNotes = this._generatePhrase(
        scale, stageParams, beatDuration, lastNoteIndex, notesGenerated
      );

      for (const pNote of phraseNotes) {
        if (notesGenerated >= stageParams.noteCount) break;

        const note = pNote.note;
        const freq = COURSES.NOTE_FREQ[note] || 440;

        sequence.push({
          time: currentTime,
          note: note,
          freq: freq,
          type: 'obstacle',
          big: false,
          duration: pNote.duration,
        });

        currentTime += pNote.duration;
        lastNoteIndex = scale.indexOf(note);
        if (lastNoteIndex === -1) lastNoteIndex = Math.floor(scale.length / 2);
        notesGenerated++;
      }
    }

    // 最低間隔を保証（タイトペアは許可）
    const enforced = this._enforceMinGap(sequence, MIN_GAP, TIGHT_GAP, stageParams);

    // 大きい障害物をマーク
    return this._markBigObstacles(enforced, stageParams);
  },

  // フレーズ生成（4拍単位）
  _generatePhrase(scale, params, beatDuration, startNoteIndex, currentCount) {
    const notes = [];
    let remainingBeats = 4;
    let noteIndex = startNoteIndex;
    let beatsSinceLastNote = 1.0; // 最初は置ける

    while (remainingBeats > 0.5) {
      // 休符判定
      if (Math.random() < params.restRatio && remainingBeats > 1) {
        remainingBeats -= 1;
        beatsSinceLastNote += 1;
        continue;
      }

      // 最低1拍間隔を保証
      if (beatsSinceLastNote < 1.0) {
        remainingBeats -= 0.5;
        beatsSinceLastNote += 0.5;
        continue;
      }

      // 四分音符
      const duration = beatDuration;
      remainingBeats -= 1;

      noteIndex = this._getNextNoteIndex(scale, noteIndex);
      notes.push({
        note: scale[noteIndex],
        type: 'obstacle',
        duration: duration,
      });
      beatsSinceLastNote = 1.0;
    }

    return notes;
  },

  // 次の音符インデックス（跳躍制限付き）
  _getNextNoteIndex(scale, currentIndex) {
    const maxIndex = scale.length - 1;
    if (Math.random() < 0.8) {
      const step = Math.random() < 0.5 ? -1 : 1;
      return Math.max(0, Math.min(maxIndex, currentIndex + step));
    } else {
      const jump = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 2) + 2);
      return Math.max(0, Math.min(maxIndex, currentIndex + jump));
    }
  },

  // 最低間隔を保証 + タイトペア挿入
  _enforceMinGap(sequence, minGap, tightGap, params) {
    if (sequence.length < 2) return sequence;

    const result = [sequence[0]];
    let tightPairInserted = false;

    for (let i = 1; i < sequence.length; i++) {
      const prev = result[result.length - 1];
      const gap = sequence[i].time - prev.time;

      if (gap < minGap) {
        // 間隔が短すぎる → 削除（スキップ）
        continue;
      }

      // タイトペア挿入の判定（後半ステージのみ）
      if (params.allowTightPair && !tightPairInserted && Math.random() < params.tightPairChance) {
        // この障害物の後にタイトペアを追加
        result.push(sequence[i]);

        // 次の障害物がさらに先にあれば、タイトペアを挿入
        const tightTime = sequence[i].time + tightGap;
        const nextOriginal = sequence[i + 1];
        // 次のオリジナル障害物との間隔も確保
        if (!nextOriginal || (nextOriginal.time - tightTime) >= minGap) {
          result.push({
            ...sequence[i],
            time: tightTime,
            freq: (COURSES.NOTE_FREQ[sequence[i].note] || 440) * 1.1, // 少し高い音
          });
          tightPairInserted = true;
        }
        continue;
      }

      result.push(sequence[i]);
    }

    return result;
  },

  // 大きい障害物をランダムに配置
  _markBigObstacles(sequence, params) {
    if (!params.bigObstacleChance) return sequence;
    return sequence.map(note => {
      if (note.type === 'obstacle' && Math.random() < params.bigObstacleChance) {
        return { ...note, big: true };
      }
      return note;
    });
  },

  // ラウンドの総時間
  getRoundDuration(sequence) {
    if (sequence.length === 0) return 5;
    const last = sequence[sequence.length - 1];
    return last.time + last.duration + 0.5;
  },
};
