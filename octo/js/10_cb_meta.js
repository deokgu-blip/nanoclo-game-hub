
/* ============================================================================
 * meta/balance.js — 아웃게임 밸런스 SSOT (POC §9)
 * 순수 상수만. 브라우저(<script>) + Node(require) 양쪽 로드 가능.
 *   브라우저: window.CB.BALANCE
 *   Node    : require('./meta/balance.js').BALANCE
 * 값을 바꾸려면 여기서만 바꾼다(다른 곳에 하드코딩 금지).
 * ==========================================================================*/
;(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window
           : (typeof globalThis !== 'undefined') ? globalThis : this;
  root.CB = root.CB || {};

  var BALANCE = {
    version: 2,

    // ── 하트(라이프) — Royal Match식 ──
    hearts: {
      max: 5,
      regenMs: 30 * 60 * 1000,   // 30분/1개
      loseOnFail: 1,             // 실패 시 차감
      refillCoins: 100,          // 코인으로 가득 충전
      adRefill: 1                // 광고 1회 → +1
    },

    // ── 보상 ──
    rewards: {
      stageClearCoins: 20,                 // 스테이지 클리어 코인
      // 스테이지 클리어 큐브 = 디오라마별 voxelTotal/스테이지수 (worlds.js 의 stage.rewardCubes 로 사전계산)
      milestonePct:  [0.30, 0.70, 1.00],   // 디오라마 조립 마일스톤(레거시 표시용)
      milestoneCoins:[50,   150,  400]
    },

    // ── 디오라마(섬) 진행도 마일스톤 보상 (Wave2-A) ──
    //   디오라마 fill %(island progress) 가 100% 를 '넘을 때' 1회 지급(디오라마별 1회).
    //   [변경] '제작정도별 코인 지급' 폐지(사용자 요청): 33%/66% 코인 보상 제거 → 100% 완성 시 아이템(부스터) 1개만.
    //   중복방지: m.dioramaMilestones[dioramaId] = [이미 지급한 threshold...].
    dioramaMilestones: [
      { pct: 100, reward: { booster: 'color_bomb' } }   // 100% → 부스터 아이템 1개만(코인 미지급)
    ],

    // ── 업적(장기 목표 — 데일리 미션과 별개) (Wave2-B) ──
    //   각 업적: id, label, stat(메타에서 파생되는 진행값 키), tiers[](누적 단계: target+reward).
    //   진행도는 가능한 한 기존 상태에서 파생(아래 stat 키 → state.achievementStat 매핑):
    //     clear_total     = unlockedStageIndex(누적 클리어 스테이지)
    //     collect_diorama = album 완성 수
    //     complete_world  = completedWorlds 수
    //     coins_earned    = m.stats.coinsEarned(누적 획득 코인)
    //     daily_streak    = m.stats.bestStreak(최고 연속출석)
    //     use_booster     = m.stats.boosterUsed(누적 부스터 사용)
    //   티어형: 한 업적이 여러 단계. 현재 티어까지 claim, 다음 티어로 진행.
    achievements: [
      { id:'clear_total',     stat:'clear_total',     label:'Clear Stages',
        tiers:[ {target:10, reward:{coins:100}}, {target:30, reward:{coins:250}},
                {target:60, reward:{coins:500}}, {target:100, reward:{coins:1000}} ] },
      { id:'collect_diorama', stat:'collect_diorama', label:'Collect Dioramas',
        tiers:[ {target:1, reward:{coins:150}}, {target:3, reward:{coins:400}},
                {target:5, reward:{coins:700, booster:'color_bomb'}}, {target:7, reward:{coins:1200, booster:'extra_cannon'}} ] },
      { id:'complete_world',  stat:'complete_world',  label:'Complete Worlds',
        tiers:[ {target:1, reward:{coins:200}}, {target:3, reward:{coins:600}}, {target:7, reward:{coins:1500}} ] },
      { id:'coins_earned',    stat:'coins_earned',    label:'Coins Earned',
        tiers:[ {target:1000, reward:{booster:'color_bomb'}}, {target:5000, reward:{booster:'slot_plus'}} ] },
      { id:'daily_streak',    stat:'daily_streak',    label:'Daily Streak',
        tiers:[ {target:3, reward:{coins:120}}, {target:7, reward:{coins:400}} ] },
      { id:'use_booster',     stat:'use_booster',     label:'Use Boosters',
        tiers:[ {target:5, reward:{coins:150}}, {target:20, reward:{coins:500}} ] }
    ],

    // ── 일일 보상(7일 순환) — 큐브 제외(큐브는 디오라마 제작 자원: 게임 결과/제작화면에서만 획득) ──
    daily: [
      { day: 1, reward: { coins: 50 } },
      { day: 2, reward: { coins: 80 } },
      { day: 3, reward: { hearts: 1 } },
      { day: 4, reward: { coins: 120 } },
      { day: 5, reward: { hearts: 2 } },
      { day: 6, reward: { booster: 'color_bomb' } },
      { day: 7, reward: { coins: 300 } }
    ],

    // ── 일일 미션(풀 4종 중 매일 3개) ──
    missions: {
      perDay: 3,
      pool: [
        { type: 'clear_stages',  target: 3, reward: { coins: 50 }, label: 'Clear 3 Stages' },
        { type: 'build_progress',target: 30,reward: { coins: 80 }, label: 'Build 30% of a Diorama' },
        { type: 'use_booster',   target: 1, reward: { cubes: 20 }, label: 'Use a Booster ×1' },
        { type: 'enter_fever',   target: 1, reward: { coins: 40 }, label: 'Reach Fever ×1' }
      ]
    },

    // ── 무료 일일 코인(상점) — UTC 자정(00:00 UTC) 리셋, 하루 1회 수령 ──
    //   ⚠ 일일 보상(daily, KST 자정)과 별개. 무료 코인은 UTC 날짜 기준(요청 사양).
    freeCoins: { amount: 100 },

    // ── 부스터(코인가) ──
    boosters: {
      magnet:       100,
      magic_wand:   100,
      extra_cannon: 200,
      slot_plus:    200,
      color_bomb:   300
    },

    // ── 콘텐츠 볼륨 ──
    diorama: { stagesPerDiorama: 3 },
    world:   { dioramasPerWorld: 5 },

    // ── 일일 리셋 기준 타임존 (KST = UTC+9) ──
    tz: { offsetMinutes: 9 * 60 }
  };

  root.CB.BALANCE = BALANCE;
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CB;
})();

