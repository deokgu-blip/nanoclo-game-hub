
/* ★롱프레스 콜아웃 차단 (릴스앱 웹뷰 공통) — 꾹 누를 때 iOS 돋보기·텍스트선택/복사 메뉴, 우클릭 메뉴 억제.
   CSS(-webkit-touch-callout/user-select)만으론 일부 WKWebView 에서 루페가 떠서 JS 가드 병행. 게임 입력엔 영향 0. */
(function(){
  var stop=function(e){ e.preventDefault(); };
  document.addEventListener('contextmenu', stop, {passive:false});
  document.addEventListener('selectstart', stop, {passive:false});
  // iOS 11+ 텍스트 선택 루페 유발하는 제스처 시작 억제(멀티터치 핀치 등은 touch-action 이 별도 처리).
  document.addEventListener('gesturestart', stop, {passive:false});
})();
