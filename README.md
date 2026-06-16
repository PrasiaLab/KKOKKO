# 맛나는꼬꼬 프라시아 연구소 공개 콘텐츠 통합본 v1

## 이번 버전에 포함된 내용

### 1차
- 전체 폰트 체계 재정비
- 작은 글씨 크기 및 명도 개선
- 과도한 볼드체 완화
- 방송일정 월간 달력 UI
- 휴방 / 특별방송 / 시간변경 / 합방 표시
- 리뷰 방송 최대 6개
- 토벌 공략 최대 6개
- 6개 이후 유튜브 채널 이동 버튼

### 3차
- Firestore `notices` 읽기 연결
- 메인화면 최신 안내사항 4개 표시
- 안내사항 목록 및 상세 연결
- URL `?page=notice&id=문서ID` 지원
- Firestore `scheduleEvents` 달력 연결
- Firestore `videos` 영상 카드 연결
- Firebase 영상이 없으면 기존 `videos.json` 유지

### 결사 조회 팝업
- 기본 결사 정보: `Who_are_you_guild.json`
- 결사원과 통계: `Who_are_you_class.json`
- 직업 / 토벌 / 레벨 가로 막대 통계
- 막대 클릭 시 하단 결사원 목록 필터
- 전체 결사원 보기 버튼

### 구글 시트
- 정상 동작 중인 `#gid=...`
- 버튼 전환 시 `about:blank` 초기화
- 이 방식은 그대로 유지해야 합니다.

## 업로드 파일

압축을 풀고 동일 경로에 덮어씁니다.

- `index.html`
- `css/improvements.css`
- `css/calendar.css`
- `css/firebase-content.css`
- `css/guild-stats.css`
- `js/app.js`
- `js/guild-search.js`
- `js/calendar.js`
- `js/firebase-content.js`
- `firestore.rules`

기존 파일은 유지합니다.

- `css/style.css`
- `css/statistics.css`
- `css/guild-search.css`
- `js/mappings.js`
- `js/statistics.js`
- `js/data-status.js`
- `data/*.json`
- `images/*`

## Firestore 규칙

Firebase 콘솔:

`Firestore Database → 규칙`

에서 `firestore.rules` 내용을 붙여넣고 게시합니다.

현재 규칙은 공개 읽기만 허용하고 쓰기는 모두 차단합니다.
관리자 쓰기 권한은 마지막 관리자 단계에서 추가합니다.

## Firestore 컬렉션

### notices

- `category`: 문자열, 예: `공지`
- `title`: 문자열
- `content`: 문자열
- `visible`: 불리언 `true`
- `pinned`: 불리언
- `createdAt`: 타임스탬프
- `updatedAt`: 타임스탬프

### scheduleEvents

- `date`: 문자열, 반드시 `YYYY-MM-DD`
- `type`: 문자열
  - `dayoff`: 휴방
  - `special`: 특별방송
  - `timechange`: 시간변경
  - `collab`: 합방
- `title`: 문자열
- `description`: 문자열
- `visible`: 불리언 `true`

### videos

- `type`: 문자열
  - `featured`: 메인 주요 영상
  - `review`: 리뷰 방송
  - `raid`: 토벌 공략
- `title`: 문자열
- `description`: 문자열
- `category`: 문자열
- `url`: 유튜브 주소
- `youtubeId`: 유튜브 영상 ID
- `order`: 숫자
- `visible`: 불리언 `true`

## Firestore 색인 안내

복합 쿼리 때문에 처음 실행 시 브라우저 콘솔에 색인 생성 링크가 표시될 수 있습니다.
해당 링크를 눌러 색인을 생성하면 됩니다.

필요 색인 조합:

- notices: `visible`, `pinned`, `createdAt`
- scheduleEvents: `visible`, `date`
- videos: `visible`, `order`
