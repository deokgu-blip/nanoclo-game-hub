
  const DESIGN_W = 390;
  const DESIGN_H = 844;

  const GAME_CONFIG = {
    ROTATION_SPEED: 0.5,      // 기본 모델 회전 속도(rad/s). 실제 적용은 스테이지 데이터 rotationSpeed 가 우선(현재 0.5, 사용자 지정). 피버는 CRISIS_ROTATE_SPEED(절대값).
    BULLET_SPEED: 40,
    FIRE_INTERVAL: 0.05,
    DEPLOY_FLY_TIME: 0.10,    // 큐→슬롯 점프 시간(초). 점프 느낌만 남기고 거의 즉시 배치
    FAIL_IDLE_SECONDS: 3,
    CONTINUE_COST: 300,            // 게임오버 시 '계속 플레이' 코인 비용
    CRISIS_CANNON_THRESHOLD: 5,
    CRISIS_SPEED_MULT: 5,     // ★마지막 5마리(피버) 때 총알속도·발사간격 5배(사용자 요청 2026-07-01, 3→5). 릴스+상용 공용.
    CRISIS_ROTATE_SPEED: 5,   // ★피버 때 모델 회전 = 절대 5 rad/s (3→5, 사용자 "회전 속도 올려줘").
    ACTIVE_SLOTS: 5,
    VOXEL_SIZE: 1.15,
    CAMERA_FOV: 38,
    CAMERA_DISTANCE: 26,
    ZOOM_MIN: 16,
    ZOOM_MAX: 150,
    BLASTER_AVG_BULLETS: 12,    // 색상당 복셀 수 / 평균 = 캐논 수. 12로 낮춰 더 많은 작은 캐논 생성 (총알 총합 = 복셀 수)
    BLASTER_MIN_BULLETS: 5,
    BLASTER_MAX_BULLETS: 50,
    SHAKE_INTENSITY: 0.18,
    SHAKE_DURATION: 0.16,
    FLASH_DURATION: 0.08,
    PARTICLES_PER_HIT: 6,
    PARTICLE_LIFE: 0.5,
    COMBO_THRESHOLD: 5,
    CLEAR_HOLD_SECONDS: 1.0,
    RESULT_DELAY_SECONDS: 2.0,   // 클리어 순간 → 결과창 노출까지 지연(마지막 블래스트 감상)
    AUTO_ROTATE: true
  };

  // ===== haptics (APK: iOS / Android) =====
  // 단일 HTML 배포물 → 두 경로로 발동(둘 다 없으면 조용히 무시 = 데스크톱 안전):
  //  1) 네이티브 브리지(있으면 우선, 강도별 진짜 햅틱). APK 래퍼가 아래 중 하나만 구현하면 됨:
  //       iOS(WKWebView):        window.webkit.messageHandlers.haptic.postMessage(level)
  //       Android(JS interface): window.AndroidHaptic.impact(level)
  //       공통(권장):            window.Haptics.impact(level)
  //     level: 'selection'(굉장히 약) | 'light'(약) | 'medium' | 'heavy'
  //       → iOS: UISelectionFeedbackGenerator / UIImpactFeedbackGenerator(.light/.medium/.heavy)
  //       → Android: VibrationEffect(amplitude)로 매핑 권장.
  //  2) 웹 Vibration API 폴백(Android 브라우저/WebView): 강도를 진동 길이(ms)로 근사. iOS Safari 미지원.
  const HAPTIC = {
    enabled: true,
    MS:  { soft:12, selection:8, light:16, medium:28, heavy:48 },   // 웹 폴백 진동 길이(ms)
    GAP: { soft:55, selection:50, light:60 }                        // 스로틀(ms): 모터 과부하/연사 방지
  };
  const _hapticLast = {};
  function haptic(level, core){
    if (!HAPTIC.enabled) return;
    if (!core) return;   // ★ 햅틱은 '복셀 깨짐(removeVoxel)'·'문어 배치(sfx_place)' 두 코어 이벤트만 재생(사용자 지침 2026-06-22). 그 외 호출은 무음.
    try{ var _gr=window.__GR; if (_gr && _gr.active){ _gr.vibrate(level); return; } }catch(e){}   // gamereels: 진동은 '호스트에 위임만'(Soft/Light/MediumVibrate 신호) — /simo 규약상 호스트 컨텍스트에선 navigator.vibrate 등 로컬 폴백 금지(return). 비-호스트(APK/웹)만 아래 폴백.
    const gap = HAPTIC.GAP[level] || 0;
    if (gap){
      const t = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
      if (t - (_hapticLast[level]||0) < gap) return;       // 너무 잦으면 스킵(특히 selection 틱)
      _hapticLast[level] = t;
    }
    try{
      if (window.Haptics && window.Haptics.impact){ window.Haptics.impact(level); return; }
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic){ window.webkit.messageHandlers.haptic.postMessage(level); return; }
      if (window.AndroidHaptic && window.AndroidHaptic.impact){ window.AndroidHaptic.impact(level); return; }
    }catch(e){}
    try{ if (navigator.vibrate) navigator.vibrate(HAPTIC.MS[level]||12); }catch(e){}
  }

  const GAME_CONFIG_META = {
    ROTATION_SPEED:        { label: '자동 회전 속도(rad/s)', min: 0, max: 3, step: 0.01 },
    BULLET_SPEED:          { label: '총알 비행 속도(units/s)', min: 8, max: 600, step: 1 },
    FIRE_INTERVAL:         { label: '발사 간격(초/발)', min: 0.05, max: 1.5, step: 0.05 },
    DEPLOY_FLY_TIME:       { label: '대포 배치 비행 시간(초)', min: 0.1, max: 1.2, step: 0.05 },
    FAIL_IDLE_SECONDS:     { label: '발사정지 실패 시간(초)', min: 1, max: 10, step: 0.5 },
    CRISIS_CANNON_THRESHOLD:{ label: '위기 모드 진입 대포 수', min: 1, max: 12, step: 1 },
    CRISIS_SPEED_MULT:     { label: '위기 모드 배속', min: 1, max: 6, step: 0.5 },
    ACTIVE_SLOTS:          { label: '활성 슬롯 수', min: 3, max: 7, step: 1 },
    VOXEL_SIZE:            { label: '보셀 크기(겹침)', min: 0.6, max: 1.4, step: 0.02 },
    CAMERA_FOV:            { label: '카메라 FOV', min: 25, max: 60, step: 1 },
    CAMERA_DISTANCE:       { label: '카메라 기본 거리', min: 12, max: 48, step: 1 },
    ZOOM_MIN:              { label: '최소 줌 거리', min: 8, max: 30, step: 1 },
    ZOOM_MAX:              { label: '최대 줌 거리', min: 24, max: 100, step: 1 },
    BLASTER_AVG_BULLETS:   { label: '대포 평균 총알 수', min: 20, max: 80, step: 5 },
    BLASTER_MIN_BULLETS:   { label: '대포 최소 총알 수', min: 1, max: 40, step: 1 },
    BLASTER_MAX_BULLETS:   { label: '대포 최대 총알 수', min: 30, max: 150, step: 5 },
    SHAKE_INTENSITY:       { label: '카메라 셰이크 강도', min: 0, max: 1, step: 0.02 },
    SHAKE_DURATION:        { label: '셰이크 지속(초)', min: 0, max: 0.6, step: 0.02 },
    FLASH_DURATION:        { label: '명중 플래시 지속(초)', min: 0, max: 0.4, step: 0.02 },
    PARTICLES_PER_HIT:     { label: '명중당 파티클 수', min: 0, max: 20, step: 1 },
    PARTICLE_LIFE:         { label: '파티클 수명(초)', min: 0.1, max: 1.5, step: 0.1 },
    COMBO_THRESHOLD:       { label: '콤보 표시 시작 명중 수', min: 2, max: 20, step: 1 },
    CLEAR_HOLD_SECONDS:    { label: '결과 오버레이 노출(초)', min: 0.3, max: 3, step: 0.1 },
    AUTO_ROTATE:           { label: '자동 회전 사용' }
  };
