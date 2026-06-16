# 관리자 메뉴 및 로그인 팝업 수정

수정 내용:

- OFFICIAL 아래에 별도 `ADMIN` 카테고리 추가
- `관리자 로그인`을 한 줄로 표시
- 관리자 버튼 클릭 시 로그인 팝업이 항상 열리도록 일반 JS 보조 컨트롤러 추가
- Firebase 모듈 로딩 전에도 팝업 열기/닫기 가능
- Google 로그인 버튼은 기존 Firebase Authentication을 그대로 사용

실제 변경 파일:

- index.html
- css/admin-auth.css
- js/admin-auth.js
- js/admin-modal.js
