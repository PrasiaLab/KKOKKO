결사 이동 추적 v3 모듈 적용 안내
=================================

이 압축은 기존 배포 사이트 파일을 덮어쓰지 않도록, 새로 추가해야 하는 파일만 담았습니다.
기존 index.html, js/app.js, css/style.css, admin.html 등은 포함하지 않았습니다.

1. 추가되는 주요 경로
--------------------

pages/guild-trace.html
  - 독립형 결사 이동 추적 페이지입니다.
  - 기존 index.html과 이름이 겹치지 않습니다.

css/guild-trace.css
js/guild-trace-app.js
js/guild-trace-compare.js
js/guild-trace-mappings.js
  - 추적 페이지 전용 CSS/JS입니다.
  - 기존 css/style.css, js/app.js, js/mappings.js와 충돌하지 않도록 이름을 변경했습니다.

data/guild-trace/
  - 추적 페이지 전용 데이터 폴더입니다.
  - 기존 data/Who_are_you.json 등과 섞이지 않습니다.

scripts/guild_trace/
  - 추적 페이지 전용 스냅샷 생성 PY 파일입니다.
  - 기존 scripts/Who_are_you_all_ranking.py와 충돌하지 않습니다.

.github/workflows/update-guild-trace-snapshot.yml
  - 결사 이동 추적 전용 수동 갱신 Actions입니다.
  - schedule 자동 실행은 넣지 않았습니다.
  - GitHub Actions에서 수동 실행만 하도록 구성했습니다.


2. 공개 전 기본 상태
-------------------

data/guild-trace/site_config.json 기본값은 다음처럼 닫힘 상태입니다.

{
  "trace_enabled": false,
  "trace_message": "서버 이전 추적 페이지는 서버 이전 기간에만 운영됩니다.",
  "default_before_snapshot": "2026-06-25_1150",
  "default_after_snapshot": "latest"
}

이 상태에서는 pages/guild-trace.html에 직접 접속해도 안내문만 표시됩니다.
공개 또는 테스트하려면 trace_enabled를 true로 바꾸면 됩니다.


3. 페이지 공개 방식
-----------------

이번 패키지는 기존 메인 메뉴를 수정하지 않습니다.
따라서 업로드 후에도 메인 사이트 메뉴에는 자동으로 노출되지 않습니다.

직접 접속 주소 예시:
/pages/guild-trace.html

나중에 메뉴에 연결하려면 기존 사이트 메뉴에 아래 링크만 추가하면 됩니다.

<a href="pages/guild-trace.html">결사 이동 추적</a>


4. 3차 개선 적용 내용
-------------------

현재 가능한 3차 개선 중 아래 내용을 적용했습니다.

- 추적 페이지 독립 모듈화
- html/js/css 파일명 충돌 제거
- 데이터 경로를 data/guild-trace로 분리
- PY 파일 출력 경로와 JSON 파일명을 추적 전용으로 변경
- 공개 화면에서 좌측 메뉴 제거
- 하단 판정기준 영역 제거
- [보기] 상세 화면에서 세부 산식/세부 기준 제거
- [보기] 상세 화면은 아래 항목만 유지
  - 유사도
  - 내부 정렬점수
  - 판정
  - 이전 점수
  - 이후 점수
  - 이전 기준
  - 이후 기준
- 이전 기준/이후 기준은 A조건, A+B조건, B조건처럼 내부 기준명으로 표시
- site_config.json 기반 ON/OFF 표시 구조 준비


5. 2차 비교 기준 유지
-------------------

내부 계산 기준은 기존 2차 개선안을 유지합니다.
다만 공개 화면에는 세부 기준을 직접 노출하지 않습니다.

내부 기준:
- 92+ 관측 멤버 3명 이상: 기존 92+ 기준
- 92+ 관측 멤버 1~2명: 91레벨 보조 포함
- 92+ 관측 멤버 0명: 실제 존재하는 상위 3개 레벨 기준

공개 표시:
- 92+ 기준: A조건
- 92+ + 91 보조: A+B조건
- 상위 3개 레벨: B조건


6. JSON 파일명 변경
-----------------

기존 배포 사이트 data/*.json과 겹치지 않도록 추적 전용 raw JSON은 아래 이름으로 저장됩니다.

기존:
- data/Who_are_you.json
- data/Who_are_you_class.json
- data/Who_are_you_guild.json
- data/Who_are_you_guild_score.json
- data/ranking_update_status.json

추적 전용:
- data/guild-trace/raw/trace_who_are_you.json
- data/guild-trace/raw/trace_who_are_you_class.json
- data/guild-trace/raw/trace_who_are_you_guild.json
- data/guild-trace/raw/trace_who_are_you_guild_score.json
- data/guild-trace/raw/trace_ranking_update_status.json

스냅샷 저장 위치:
- data/guild-trace/snapshots/{snapshot_id}/guilds.json
- data/guild-trace/snapshots/{snapshot_id}/snapshot_info.json

스냅샷 목록:
- data/guild-trace/snapshots_index.json
- data/guild-trace/snapshots/manifest.json


7. GitHub Actions 수동 실행
-------------------------

새 workflow 이름:
Update Guild Trace Snapshot

실행 파일:
python scripts/guild_trace/run_snapshot.py

입력값:
- snapshot_id: 비우면 현재 KST 시간
- use_existing: true/false

사용 예시:

서버 이전 전 기준 데이터 저장:
- snapshot_id: 예) 2026-07-01_before
- use_existing: false

서버 이전 이후 최신 데이터 저장:
- snapshot_id: 비워도 됨 또는 2026-07-01_after
- use_existing: false

이미 raw JSON을 수동으로 넣어둔 상태에서 스냅샷만 다시 만들기:
- use_existing: true


8. 관리자센터 관련
----------------

이번 패키지에는 관리자센터 메뉴 수정 또는 수동 갱신 버튼 추가는 포함하지 않았습니다.
월요일 공개 전 안정성을 위해 보류하는 쪽이 안전합니다.

다만 나중에 관리자센터에 ON/OFF를 붙일 때는 data/guild-trace/site_config.json의 trace_enabled 값을 바꾸는 방식으로 연결하면 됩니다.