/* ============================================================================
 * meta/worlds.js — 정적 테마월드/디오라마/스테이지 데이터 (SSOT)
 * 코드 상수(저장 안 함). 브라우저 window.CB.* / Node require.
 *
 * v2 구조(A안 — 코지 테마 = 메타 월드):
 *  - 7 월드 = 7 인게임 테마(스테이지 순서: cozy→city→rescue→fantasy→halloween→space→winter).
 *    테마 정렬 = dist/html/cozy_village/lobby/themes/<idx>_<id>.json 파일명순 = 해금 순서.
 *  - 월드당 디오라마 1개 = 그 테마의 섬 씬(테마 전체 배치 디오라마). 컬렉션 = 7개 테마 디오라마.
 *    (v1: 테마당 1개. 추후 테마별 다중 디오라마로 확장 가능.)
 *  - 스테이지 15개/테마 = 총 105 (인게임 105스테이지와 1:1). META_STAGES 는 인게임 → 테마 매핑을
 *    그대로 따른다: 글로벌 스테이지 인덱스 i(0-based) → 테마 floor(i/15). 각 스테이지의
 *    dioramaId = 그 테마 디오라마, inGameStageRef = 글로벌 인덱스(0..104).
 *  - voxelTotal = 그 테마 섬 씬의 실제 복셀 합(themes/*.json place[] 가 참조하는 models_packed.json
 *    모델들의 복셀수 총합 — calc 로 측정한 SSOT 상수). rewardCubes = ceil(voxelTotal/15)
 *    → 15판 클리어 = 디오라마 100%.
 *  - legacyDi = 구 META.di 인덱스(테마 순서 0..6). v1(cb_meta {di,filled}) → v2 마이그레이션에 사용
 *    (코지 v2 신규 시작이라 실데이터는 없으나 round-trip/마이그레이션 API 호환 유지).
 *  - thumbAsset/worldViewAsset = (레거시) 테마 식별용 메타. 로비 앨범/월드맵 카드는 이제
 *    승인된 2.5D 복셀 풀씬 아트(lobby/album3d_<theme>.webp)를 __ALBUM_ART[테마 short] 로 참조한다
 *    (테마 short 키 = cozy/city/rescue/fantasy/halloween/space/winter). 이 필드는 매핑 호환용으로만 유지.
 * ==========================================================================*/
;(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window
           : (typeof globalThis !== 'undefined') ? globalThis : this;
  root.CB = root.CB || {};

  var STAGES_PER_THEME = 15;   // 인게임 build_puzzle 와 동일(테마당 15)

  // ── 7 테마 정의(파일명순 = 해금 순서) ──────────────────────────────────────
  //   voxelTotal = themes/*.json place[] 참조 모델 복셀합(measured SSOT). 표시 디오라마 1개/테마.
  var THEMES = [
    { worldId:'w_cozy',      dioramaId:'d_cozy',      short:'cozy',      idx:0,
      name:'Cozy Village',    emoji:'🏡', dioName:'Cozy Village',    palette:['#82c14e','#bfe3ff','#ffb98a'], voxelTotal:21999 },
    { worldId:'w_city',      dioramaId:'d_city',      short:'city',      idx:1,
      name:'City Street',     emoji:'🏙️', dioName:'City Street',     palette:['#8aa0b8','#cfe0f2','#3a4a60'], voxelTotal:21159 },
    { worldId:'w_rescue',    dioramaId:'d_rescue',    short:'rescue',    idx:2,
      name:'Rescue Squad',    emoji:'🚒', dioName:'Rescue Squad',    palette:['#e0432f','#ffd24a','#27406b'], voxelTotal:10354 },
    { worldId:'w_fantasy',   dioramaId:'d_fantasy',   short:'fantasy',   idx:3,
      name:'Fantasy Quest',   emoji:'🐉', dioName:'Fantasy Quest',   palette:['#6a7d96','#ffd24a','#27406b'], voxelTotal:27465 },
    { worldId:'w_halloween', dioramaId:'d_halloween', short:'halloween', idx:4,
      name:'Spooky Night',    emoji:'🎃', dioName:'Spooky Night',    palette:['#ff8a2a','#5b2e86','#1a1230'], voxelTotal:4138 },
    { worldId:'w_space',     dioramaId:'d_space',     short:'space',     idx:5,
      name:'Outer Space',     emoji:'🚀', dioName:'Outer Space',     palette:['#5d7bff','#9b6bff','#0a0e2a'], voxelTotal:12426 },
    { worldId:'w_winter',    dioramaId:'d_winter',    short:'winter',    idx:6,
      name:'Winter Festival', emoji:'❄️', dioName:'Winter Festival', palette:['#bfe3ff','#e8f4ff','#5a7da8'], voxelTotal:9042 }
  ];

  // ── 디오라마 7종(테마당 1, id → 메타) ────────────────────────────────────────
  //   thumbAsset = (레거시) 매핑 호환용. 실제 카드 아트는 __ALBUM_ART[themeId(=short)] = album3d_<theme>.webp.
  var DIORAMAS = THEMES.map(function (t, i) {
    return {
      id: t.dioramaId, worldId: t.worldId, name: t.dioName, emoji: t.emoji,
      themeId: t.short, themeIdx: t.idx,
      voxelTotal: t.voxelTotal, legacyDi: i,
      thumbAsset: 'theme_' + t.idx + '_' + t.short + '.png'
    };
  });

  // ── 7 테마월드(순차 해금: cozy 첫 월드, 나머지 이전 테마 완료 시) ──────────────
  var THEME_WORLDS = THEMES.map(function (t, i) {
    return {
      id: t.worldId, name: t.name, short: t.short, emoji: t.emoji, themeIdx: t.idx,
      theme: t.name, palette: t.palette,
      dioramaIds: [t.dioramaId],
      worldViewAsset: 'theme_' + t.idx + '_' + t.short + '.png',
      unlock: { prevWorldId: (i === 0) ? null : THEMES[i - 1].worldId }
    };
  });

  // ── 메타 스테이지 105 (테마당 15, 글로벌 인덱스 i → 테마 floor(i/15)) ──────────
  //   inGameStageRef = 인게임 STAGES 인덱스(= 글로벌 인덱스 0..104). 1:1.
  //   rewardCubes = ceil(voxelTotal/15) → 15판이면 그 테마 디오라마 완성.
  var META_STAGES = (function () {
    var stages = [];
    for (var gi = 0; gi < THEMES.length * STAGES_PER_THEME; gi++) {
      var ti = Math.floor(gi / STAGES_PER_THEME);
      var t = THEMES[ti];
      var local = (gi % STAGES_PER_THEME) + 1;     // 테마 내 순번 1..15
      var rc = Math.ceil(t.voxelTotal / STAGES_PER_THEME);
      stages.push({
        id: 's_' + t.short + '_' + String(local).padStart(2, '0'),
        worldId: t.worldId, dioramaId: t.dioramaId,
        index: gi,            // 글로벌 해금 순번(0-based)
        inGameStageRef: gi,   // 인게임 STAGES 인덱스(0..104)
        // 퍼즐 클리어 보상 = 큐브만(코인 0). 코인은 로비 컬렉션 빌드(스텝당 +10, 마일스톤)에서만 획득.
        rewardCubes: rc, rewardCoins: 0
      });
    }
    return stages;
  })();

  // ── 인덱스/헬퍼 ──────────────────────────────────────────────────────────
  var _wById = {}, _dById = {}, _sById = {};
  THEME_WORLDS.forEach(function (w) { _wById[w.id] = w; });
  DIORAMAS.forEach(function (d) { _dById[d.id] = d; });
  META_STAGES.forEach(function (s) { _sById[s.id] = s; });

  function worldById(id)   { return _wById[id] || null; }
  function dioramaById(id) { return _dById[id] || null; }
  function stageById(id)   { return _sById[id] || null; }
  function dioramasOfWorld(wid) { var w = _wById[wid]; return w ? w.dioramaIds.map(function (i) { return _dById[i]; }) : []; }
  function stagesOfWorld(wid)   { return META_STAGES.filter(function (s) { return s.worldId === wid; }); }
  function stagesOfDiorama(did) { return META_STAGES.filter(function (s) { return s.dioramaId === did; }); }
  function firstWorldId() { for (var i=0;i<THEME_WORLDS.length;i++){ if(!THEME_WORLDS[i].unlock.prevWorldId) return THEME_WORLDS[i].id; } return THEME_WORLDS[0].id; }
  function nextWorldId(wid) { for (var i=0;i<THEME_WORLDS.length;i++){ if(THEME_WORLDS[i].unlock.prevWorldId===wid) return THEME_WORLDS[i].id; } return null; }
  function stageByGlobalIndex(gi) { return META_STAGES[gi] || null; }
  function totalMetaStages() { return META_STAGES.length; }
  function dioramaByLegacyDi(di){ for(var i=0;i<DIORAMAS.length;i++){ if(DIORAMAS[i].legacyDi===di) return DIORAMAS[i]; } return null; }

  // ── 무결성 검사(빌드 게이트) ──────────────────────────────────────────────
  function checkIntegrity() {
    var errs = [];
    var NW = THEMES.length, ND = THEMES.length, NS = THEMES.length * STAGES_PER_THEME;
    if (THEME_WORLDS.length !== NW)  errs.push('worlds != ' + NW + ' (' + THEME_WORLDS.length + ')');
    if (DIORAMAS.length !== ND)      errs.push('dioramas != ' + ND + ' (' + DIORAMAS.length + ')');
    if (META_STAGES.length !== NS)   errs.push('stages != ' + NS + ' (' + META_STAGES.length + ')');
    // 디오라마 참조 무결
    DIORAMAS.forEach(function (d) {
      if (!_wById[d.worldId]) errs.push('diorama ' + d.id + ' → orphan worldId ' + d.worldId);
      if (!(d.voxelTotal > 0)) errs.push('diorama ' + d.id + ' bad voxelTotal');
    });
    // 월드의 dioramaIds 무결 + 월드당 1개
    THEME_WORLDS.forEach(function (w) {
      if (w.dioramaIds.length !== 1) errs.push('world ' + w.id + ' dioramaIds != 1');
      w.dioramaIds.forEach(function (did) { if (!_dById[did]) errs.push('world ' + w.id + ' → orphan dioramaId ' + did); });
      if (w.unlock.prevWorldId && !_wById[w.unlock.prevWorldId]) errs.push('world ' + w.id + ' → orphan prevWorldId');
    });
    // 스테이지 참조 + inGameStageRef 범위(0..104) + 테마 매핑(floor(i/15))
    META_STAGES.forEach(function (s) {
      if (!_wById[s.worldId])   errs.push('stage ' + s.id + ' → orphan worldId');
      if (!_dById[s.dioramaId]) errs.push('stage ' + s.id + ' → orphan dioramaId');
      if (!(s.inGameStageRef >= 0 && s.inGameStageRef <= NS - 1)) errs.push('stage ' + s.id + ' inGameStageRef out of 0..' + (NS - 1) + ' (' + s.inGameStageRef + ')');
      var expectW = THEMES[Math.floor(s.inGameStageRef / STAGES_PER_THEME)].worldId;
      if (s.worldId !== expectW) errs.push('stage ' + s.id + ' worldId != floor(i/15) theme (' + s.worldId + ' vs ' + expectW + ')');
    });
    // legacyDi 유일 0..(ND-1)
    var seen = {};
    DIORAMAS.forEach(function (d) {
      if (d.legacyDi == null || seen[d.legacyDi]) errs.push('legacyDi dup/missing ' + d.id);
      seen[d.legacyDi] = 1;
    });
    return { ok: errs.length === 0, errors: errs };
  }

  Object.assign(root.CB, {
    THEME_WORLDS: THEME_WORLDS, DIORAMAS: DIORAMAS, META_STAGES: META_STAGES,
    STAGES_PER_THEME: STAGES_PER_THEME,
    worldById: worldById, dioramaById: dioramaById, stageById: stageById,
    dioramasOfWorld: dioramasOfWorld, stagesOfWorld: stagesOfWorld, stagesOfDiorama: stagesOfDiorama,
    firstWorldId: firstWorldId, nextWorldId: nextWorldId, stageByGlobalIndex: stageByGlobalIndex,
    totalMetaStages: totalMetaStages, dioramaByLegacyDi: dioramaByLegacyDi, checkIntegrity: checkIntegrity
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CB;
})();

/* ============================================================================
 * meta/state.js — 아웃게임 런타임 상태(PlayerMeta v2) SSOT (POC §4, 빌드플랜 Phase 0)
 * 저장키 localStorage 'cb_meta_v2'  (구 'cb_meta' → 마이그레이션)
 * 의존: CB.BALANCE(balance.js), CB.* (worlds.js). 브라우저/Node 양쪽.
 *
 * 설계 노트:
 *  - 시간 의존 함수(regenHearts/rolloverDaily/settle/load)는 now(ms)를 인자로 받아 테스트 가능.
 *  - unlockedStageIndex = "글로벌 메타 스테이지 해금 순번(0-based)". 인게임 level(1..N)과 1:1 매핑되어
 *    마이그레이션에서 level 보존이 명확. currentWorldId 는 이 값으로부터 파생.
 *  - 미션 선택은 ymd 시드 결정적 셔플 → 같은 날 항상 동일(플리커 없음).
 * ==========================================================================*/
;(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window
           : (typeof globalThis !== 'undefined') ? globalThis : this;
  root.CB = root.CB || {};
  var CB = root.CB;
  var KEY = 'cb_meta_v2', OLD_KEY = 'cb_meta';

  function B() { return CB.BALANCE; }
  function _now(now) { return (now == null) ? Date.now() : now; }
  function _ls() { try { return (typeof localStorage !== 'undefined') ? localStorage : null; } catch (e) { return null; } }

  // ── KST 기준 YYYY-MM-DD ──────────────────────────────────────────────────
  function ymdKST(now) {
    var off = (B() && B().tz ? B().tz.offsetMinutes : 540) * 60 * 1000;
    var d = new Date(_now(now) + off);
    return d.getUTCFullYear() + '-' +
           String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
           String(d.getUTCDate()).padStart(2, '0');
  }
  function _ymdToDays(ymd) {  // 연속출석 판정용 (UTC epoch day)
    var p = ymd.split('-'); return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  // ── UTC 기준 YYYY-MM-DD (무료 코인 리셋용 — KST 와 별개, 항상 UTC 00:00 경계) ──
  //   ⚠ argless new Date() 금지(테스트 가능성) → now(ms) 를 받아 UTC 날짜 계산.
  function ymdUTC(now) {
    var d = new Date(_now(now));
    return d.getUTCFullYear() + '-' +
           String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
           String(d.getUTCDate()).padStart(2, '0');
  }
  // 다음 UTC 자정(00:00 UTC)까지 남은 ms — 상점 "Tomorrow" 카운트다운/리셋 표시용.
  function msToNextUTCDay(now) {
    now = _now(now);
    var d = new Date(now);
    var next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
    return Math.max(0, next - now);
  }

  // ── 결정적 미션 선택 ──────────────────────────────────────────────────────
  function _hash(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function pickMissions(ymd) {
    var pool = B().missions.pool.slice(), per = B().missions.perDay;
    var seed = _hash('m' + ymd);
    for (var i = pool.length - 1; i > 0; i--) {           // 시드 셔플(Fisher-Yates, mulberry32)
      seed = (seed + 0x6D2B79F5) >>> 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      var j = ((t ^ (t >>> 14)) >>> 0) % (i + 1);
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, per).map(function (m, idx) {
      return { id: ymd + '#' + idx, type: m.type, target: m.target, progress: 0, reward: _clone(m.reward), claimed: false, label: m.label };
    });
  }
  function _clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ── 부스터 인벤토리 SSOT(Phase 9 상점) ──────────────────────────────────────
  //   상점에서 코인으로 구매 → m.boosters[id]++. 인게임에서 1회 사용 → m.boosters[id]--.
  //   id 목록은 BALANCE.boosters 키(extra_cannon/color_bomb/slot_plus)에서 파생(가격 SSOT 와 동일 출처).
  function boosterIds() { return Object.keys(B().boosters || {}); }
  function emptyBoosters() { var o = {}; boosterIds().forEach(function (id) { o[id] = 0; }); return o; }
  // 누락/추가 필드 forward-compat: 알려진 모든 id 0 기본, 음수 클램프, 미지의 키는 버린다.
  function normalizeBoosters(b) {
    var out = emptyBoosters();
    if (b && typeof b === 'object') boosterIds().forEach(function (id) { var v = b[id] | 0; out[id] = v > 0 ? v : 0; });
    return out;
  }

  // ── 기본 메타 ─────────────────────────────────────────────────────────────
  function defaultMeta(now) {
    now = _now(now);
    var ymd = ymdKST(now);
    return {
      version: 2,
      wallet: { cubes: 0, coins: 0 },
      hearts: { count: B().hearts.max, max: B().hearts.max, lastRegenTs: now, regenMs: B().hearts.regenMs },
      currentWorldId: CB.firstWorldId(),
      worldProgress: {},          // worldId → { dioramaFilled: { dioramaId → cubes } }
      completedWorlds: [],
      album: [],                  // [{dioramaId, completed, completedYmd}]
      daily: { streak: 0, lastClaimYmd: '', table: B().daily },
      freeCoinUTC: '',            // 무료 코인 마지막 수령 UTC 날짜(YYYY-MM-DD). 빈값=한 번도 안 받음(수령 가능).
      missions: { ymd: ymd, list: pickMissions(ymd) },
      boosters: emptyBoosters(),  // 부스터 인벤토리(상점 구매분) — id → 보유 개수
      unlockedStageIndex: 0,      // 글로벌 메타 스테이지 해금(0-based)
      dioramaMilestones: {},      // dioramaId → [이미 지급한 threshold(33/66/100)...] (Wave2-A 중복방지)
      achievements: emptyAchievements(),                          // achievementId → claimedTier(0=미수령) (Wave2-B)
      stats: { coinsEarned: 0, boosterUsed: 0, bestStreak: 0 },   // 누적 추적(파생 불가한 값만)
      settings: { sfx: true, bgm: true, haptic: true }
    };
  }
  function emptyAchievements() { var o = {}; (B().achievements || []).forEach(function (a) { o[a.id] = 0; }); return o; }

  // ── 누락 필드 보정(부분 저장본 forward-compat) ──────────────────────────────
  function normalize(m, now) {
    var d = defaultMeta(now);
    if (!m || typeof m !== 'object') return d;
    m.version = 2;
    m.wallet = Object.assign({ cubes: 0, coins: 0 }, m.wallet || {});
    m.hearts = Object.assign({}, d.hearts, m.hearts || {});
    if (typeof m.currentWorldId !== 'string' || !CB.worldById(m.currentWorldId)) m.currentWorldId = d.currentWorldId;
    m.worldProgress = m.worldProgress || {};
    m.completedWorlds = m.completedWorlds || [];
    m.album = m.album || [];
    m.daily = Object.assign({ streak: 0, lastClaimYmd: '', table: B().daily }, m.daily || {});
    m.daily.table = B().daily;  // 테이블은 항상 코드 SSOT
    if (typeof m.freeCoinUTC !== 'string') m.freeCoinUTC = '';   // 무료 코인 수령일(UTC) — 누락 시 미수령
    m.missions = m.missions || d.missions;
    m.boosters = normalizeBoosters(m.boosters);   // 부스터 인벤토리(누락 시 0, 음수 클램프, 미지 키 제거)
    if (typeof m.unlockedStageIndex !== 'number') m.unlockedStageIndex = 0;
    m.dioramaMilestones = normalizeMilestones(m.dioramaMilestones);   // Wave2-A 중복방지 플래그
    m.achievements = normalizeAchievements(m.achievements);           // Wave2-B 수령 티어
    m.stats = normalizeStats(m, m.stats);                             // Wave2-B 누적 추적(파생 불가)
    m.settings = Object.assign({ sfx: true, bgm: true, haptic: true }, m.settings || {});
    return m;
  }

  // ── Wave2-A: 디오라마 마일스톤 중복방지 플래그 정규화 ────────────────────────
  //   { dioramaId → [33,66,100 중 지급분] }. 알려진 디오라마/threshold 만, 정수, 유일하게 정리.
  function _milestonePcts() { return (B().dioramaMilestones || []).map(function (x) { return x.pct | 0; }); }
  function normalizeMilestones(mm) {
    var out = {}, valid = _milestonePcts();
    if (mm && typeof mm === 'object') {
      Object.keys(mm).forEach(function (did) {
        if (!CB.dioramaById(did)) return;                         // 미지의 디오라마 키 버림
        var arr = Array.isArray(mm[did]) ? mm[did] : [];
        var seen = {};
        out[did] = arr.map(function (p) { return p | 0; })
                      .filter(function (p) { return valid.indexOf(p) >= 0 && !seen[p] && (seen[p] = 1); });
      });
    }
    return out;
  }
  // ── Wave2-B: 업적 수령 티어 정규화 ─────────────────────────────────────────
  //   { achievementId → claimedTier(0..tiers.length) }. 알려진 업적만, 0..maxTier 클램프.
  function _achievementDefs() { return B().achievements || []; }
  function _achievementById(id) { var a = _achievementDefs(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function normalizeAchievements(ac) {
    var out = {};
    _achievementDefs().forEach(function (def) {
      var v = (ac && typeof ac === 'object') ? (ac[def.id] | 0) : 0;
      out[def.id] = Math.max(0, Math.min(def.tiers.length, v));     // 0..maxTier 클램프
    });
    return out;
  }
  // ── Wave2-B: 누적 통계 정규화(파생 불가한 값만 저장) ────────────────────────
  //   bestStreak 은 현재 daily.streak 와의 max 로 보정(구 저장본 forward-compat).
  function normalizeStats(m, s) {
    var out = { coinsEarned: 0, boosterUsed: 0, bestStreak: 0 };
    if (s && typeof s === 'object') {
      out.coinsEarned = Math.max(0, s.coinsEarned | 0);
      out.boosterUsed = Math.max(0, s.boosterUsed | 0);
      out.bestStreak  = Math.max(0, s.bestStreak | 0);
    }
    if (m && m.daily && (m.daily.streak | 0) > out.bestStreak) out.bestStreak = m.daily.streak | 0;
    return out;
  }
  function _ensureStats(m) { if (!m.stats || typeof m.stats !== 'object') m.stats = { coinsEarned: 0, boosterUsed: 0, bestStreak: 0 }; return m.stats; }

  // ── v1(cb_meta {di,filled,coins,ms,level}) → v2 마이그레이션 ─────────────────
  function migrateV1(old, now) {
    now = _now(now);
    var m = defaultMeta(now);
    if (!old || typeof old !== 'object') return m;

    m.wallet.coins = (old.coins == null) ? 0 : (+old.coins || 0);   // 코인 보존
    var lvl = (old.level | 0) || 1;
    m.unlockedStageIndex = Math.max(0, Math.min(CB.totalMetaStages() - 1, lvl - 1));  // level 보존(글로벌 순번)

    // 디오라마 진행(di/filled) → worldProgress. legacyDi 기준.
    var di = old.di | 0, filled = old.filled | 0;
    CB.DIORAMAS.forEach(function (d) {
      var fillCubes = 0;
      if (d.legacyDi < di) fillCubes = d.voxelTotal;          // 이미 완성한 디오라마
      else if (d.legacyDi === di) fillCubes = Math.max(0, Math.min(d.voxelTotal, filled));  // 진행 중
      if (fillCubes > 0) _setFill(m, d, fillCubes);
      if (fillCubes >= d.voxelTotal && d.voxelTotal > 0) _ensureAlbum(m, d.id, ymdKST(now));
    });
    // 완료 월드 + currentWorld 재계산
    _recomputeWorlds(m, now);
    var cur = CB.stageByGlobalIndex(m.unlockedStageIndex);
    if (cur) m.currentWorldId = cur.worldId;
    return m;
  }

  function _setFill(m, d, cubes) {
    var wp = m.worldProgress[d.worldId] || (m.worldProgress[d.worldId] = { dioramaFilled: {} });
    wp.dioramaFilled[d.id] = cubes;
  }
  function _getFill(m, d) {
    var wp = m.worldProgress[d.worldId]; return (wp && wp.dioramaFilled[d.id]) || 0;
  }
  function _ensureAlbum(m, dioramaId, ymd) {
    for (var i = 0; i < m.album.length; i++) if (m.album[i].dioramaId === dioramaId) { m.album[i].completed = true; if (!m.album[i].completedYmd) m.album[i].completedYmd = ymd; return; }
    m.album.push({ dioramaId: dioramaId, completed: true, completedYmd: ymd });
  }
  function _recomputeWorlds(m, now) {
    m.completedWorlds = [];
    CB.THEME_WORLDS.forEach(function (w) {
      var done = w.dioramaIds.every(function (did) { var d = CB.dioramaById(did); return _getFill(m, d) >= d.voxelTotal; });
      if (done) m.completedWorlds.push(w.id);
    });
  }

  // ── 하트 시간 회복 정산 ─────────────────────────────────────────────────────
  function regenHearts(m, now) {
    now = _now(now); var h = m.hearts;
    if (h.count >= h.max) { h.lastRegenTs = now; return m; }
    if (!h.lastRegenTs) { h.lastRegenTs = now; return m; }
    var elapsed = now - h.lastRegenTs;
    if (elapsed <= 0) return m;
    var gained = Math.floor(elapsed / h.regenMs);
    if (gained > 0) {
      h.count = Math.min(h.max, h.count + gained);
      if (h.count >= h.max) h.lastRegenTs = now;
      else h.lastRegenTs += gained * h.regenMs;
    }
    return m;
  }
  function msToNextHeart(m, now) {
    now = _now(now); var h = m.hearts;
    if (h.count >= h.max) return 0;
    var base = h.lastRegenTs || now;
    return Math.max(0, h.regenMs - ((now - base) % h.regenMs));
  }

  // ── 일일 리셋(KST 자정) ─────────────────────────────────────────────────────
  function rolloverDaily(m, now) {
    var ymd = ymdKST(now);
    if (!m.missions || m.missions.ymd !== ymd) {
      m.missions = { ymd: ymd, list: pickMissions(ymd) };
    }
    return m;
  }

  // 앱 진입/복귀 시 한 번에 정산
  function settle(m, now) { regenHearts(m, now); rolloverDaily(m, now); return m; }

  // ── 영속 ──────────────────────────────────────────────────────────────────
  function saveMeta(m) { var ls = _ls(); if (ls) try { ls.setItem(KEY, JSON.stringify(m)); } catch (e) {} return m; }
  function loadMeta(now) {
    var ls = _ls(), m = null;
    if (ls) {
      try { var raw = ls.getItem(KEY); if (raw) m = normalize(JSON.parse(raw), now); } catch (e) { m = null; }
      if (!m) { try { var old = ls.getItem(OLD_KEY); if (old) m = migrateV1(JSON.parse(old), now); } catch (e) {} }
    }
    if (!m) m = defaultMeta(now);
    settle(m, now);
    if (ls) saveMeta(m);
    return m;
  }

  // ── 지갑/하트 조작 ──────────────────────────────────────────────────────────
  function addCoins(m, d) {
    d = d | 0;
    if (d > 0) { var st = _ensureStats(m); st.coinsEarned = Math.max(0, (st.coinsEarned | 0) + d); }  // 누적 획득 코인(양수만, 업적 coins_earned)
    m.wallet.coins = Math.max(0, (m.wallet.coins | 0) + d); return m.wallet.coins;
  }
  function addCubes(m, d) { m.wallet.cubes = Math.max(0, (m.wallet.cubes | 0) + (d | 0)); return m.wallet.cubes; }
  // ── 공통 코인/숫자 표기 포맷(인게임·로비 동일 SSOT 형식) ────────────────────────
  //   [요청] K·M 약식 표기 + 보유 최대 99.9M. 가장 긴 문자열이 "99.9M"(5자)이 되도록 폭을 제한:
  //     1e6↑ → "1.5M"/"99.9M"(소수1, .0 제거) · 1e5↑ → "100K"~"999K"(소수 없음) · 1e3↑ → "1.5K"~"99.9K"(소수1) · 그 외 정수.
  //   인게임 #coin-amount 와 로비 코인 HUD 가 같은 값·같은 문자열을 보이도록 단일 포맷터를 공유한다.
  function fmtCoins(n) {
    n = (+n) || 0; n = (n | 0);
    if (n >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
    if (n >= 1e5) return Math.floor(n / 1e3) + 'K';
    if (n >= 1e3) return +(n / 1e3).toFixed(1) + 'K';
    return String(n);
  }
  function canPlay(m, now) { regenHearts(m, now); return !!(m.hearts.count > 0 || (m.hearts.infiniteUntil && _now(now) < m.hearts.infiniteUntil)); }
  function loseHeart(m, now) {  // 실패 시 1 차감
    regenHearts(m, now);
    if (m.hearts.infiniteUntil && _now(now) < m.hearts.infiniteUntil) return m.hearts.count;
    if (m.hearts.count >= m.hearts.max) m.hearts.lastRegenTs = _now(now);  // 가득→차감 시작점 고정
    m.hearts.count = Math.max(0, m.hearts.count - (B().hearts.loseOnFail | 0));
    return m.hearts.count;
  }
  function refillHeartsByCoins(m, now) {
    if (m.hearts.count >= m.hearts.max) return false;
    if ((m.wallet.coins | 0) < B().hearts.refillCoins) return false;
    addCoins(m, -B().hearts.refillCoins);
    m.hearts.count = m.hearts.max; m.hearts.lastRegenTs = _now(now);
    return true;
  }

  // ── 부스터 인벤토리 조작(상점 구매 / 인게임 사용) ───────────────────────────
  function boosterPrice(id) { var p = B().boosters; return (p && typeof p[id] === 'number') ? (p[id] | 0) : null; }
  function boosterCount(m, id) { return (m.boosters && (m.boosters[id] | 0)) || 0; }
  function addBooster(m, id, n) {   // 직접 가감(보상 적립 등). 음수 클램프.
    if (!m.boosters) m.boosters = emptyBoosters();
    if (boosterPrice(id) == null) return boosterCount(m, id);  // 미지의 부스터는 무시
    m.boosters[id] = Math.max(0, boosterCount(m, id) + (n | 0));
    return m.boosters[id];
  }
  // 코인으로 부스터 1개 구매. 가격 미상/코인 부족이면 false(음수 잔액 불가 — addCoins 가드).
  function buyBooster(m, id) {
    var price = boosterPrice(id);
    if (price == null) return false;
    if ((m.wallet.coins | 0) < price) return false;
    addCoins(m, -price);          // addCoins 가 Math.max(0,…) 로 음수 잔액 차단
    addBooster(m, id, 1);
    return true;
  }
  // 인게임 사용: 보유분이 있으면 1 차감하고 true. 없으면 false(사용 불가).
  function useBooster(m, id) {
    if (boosterCount(m, id) <= 0) return false;
    addBooster(m, id, -1);
    var st = _ensureStats(m); st.boosterUsed = Math.max(0, (st.boosterUsed | 0) + 1);   // 누적 부스터 사용(업적 use_booster)
    return true;
  }

  // ── 디오라마 조립(큐브 적립) ─────────────────────────────────────────────────
  //   반환: { added, filled, total, percent, justCompleted, worldJustCompleted, nextWorldId, crossedMilestones }
  //   crossedMilestones = 이번 적립으로 새로 '넘은' 마일스톤 [{pct, reward, applied}] (디오라마별 1회, 보상은 여기서 즉시 적립).
  function fillDiorama(m, dioramaId, cubes, now) {
    now = _now(now);
    var d = CB.dioramaById(dioramaId); if (!d) return null;
    var before = _getFill(m, d);
    var room = d.voxelTotal - before;
    var add = Math.max(0, Math.min(room, cubes | 0));
    var filled = before + add;
    _setFill(m, d, filled);
    // ── Wave2-A: 디오라마 fill % 마일스톤(33/66/100) 교차 감지 + 보상 적립(디오라마별 1회) ──
    var crossed = _checkDioramaMilestones(m, d, before, filled, now);
    var justCompleted = before < d.voxelTotal && filled >= d.voxelTotal;
    var worldJustCompleted = null, nxt = null;
    if (justCompleted) {
      _ensureAlbum(m, d.id, ymdKST(now));
      var w = CB.worldById(d.worldId);
      var wasComplete = m.completedWorlds.indexOf(w.id) >= 0;
      var nowComplete = w.dioramaIds.every(function (did) { var dd = CB.dioramaById(did); return _getFill(m, dd) >= dd.voxelTotal; });
      if (!wasComplete && nowComplete) { m.completedWorlds.push(w.id); worldJustCompleted = w.id; nxt = CB.nextWorldId(w.id); }
    }
    return { added: add, filled: filled, total: d.voxelTotal, percent: filled / d.voxelTotal,
             justCompleted: justCompleted, worldJustCompleted: worldJustCompleted, nextWorldId: nxt,
             crossedMilestones: crossed };
  }

  // before/after fill 로 마일스톤 교차를 판정해 (디오라마별 1회) 보상 적립. 반환: 새로 넘은 마일스톤 목록.
  //   threshold(33/66/100)% 를 'before% < threshold ≤ after%' 로 넘고, 아직 미지급이면 지급 + 플래그 적재.
  function _checkDioramaMilestones(m, d, beforeCubes, afterCubes, now) {
    var defs = B().dioramaMilestones || []; if (!defs.length) return [];
    if (!m.dioramaMilestones) m.dioramaMilestones = {};
    var done = m.dioramaMilestones[d.id] || (m.dioramaMilestones[d.id] = []);
    var beforePct = (d.voxelTotal > 0) ? (beforeCubes / d.voxelTotal) * 100 : 0;
    var afterPct  = (d.voxelTotal > 0) ? (afterCubes  / d.voxelTotal) * 100 : 0;
    var out = [];
    defs.forEach(function (def) {
      var th = def.pct | 0;
      if (done.indexOf(th) >= 0) return;                       // 이미 지급(재지급 금지)
      if (beforePct < th && afterPct >= th) {                  // 이번에 '넘음'
        done.push(th);
        applyReward(m, def.reward, now);                       // 코인/부스터 즉시 적립
        out.push({ pct: th, reward: _clone(def.reward), applied: true });
      }
    });
    return out;
  }
  function dioramaPercent(m, dioramaId) {
    var d = CB.dioramaById(dioramaId); if (!d) return 0;
    return Math.max(0, Math.min(1, _getFill(m, d) / d.voxelTotal));
  }
  function worldProgressCount(m, worldId) {  // 완성 디오라마 / 전체
    var w = CB.worldById(worldId); if (!w) return { done: 0, total: 0 };
    var done = 0; w.dioramaIds.forEach(function (did) { var d = CB.dioramaById(did); if (_getFill(m, d) >= d.voxelTotal) done++; });
    return { done: done, total: w.dioramaIds.length };
  }

  // ── 일일 보상 ───────────────────────────────────────────────────────────────
  function dailyState(m, now) {
    var ymd = ymdKST(now);
    var claimedToday = m.daily.lastClaimYmd === ymd;
    var nextDay = claimedToday ? m.daily.streak : (m.daily.streak % 7) + 1;
    return { ymd: ymd, claimedToday: claimedToday, streak: m.daily.streak, nextDay: nextDay, table: B().daily };
  }
  function claimDaily(m, now) {
    var ymd = ymdKST(now);
    if (m.daily.lastClaimYmd === ymd) return { ok: false, reason: 'already' };
    var consecutive = m.daily.lastClaimYmd && (_ymdToDays(ymd) - _ymdToDays(m.daily.lastClaimYmd) === 1);
    m.daily.streak = consecutive ? (m.daily.streak % 7) + 1 : 1;
    m.daily.lastClaimYmd = ymd;
    var st = _ensureStats(m); if ((m.daily.streak | 0) > (st.bestStreak | 0)) st.bestStreak = m.daily.streak | 0;  // 최고 연속출석(업적 daily_streak)
    var reward = B().daily[(m.daily.streak - 1) % 7].reward;
    applyReward(m, reward, now);
    return { ok: true, day: m.daily.streak, reward: reward };
  }

  // ── 무료 일일 코인(상점, UTC 자정 리셋) ───────────────────────────────────────
  //   하루(UTC) 1회 수령. m.freeCoinUTC = 마지막 수령 UTC 날짜(YYYY-MM-DD).
  //   canClaimFreeCoins: 오늘(UTC) 아직 안 받았으면 true.  claimFreeCoins: 받을 수 있으면 +amount 코인.
  function canClaimFreeCoins(m, now) {
    if (!m) return false;
    return ymdUTC(now) !== (m.freeCoinUTC || '');
  }
  function claimFreeCoins(m, now) {
    if (!canClaimFreeCoins(m, now)) return false;
    var amt = (B().freeCoins && (B().freeCoins.amount | 0)) || 0;
    addCoins(m, amt);                 // 누적 획득 코인 통계도 함께 반영(addCoins 내부)
    m.freeCoinUTC = ymdUTC(now);
    return true;
  }

  // ── 미션 진행/수령 ───────────────────────────────────────────────────────────
  function missionProgress(m, type, amount, now) {
    rolloverDaily(m, now);
    m.missions.list.forEach(function (ms) {
      if (ms.type === type && !ms.claimed) ms.progress = Math.min(ms.target, ms.progress + (amount == null ? 1 : amount));
    });
    return m.missions.list;
  }
  function claimMission(m, missionId, now) {
    for (var i = 0; i < m.missions.list.length; i++) {
      var ms = m.missions.list[i];
      if (ms.id === missionId) {
        if (ms.claimed || ms.progress < ms.target) return { ok: false };
        ms.claimed = true; applyReward(m, ms.reward, now);
        return { ok: true, reward: ms.reward };
      }
    }
    return { ok: false };
  }

  function applyReward(m, r, now) {
    if (!r) return;
    if (r.coins) addCoins(m, r.coins);
    if (r.cubes) addCubes(m, r.cubes);
    if (r.hearts) { regenHearts(m, now); m.hearts.count = Math.min(m.hearts.max + r.hearts, m.hearts.count + r.hearts); }
    if (r.booster) addBooster(m, r.booster, 1);   // 부스터 보상 → 인벤토리 적립(Phase 9)
    return m;
  }

  // ── Wave2-B: 업적(achievements) — 진행 파생 + 티어 수령 ──────────────────────
  //   진행도는 가능한 한 기존 상태에서 파생. 누적값(coinsEarned/boosterUsed/bestStreak)만 m.stats.
  function achievementStat(m, statKey) {
    switch (statKey) {
      case 'clear_total':     return m.unlockedStageIndex | 0;                                  // 누적 클리어 = 해금 순번
      case 'collect_diorama': return (m.album || []).filter(function (a) { return a.completed; }).length;
      case 'complete_world':  return (m.completedWorlds || []).length;
      case 'coins_earned':    return (m.stats && m.stats.coinsEarned) | 0;
      case 'daily_streak':    return Math.max((m.stats && m.stats.bestStreak) | 0, (m.daily && m.daily.streak) | 0);
      case 'use_booster':     return (m.stats && m.stats.boosterUsed) | 0;
      default: return 0;
    }
  }
  // 한 업적의 현재 상태: { id, label, stat, progress, claimedTier, totalTiers, tiers:[{target,reward,reached,claimed,claimable}],
  //   currentTarget(다음 미수령 목표), reward(다음 미수령 보상), claimable(수령가능), allClaimed }.
  function achievementOne(m, def) {
    var progress = achievementStat(m, def.stat);
    var claimedTier = Math.max(0, Math.min(def.tiers.length, (m.achievements && m.achievements[def.id]) | 0));
    var tiers = def.tiers.map(function (t, i) {
      var reached = progress >= t.target;
      var claimed = i < claimedTier;
      return { target: t.target, reward: _clone(t.reward), reached: reached, claimed: claimed,
               claimable: reached && !claimed };
    });
    // 현재 진행 중(=수령할/도달할) 티어 = claimedTier 인덱스(다음 미수령). 전부 수령했으면 null.
    var cur = (claimedTier < def.tiers.length) ? def.tiers[claimedTier] : null;
    var claimable = !!cur && progress >= cur.target;          // 다음 미수령 티어에 이미 도달 → 수령 가능
    return { id: def.id, label: def.label, stat: def.stat, progress: progress,
             claimedTier: claimedTier, totalTiers: def.tiers.length, tiers: tiers,
             currentTarget: cur ? cur.target : (def.tiers[def.tiers.length - 1].target),
             reward: cur ? _clone(cur.reward) : null,
             claimable: claimable, allClaimed: claimedTier >= def.tiers.length };
  }
  function achievementState(m) { return _achievementDefs().map(function (def) { return achievementOne(m, def); }); }
  // 업적 1 티어 수령: 다음 미수령 티어에 도달했으면 보상 적립 + claimedTier++. 반환 {ok, tier, reward} / {ok:false}.
  function claimAchievement(m, id, now) {
    var def = _achievementById(id); if (!def) return { ok: false };
    if (!m.achievements) m.achievements = {};
    var claimedTier = Math.max(0, Math.min(def.tiers.length, m.achievements[id] | 0));
    if (claimedTier >= def.tiers.length) return { ok: false, reason: 'all_claimed' };  // 전부 수령
    var t = def.tiers[claimedTier];
    if (achievementStat(m, def.stat) < t.target) return { ok: false, reason: 'not_reached' };  // 미도달
    m.achievements[id] = claimedTier + 1;
    applyReward(m, t.reward, now);
    return { ok: true, tier: claimedTier + 1, reward: _clone(t.reward) };
  }

  Object.assign(CB, {
    META_KEY: KEY, OLD_META_KEY: OLD_KEY,
    ymdKST: ymdKST, ymdUTC: ymdUTC, msToNextUTCDay: msToNextUTCDay, pickMissions: pickMissions,
    canClaimFreeCoins: canClaimFreeCoins, claimFreeCoins: claimFreeCoins,
    defaultMeta: defaultMeta, normalize: normalize, migrateV1: migrateV1,
    regenHearts: regenHearts, msToNextHeart: msToNextHeart, rolloverDaily: rolloverDaily, settle: settle,
    saveMeta: saveMeta, loadMeta: loadMeta,
    addCoins: addCoins, addCubes: addCubes, fmtCoins: fmtCoins, canPlay: canPlay, loseHeart: loseHeart, refillHeartsByCoins: refillHeartsByCoins,
    boosterIds: boosterIds, boosterPrice: boosterPrice, boosterCount: boosterCount,
    addBooster: addBooster, buyBooster: buyBooster, useBooster: useBooster,
    fillDiorama: fillDiorama, dioramaPercent: dioramaPercent, worldProgressCount: worldProgressCount,
    dailyState: dailyState, claimDaily: claimDaily,
    missionProgress: missionProgress, claimMission: claimMission, applyReward: applyReward,
    achievementStat: achievementStat, achievementState: achievementState, claimAchievement: claimAchievement
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = CB;
})();

