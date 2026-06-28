import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

import {
  firebaseConfig,
  isConfiguredAdmin
} from "./firebase-config.js";

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-northeast3");
const provider = new GoogleAuthProvider();

const triggerRankingUpdateCall = httpsCallable(
  functions,
  "triggerRankingUpdate"
);

const getRankingUpdateStatusCall = httpsCallable(
  functions,
  "getRankingUpdateStatus"
);


const pageTitles = {
  notice: "안내사항 관리",
  rolling: "한줄 공지 관리",
  schedule: "방송 일정 관리",
  live: "라이브 방송 관리",
  video: "영상 관리",
  data: "데이터 갱신",
  guildTrace: "결사 이전 분석 관리"
};

let noticeItems = [];
let rollingNoticeItems = [];
let scheduleItems = [];
let videoItems = [];
let activeVideoFilter = "all";
let rankingStatusTimer = null;
let activeRankingRunId = null;
let rankingRequestedAt = null;
let guildTraceStatusTimer = null;
let activeGuildTraceRunId = null;
let guildTraceRequestedAt = null;
let currentAdminUser = null;

const LIVE_STATUS_DOC = ["siteSettings", "liveStatus"];
const GUILD_TRACE_CONFIG_DOC = ["siteSettings", "guildTraceConfig"];
const DEFAULT_LIVE_URL =
  "https://www.youtube.com/@%EB%A7%9B%EB%82%98%EB%8A%94%EA%BC%AC%EA%BC%AC";

const $ = (id) => document.getElementById(id);


let adminAuthorized = false;
let authCheckFinished = false;

function setGateState({ icon = "⌛", title, message, mode = "checking" }) {
  const gateIcon = $("adminAccessGateIcon");
  const gateTitle = $("adminAccessGateTitle");
  const gateMessage = $("adminAccessGateMessage");
  const loginButton = $("adminGateLoginButton");
  const retryButton = $("adminGateRetryButton");

  if (gateIcon) {
    gateIcon.textContent = icon;
    gateIcon.className = "admin-access-gate-icon";
    if (mode === "denied") gateIcon.classList.add("denied");
    if (mode === "allowed") gateIcon.classList.add("allowed");
  }

  if (gateTitle) gateTitle.textContent = title;
  if (gateMessage) gateMessage.textContent = message;
  if (loginButton) loginButton.hidden = mode !== "login";
  if (retryButton) retryButton.hidden = mode !== "denied";
}

function lockAdminApp() {
  adminAuthorized = false;
  currentAdminUser = null;
  document.body.classList.add("admin-auth-pending");
  $("adminApp")?.setAttribute("hidden", "");
  $("adminAccessGate")?.removeAttribute("hidden");
}

function unlockAdminApp() {
  adminAuthorized = true;
  document.body.classList.remove("admin-auth-pending");
  $("adminAccessGate")?.setAttribute("hidden", "");
  $("adminApp")?.removeAttribute("hidden");
}

function assertClientAdmin() {
  if (
    !adminAuthorized ||
    !currentAdminUser ||
    !isConfiguredAdmin(currentAdminUser.uid)
  ) {
    lockAdminApp();
    setGateState({
      icon: "🔒",
      title: "관리자 권한이 필요합니다",
      message: "등록된 관리자 계정으로 다시 로그인해주세요.",
      mode: "denied"
    });
    throw new Error("ADMIN_PERMISSION_REQUIRED");
  }
}

async function openAdminLogin(forceAccountSelect = false) {
  setGateState({
    icon: "⌛",
    title: "Google 로그인 진행 중",
    message: "관리자 계정을 선택해주세요.",
    mode: "checking"
  });

  try {
    if (forceAccountSelect && auth.currentUser) {
      await signOut(auth);
    }
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    await requireAdmin(result.user);
  } catch (error) {
    console.error("관리자 로그인 오류", error);
    if (error?.code === "auth/popup-closed-by-user") {
      setGateState({
        icon: "🔒",
        title: "관리자 로그인이 필요합니다",
        message: "로그인 창이 닫혔습니다. 등록된 관리자 계정으로 로그인해주세요.",
        mode: "login"
      });
      return;
    }
    setGateState({
      icon: "!",
      title: "로그인을 완료하지 못했습니다",
      message: "잠시 후 다시 시도하거나 홈페이지로 돌아가주세요.",
      mode: "login"
    });
  }
}

function showToast(message) {
  const toast = $("adminToast");

  toast.textContent = message;
  toast.classList.add("show");

  window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function setAccess(message, type = "") {
  const target = $("adminAccessMessage");

  target.textContent = message;
  target.className = "admin-access-message";

  if (type) {
    target.classList.add(type);
  }
}

function youtubeIdFromUrl(url = "") {
  const match = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([^?&/]+)/
  );

  return match ? match[1] : "";
}

const VIDEO_TYPE_LABELS = {
  featured: "메인 주요 영상",
  review: "리뷰 방송",
  raid: "토벌 공략"
};

function videoTypeLabel(type) {
  return VIDEO_TYPE_LABELS[type] || "영상";
}

function updateVideoCounts() {
  const counts = {
    all: videoItems.length,
    featured: 0,
    review: 0,
    raid: 0
  };

  videoItems.forEach((item) => {
    if (Object.prototype.hasOwnProperty.call(counts, item.type)) {
      counts[item.type] += 1;
    }
  });

  $("videoCountAll").textContent = counts.all;
  $("videoCountFeatured").textContent = counts.featured;
  $("videoCountReview").textContent = counts.review;
  $("videoCountRaid").textContent = counts.raid;
}

function renderVideoAdminList() {
  updateVideoCounts();

  const filtered =
    activeVideoFilter === "all"
      ? videoItems
      : videoItems.filter(
          (item) => item.type === activeVideoFilter
        );

  renderList(
    "videoAdminList",
    filtered,
    (item) => ({
      title: `${item.order ?? "-"} · ${item.title || "영상"}`,
      meta:
        `${videoTypeLabel(item.type)} · ` +
        `${item.visible ? "공개" : "비공개"}`
    }),
    editVideo
  );
}


const RANKING_STATUS_URL = "./data/ranking_update_status.json";
const RANKING_POLL_INTERVAL = 7000;
const RANKING_MAX_POLL_COUNT = 260;

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function formatCount(value, suffix = "명") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return `${number.toLocaleString("ko-KR")}${suffix}`;
}

function setRankingBadge(text, state = "idle") {
  const badge = $("rankingUpdateBadge");

  badge.textContent = text;
  badge.className = `data-state-badge ${state}`;
}

function setRankingMessage(message, state = "") {
  const target = $("rankingUpdateMessage");

  target.textContent = message;
  target.className = "data-update-message";

  if (state) {
    target.classList.add(state);
  }
}

function setRankingProgress(step) {
  const order = ["request", "queued", "running", "complete"];
  const currentIndex = order.indexOf(step);

  document
    .querySelectorAll("[data-progress-step]")
    .forEach((item) => {
      const itemIndex = order.indexOf(item.dataset.progressStep);

      item.classList.toggle("active", itemIndex === currentIndex);
      item.classList.toggle(
        "done",
        currentIndex >= 0 && itemIndex < currentIndex
      );
    });
}

function resetRankingProgress() {
  activeRankingRunId = null;
  rankingRequestedAt = null;

  if (rankingStatusTimer) {
    window.clearTimeout(rankingStatusTimer);
    rankingStatusTimer = null;
  }

  $("rankingRunId").textContent = "-";
  $("rankingRequestedAt").textContent = "-";
  $("rankingRunConclusion").textContent = "-";

  setRankingProgress("request");
}

async function loadRankingDataStatus() {
  try {
    const response = await fetch(
      `${RANKING_STATUS_URL}?ts=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    $("rankingUpdatedAt").textContent =
      data.updated_at_text || formatDateTime(data.updated_at);

    $("rankingCharacterCount").textContent =
      formatCount(data.character_count, "명");

    $("rankingGuildCount").textContent =
      formatCount(data.guild_count, "개");

    $("rankingClassCount").textContent =
      formatCount(data.class_count, "명");

    if (!activeRankingRunId) {
      if (data.status === "success") {
        setRankingBadge("정상", "success");
        setRankingMessage(
          data.message || "랭킹 데이터가 정상적으로 반영되어 있습니다.",
          "success"
        );
        setRankingProgress("complete");
      } else if (data.status === "partial_failure") {
        setRankingBadge("일부 실패", "error");
        setRankingMessage(
          data.message || "일부 데이터 요청이 실패했습니다.",
          "error"
        );
      } else {
        setRankingBadge("상태 확인", "idle");
        setRankingMessage(
          data.message || "최근 데이터 상태를 확인했습니다."
        );
      }
    }

    return data;
  } catch (error) {
    console.error("랭킹 상태 파일 로드 오류", error);

    if (!activeRankingRunId) {
      setRankingBadge("확인 불가", "error");
      setRankingMessage(
        "최근 데이터 상태를 불러오지 못했습니다.",
        "error"
      );
    }

    return null;
  }
}

function rankingErrorMessage(error) {
  const code = error?.code || "";

  const messages = {
    "functions/unauthenticated":
      "관리자 로그인이 필요합니다.",
    "functions/permission-denied":
      "데이터 갱신 권한이 없는 계정입니다.",
    "functions/internal":
      "GitHub Actions 실행 요청 중 오류가 발생했습니다.",
    "functions/unavailable":
      "Firebase 함수에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
    "functions/deadline-exceeded":
      "요청 시간이 초과되었습니다. GitHub Actions 실행 여부를 확인해주세요."
  };

  return messages[code] ||
    error?.message ||
    "데이터 갱신 요청을 처리하지 못했습니다.";
}

function stopRankingPolling() {
  if (rankingStatusTimer) {
    window.clearTimeout(rankingStatusTimer);
    rankingStatusTimer = null;
  }
}

async function pollRankingRunStatus(runId, pollCount = 0) {
  if (!runId) {
    return;
  }

  try {
    const result = await getRankingUpdateStatusCall({
      runId
    });

    const data = result.data || {};
    const status = data.status;
    const conclusion = data.conclusion;

    $("rankingRunConclusion").textContent =
      conclusion || status || "-";

    if (status === "queued") {
      setRankingBadge("대기 중", "working");
      setRankingMessage(
        "GitHub Actions 실행 대기열에 등록되었습니다.",
        "working"
      );
      setRankingProgress("queued");
    } else if (status === "in_progress") {
      setRankingBadge("갱신 중", "working");
      setRankingMessage(
        "랭킹 데이터를 추출하고 있습니다. 잠시만 기다려주세요.",
        "working"
      );
      setRankingProgress("running");
    } else if (status === "completed") {
      stopRankingPolling();
      activeRankingRunId = null;
      $("rankingUpdateButton").disabled = false;

      if (conclusion === "success") {
        setRankingBadge("완료", "success");
        setRankingMessage(
          "전체 데이터 갱신과 홈페이지 반영이 완료되었습니다.",
          "success"
        );
        setRankingProgress("complete");
        showToast("랭킹 데이터 갱신이 완료되었습니다.");

        window.setTimeout(() => {
          loadRankingDataStatus();
        }, 2500);
      } else {
        setRankingBadge("실패", "error");
        setRankingMessage(
          `데이터 갱신 작업이 실패했습니다. 결과: ${conclusion || "unknown"}`,
          "error"
        );
        $("rankingRunConclusion").textContent =
          conclusion || "실패";
        showToast("랭킹 데이터 갱신에 실패했습니다.");
      }

      return;
    }

    if (pollCount >= RANKING_MAX_POLL_COUNT) {
      stopRankingPolling();
      activeRankingRunId = null;
      $("rankingUpdateButton").disabled = false;
      setRankingBadge("확인 지연", "error");
      setRankingMessage(
        "작업 상태 확인 시간이 길어지고 있습니다. 상태 새로고침을 눌러주세요.",
        "error"
      );
      return;
    }

    rankingStatusTimer = window.setTimeout(() => {
      pollRankingRunStatus(runId, pollCount + 1);
    }, RANKING_POLL_INTERVAL);
  } catch (error) {
    console.error("랭킹 실행 상태 확인 오류", error);

    if (pollCount >= 5) {
      stopRankingPolling();
      activeRankingRunId = null;
      $("rankingUpdateButton").disabled = false;
      setRankingBadge("확인 오류", "error");
      setRankingMessage(
        rankingErrorMessage(error),
        "error"
      );
      return;
    }

    rankingStatusTimer = window.setTimeout(() => {
      pollRankingRunStatus(runId, pollCount + 1);
    }, RANKING_POLL_INTERVAL);
  }
}

async function startRankingUpdate() {
  assertClientAdmin();
  if (activeRankingRunId) {
    showToast("이미 데이터 갱신 작업을 확인하고 있습니다.");
    return;
  }

  const confirmed = window.confirm(
    "전체 랭킹 데이터를 새로 갱신할까요?\n" +
    "완료까지 수 분이 걸릴 수 있습니다."
  );

  if (!confirmed) {
    return;
  }

  const button = $("rankingUpdateButton");

  button.disabled = true;
  resetRankingProgress();
  setRankingBadge("요청 중", "working");
  setRankingMessage(
    "Firebase에서 관리자 권한을 확인하고 있습니다.",
    "working"
  );

  try {
    const result = await triggerRankingUpdateCall({
      source: "admin-page"
    });

    const data = result.data || {};

    rankingRequestedAt = data.requestedAt || new Date().toISOString();
    activeRankingRunId = data.runId || null;

    $("rankingRequestedAt").textContent =
      formatDateTime(rankingRequestedAt);

    $("rankingRunId").textContent =
      activeRankingRunId || "확인 중";

    setRankingProgress("queued");
    setRankingBadge("실행 시작", "working");
    setRankingMessage(
      data.message || "랭킹 데이터 갱신 작업을 시작했습니다.",
      "working"
    );

    if (!activeRankingRunId) {
      button.disabled = false;
      setRankingMessage(
        "작업 실행 요청은 완료됐지만 실행 번호 확인이 지연되고 있습니다. " +
        "잠시 후 상태 새로고침을 눌러주세요.",
        "working"
      );
      showToast("데이터 갱신 작업을 요청했습니다.");
      return;
    }

    showToast("데이터 갱신 작업을 시작했습니다.");
    pollRankingRunStatus(activeRankingRunId);
  } catch (error) {
    console.error("랭킹 갱신 실행 오류", error);

    button.disabled = false;
    activeRankingRunId = null;

    setRankingBadge("실행 실패", "error");
    setRankingMessage(
      rankingErrorMessage(error),
      "error"
    );
    $("rankingRunConclusion").textContent = "요청 실패";

    showToast("데이터 갱신 요청에 실패했습니다.");
  }
}



function setLiveAdminMessage(message, type = "") {
  const target = $("liveAdminMessage");
  if (!target) return;
  target.textContent = message;
  target.className = "live-admin-message";
  if (type) target.classList.add(type);
}

function renderLiveAdminState(data = {}) {
  const isLive = Boolean(data.isLive);
  const stateBadge = $("liveAdminState");
  const urlInput = $("liveAdminUrl");
  if (stateBadge) {
    stateBadge.textContent = isLive ? "LIVE ON" : "방송 대기 중";
    stateBadge.className = `live-admin-state ${isLive ? "on" : "off"}`;
  }
  if (urlInput && document.activeElement !== urlInput) {
    urlInput.value = data.url || DEFAULT_LIVE_URL;
  }
}

async function loadLiveStatus() {
  try {
    const snapshot = await getDoc(doc(db, ...LIVE_STATUS_DOC));
    const data = snapshot.exists()
      ? snapshot.data()
      : { isLive: false, url: DEFAULT_LIVE_URL };
    renderLiveAdminState(data);
    setLiveAdminMessage(
      data.isLive
        ? "현재 홈페이지에 LIVE 상태가 표시되고 있습니다."
        : "현재 홈페이지에는 방송 대기 상태가 표시되고 있습니다.",
      "success"
    );
    return data;
  } catch (error) {
    console.error("라이브 상태 로드 오류", error);
    setLiveAdminMessage(
      "라이브 방송 상태를 불러오지 못했습니다. Firestore 규칙을 확인해주세요.",
      "error"
    );
    return null;
  }
}

async function saveLiveStatus(isLive) {
  assertClientAdmin();
  const urlInput = $("liveAdminUrl");
  const onButton = $("liveOnButton");
  const offButton = $("liveOffButton");
  const url = urlInput?.value.trim() || DEFAULT_LIVE_URL;

  if (isLive && !/^https?:\/\//i.test(url)) {
    setLiveAdminMessage("라이브 연결 주소를 확인해주세요.", "error");
    urlInput?.focus();
    return;
  }

  if (!isLive && !window.confirm("홈페이지의 라이브 상태를 OFF로 변경할까요?")) {
    return;
  }

  onButton.disabled = true;
  offButton.disabled = true;
  setLiveAdminMessage(isLive ? "라이브 상태를 켜는 중입니다." : "방송 종료 상태를 저장하는 중입니다.");

  try {
    await setDoc(
      doc(db, ...LIVE_STATUS_DOC),
      {
        isLive,
        url,
        updatedAt: serverTimestamp(),
        updatedByUid: currentAdminUser?.uid || "",
        updatedByEmail: currentAdminUser?.email || ""
      },
      { merge: true }
    );
    renderLiveAdminState({ isLive, url });
    setLiveAdminMessage(
      isLive ? "라이브 상태를 ON으로 변경했습니다." : "방송 상태를 OFF로 변경했습니다.",
      "success"
    );
    showToast(isLive ? "라이브 상태를 켰습니다." : "방송 상태를 종료했습니다.");
  } catch (error) {
    console.error("라이브 상태 저장 오류", error);
    setLiveAdminMessage(
      "라이브 상태를 저장하지 못했습니다. Firestore 권한을 확인해주세요.",
      "error"
    );
  } finally {
    onButton.disabled = false;
    offButton.disabled = false;
  }
}


function nowKstSnapshotId() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}_${values.hour}${values.minute}`;
}

function formatGuildTraceTitle(config = {}) {
  const title = config.trace_title || "결사 이전 분석";
  const season = String(config.trace_season || "").trim();

  return season ? `${title} (${season})` : title;
}

function setGuildTraceMessage(message, type = "") {
  const target = $("guildTraceAdminMessage");

  if (!target) {
    return;
  }

  target.textContent = message;
  target.className = "data-update-message";

  if (type) {
    target.classList.add(type);
  }
}

function setBooleanControl(id, value) {
  const element = $(id);

  if (!element) {
    return;
  }

  if (element.type === "checkbox") {
    element.checked = Boolean(value);
    return;
  }

  element.value = String(Boolean(value));
}

function getBooleanControl(id) {
  const element = $(id);

  if (!element) {
    return false;
  }

  if (element.type === "checkbox") {
    return element.checked;
  }

  return element.value !== "false";
}

function renderGuildTraceConfig(data = {}) {
  const enabled = data.trace_enabled !== false;
  const menuVisible = data.trace_menu_visible !== false;

  setBooleanControl("guildTraceEnabled", enabled);
  setBooleanControl("guildTraceMenuVisible", menuVisible);
  $("guildTraceTitle").value = data.trace_title || "결사 이전 분석";
  $("guildTraceSeason").value = data.trace_season || "";
  $("guildTraceClosedMessage").value =
    data.trace_closed_message ||
    data.trace_message ||
    "결사 이전 분석 페이지는 서버 이전 기간에만 운영됩니다.";
  $("guildTraceBeforeSnapshot").value =
    data.default_before_snapshot || "2026-06-25_1150";
  $("guildTraceAfterSnapshot").value =
    data.default_after_snapshot || "latest";

  if ($("guildTraceBeforePreview")) {
    $("guildTraceBeforePreview").textContent =
      data.default_before_snapshot || "2026-06-25_1150";
  }

  $("guildTracePreviewTitle").textContent = formatGuildTraceTitle({
    trace_title: $("guildTraceTitle").value,
    trace_season: $("guildTraceSeason").value
  });
  $("guildTraceStateBadge").textContent = enabled ? "ON" : "OFF";
  $("guildTraceStateBadge").className = `data-state-badge ${enabled ? "success" : "idle"}`;
}

async function loadGuildTraceConfig() {
  try {
    const snapshot = await getDoc(doc(db, ...GUILD_TRACE_CONFIG_DOC));
    const data = snapshot.exists()
      ? snapshot.data()
      : {
          trace_enabled: false,
          trace_menu_visible: true,
          trace_title: "결사 이전 분석",
          trace_season: "S34",
          trace_closed_message: "결사 이전 분석 페이지는 서버 이전 기간에만 운영됩니다.",
          default_before_snapshot: "2026-06-25_1150",
          default_after_snapshot: "latest"
        };

    renderGuildTraceConfig(data);
    setGuildTraceMessage("결사 이전 분석 설정을 불러왔습니다.", "success");
    return data;
  } catch (error) {
    console.error("결사 이전 분석 설정 로드 오류", error);
    setGuildTraceMessage(
      "결사 이전 분석 설정을 불러오지 못했습니다. Firestore 규칙을 확인해주세요.",
      "error"
    );
    return null;
  }
}

async function saveGuildTraceConfig() {
  assertClientAdmin();

  const config = {
    trace_enabled: getBooleanControl("guildTraceEnabled"),
    trace_menu_visible: getBooleanControl("guildTraceMenuVisible"),
    trace_title: $("guildTraceTitle").value.trim() || "결사 이전 분석",
    trace_season: $("guildTraceSeason").value.trim(),
    trace_closed_message:
      $("guildTraceClosedMessage").value.trim() ||
      "결사 이전 분석 페이지는 서버 이전 기간에만 운영됩니다.",
    default_before_snapshot:
      $("guildTraceBeforeSnapshot").value.trim() || "2026-06-25_1150",
    default_after_snapshot:
      $("guildTraceAfterSnapshot").value.trim() || "latest",
    updatedAt: serverTimestamp(),
    updatedByUid: currentAdminUser?.uid || "",
    updatedByEmail: currentAdminUser?.email || ""
  };

  const button = $("guildTraceSaveButton");
  button.disabled = true;
  setGuildTraceMessage("결사 이전 분석 설정을 저장하는 중입니다.", "working");

  try {
    await setDoc(doc(db, ...GUILD_TRACE_CONFIG_DOC), config, { merge: true });
    renderGuildTraceConfig(config);
    setGuildTraceMessage("결사 이전 분석 설정을 저장했습니다.", "success");
    showToast("결사 이전 분석 설정을 저장했습니다.");
  } catch (error) {
    console.error("결사 이전 분석 설정 저장 오류", error);
    setGuildTraceMessage(
      "설정을 저장하지 못했습니다. Firestore 권한을 확인해주세요.",
      "error"
    );
    showToast("결사 이전 분석 설정 저장에 실패했습니다.");
  } finally {
    button.disabled = false;
  }
}

function setGuildTraceRunMessage(message, state = "") {
  const target = $("guildTraceRunMessage");

  if (!target) {
    return;
  }

  target.textContent = message;
  target.className = "data-update-message";

  if (state) {
    target.classList.add(state);
  }
}

function setGuildTraceProgress(step) {
  const order = ["request", "queued", "running", "complete"];
  const currentIndex = order.indexOf(step);

  document
    .querySelectorAll("[data-guild-trace-progress-step]")
    .forEach((item) => {
      const itemIndex = order.indexOf(item.dataset.guildTraceProgressStep);

      item.classList.toggle("active", itemIndex === currentIndex);
      item.classList.toggle(
        "done",
        currentIndex >= 0 && itemIndex < currentIndex
      );
    });
}

function stopGuildTracePolling() {
  if (guildTraceStatusTimer) {
    window.clearTimeout(guildTraceStatusTimer);
    guildTraceStatusTimer = null;
  }
}

function resetGuildTraceProgress() {
  activeGuildTraceRunId = null;
  guildTraceRequestedAt = null;
  stopGuildTracePolling();

  $("guildTraceRunId").textContent = "-";
  $("guildTraceRequestedAt").textContent = "-";
  $("guildTraceRunConclusion").textContent = "-";
  setGuildTraceProgress("request");
}

async function pollGuildTraceRunStatus(runId, pollCount = 0) {
  if (!runId) {
    return;
  }

  try {
    const result = await getRankingUpdateStatusCall({ runId });
    const data = result.data || {};
    const status = data.status;
    const conclusion = data.conclusion;

    $("guildTraceRunConclusion").textContent =
      conclusion || status || "-";

    if (status === "queued") {
      $("guildTraceRunBadge").textContent = "대기 중";
      $("guildTraceRunBadge").className = "data-state-badge working";
      setGuildTraceRunMessage(
        "결사 이전 분석 스냅샷 작업이 대기열에 등록되었습니다.",
        "working"
      );
      setGuildTraceProgress("queued");
    } else if (status === "in_progress") {
      $("guildTraceRunBadge").textContent = "생성 중";
      $("guildTraceRunBadge").className = "data-state-badge working";
      setGuildTraceRunMessage(
        "결사 이전 분석용 랭킹 데이터와 스냅샷을 생성하고 있습니다.",
        "working"
      );
      setGuildTraceProgress("running");
    } else if (status === "completed") {
      stopGuildTracePolling();
      activeGuildTraceRunId = null;
      $("guildTraceBeforeButton").disabled = false;
      $("guildTraceAfterButton").disabled = false;

      if (conclusion === "success") {
        $("guildTraceRunBadge").textContent = "완료";
        $("guildTraceRunBadge").className = "data-state-badge success";
        setGuildTraceRunMessage(
          "결사 이전 분석 스냅샷 생성과 홈페이지 반영이 완료되었습니다.",
          "success"
        );
        setGuildTraceProgress("complete");
        showToast("결사 이전 분석 스냅샷 생성이 완료되었습니다.");
      } else {
        $("guildTraceRunBadge").textContent = "실패";
        $("guildTraceRunBadge").className = "data-state-badge error";
        setGuildTraceRunMessage(
          `결사 이전 분석 작업이 실패했습니다. 결과: ${conclusion || "unknown"}`,
          "error"
        );
        showToast("결사 이전 분석 스냅샷 생성에 실패했습니다.");
      }

      return;
    }

    if (pollCount >= RANKING_MAX_POLL_COUNT) {
      stopGuildTracePolling();
      activeGuildTraceRunId = null;
      $("guildTraceBeforeButton").disabled = false;
      $("guildTraceAfterButton").disabled = false;
      $("guildTraceRunBadge").textContent = "확인 지연";
      $("guildTraceRunBadge").className = "data-state-badge error";
      setGuildTraceRunMessage(
        "작업 상태 확인 시간이 길어지고 있습니다. GitHub Actions에서 직접 확인해주세요.",
        "error"
      );
      return;
    }

    guildTraceStatusTimer = window.setTimeout(() => {
      pollGuildTraceRunStatus(runId, pollCount + 1);
    }, RANKING_POLL_INTERVAL);
  } catch (error) {
    console.error("결사 이전 분석 실행 상태 확인 오류", error);

    if (pollCount >= 5) {
      stopGuildTracePolling();
      activeGuildTraceRunId = null;
      $("guildTraceBeforeButton").disabled = false;
      $("guildTraceAfterButton").disabled = false;
      $("guildTraceRunBadge").textContent = "확인 오류";
      $("guildTraceRunBadge").className = "data-state-badge error";
      setGuildTraceRunMessage(
        rankingErrorMessage(error),
        "error"
      );
      return;
    }

    guildTraceStatusTimer = window.setTimeout(() => {
      pollGuildTraceRunStatus(runId, pollCount + 1);
    }, RANKING_POLL_INTERVAL);
  }
}

async function startGuildTraceSnapshotUpdate(snapshotRole) {
  assertClientAdmin();

  if (activeGuildTraceRunId) {
    showToast("이미 결사 이전 분석 작업을 확인하고 있습니다.");
    return;
  }

  const roleLabel = snapshotRole === "before" ? "이전데이터" : "이후데이터";
  const snapshotId = nowKstSnapshotId();
  const useExisting = Boolean($("guildTraceUseExisting")?.checked);

  const confirmed = window.confirm(
    `${roleLabel}를 저장할까요?\n` +
    `스냅샷 ID: ${snapshotId}\n\n` +
    "완료까지 수 분이 걸릴 수 있습니다."
  );

  if (!confirmed) {
    return;
  }

  $("guildTraceBeforeButton").disabled = true;
  $("guildTraceAfterButton").disabled = true;
  resetGuildTraceProgress();
  $("guildTraceRunBadge").textContent = "요청 중";
  $("guildTraceRunBadge").className = "data-state-badge working";
  setGuildTraceRunMessage(
    "Firebase에서 결사 이전 분석 스냅샷 생성을 요청하고 있습니다.",
    "working"
  );

  if (snapshotRole === "before") {
    $("guildTraceBeforeSnapshot").value = snapshotId;
  } else {
    $("guildTraceAfterSnapshot").value = "latest";
  }

  try {
    await saveGuildTraceConfig();

    const result = await triggerRankingUpdateCall({
      type: "guild_trace",
      mode: snapshotRole,
      snapshotRole,
      snapshotId,
      snapshot_id: snapshotId,
      useExisting,
      use_existing: useExisting,
      source: "admin-page"
    });

    const data = result.data || {};

    guildTraceRequestedAt = data.requestedAt || new Date().toISOString();
    activeGuildTraceRunId = data.runId || null;

    $("guildTraceRequestedAt").textContent =
      formatDateTime(guildTraceRequestedAt);

    $("guildTraceRunId").textContent =
      activeGuildTraceRunId || "확인 중";

    setGuildTraceProgress("queued");
    $("guildTraceRunBadge").textContent = "실행 시작";
    $("guildTraceRunBadge").className = "data-state-badge working";
    setGuildTraceRunMessage(
      data.message || `${roleLabel} 저장 작업을 시작했습니다.`,
      "working"
    );

    if (!activeGuildTraceRunId) {
      $("guildTraceBeforeButton").disabled = false;
      $("guildTraceAfterButton").disabled = false;
      setGuildTraceRunMessage(
        "작업 실행 요청은 완료됐지만 실행 번호 확인이 지연되고 있습니다. GitHub Actions에서 확인해주세요.",
        "working"
      );
      showToast(`${roleLabel} 저장 작업을 요청했습니다.`);
      return;
    }

    showToast(`${roleLabel} 저장 작업을 시작했습니다.`);
    pollGuildTraceRunStatus(activeGuildTraceRunId);
  } catch (error) {
    console.error("결사 이전 분석 스냅샷 실행 오류", error);

    activeGuildTraceRunId = null;
    $("guildTraceBeforeButton").disabled = false;
    $("guildTraceAfterButton").disabled = false;
    $("guildTraceRunBadge").textContent = "실행 실패";
    $("guildTraceRunBadge").className = "data-state-badge error";
    setGuildTraceRunMessage(
      rankingErrorMessage(error),
      "error"
    );
    $("guildTraceRunConclusion").textContent = "요청 실패";
    showToast("결사 이전 분석 스냅샷 요청에 실패했습니다.");
  }
}


function clearForm(prefix) {
  if (prefix === "notice") {
    $("noticeForm").reset();
    $("noticeDocumentId").value = "";
    $("noticeCategory").value = "공지";
    $("noticeVisible").checked = true;
  }

  if(prefix==="rollingNotice"){$("rollingNoticeForm").reset();$("rollingNoticeDocumentId").value="";$("rollingNoticeOrder").value="1";$("rollingNoticeVisible").checked=true}

  if (prefix === "schedule") {
    $("scheduleForm").reset();
    $("scheduleDocumentId").value = "";
    $("scheduleType").value = "dayoff";
    $("scheduleVisible").checked = true;
  }

  if (prefix === "video") {
    $("videoForm").reset();
    $("videoDocumentId").value = "";
    $("videoType").value =
      activeVideoFilter === "all"
        ? "featured"
        : activeVideoFilter;
    $("videoCategory").value = "영상";
    $("videoOrder").value = "1";
    $("videoVisible").checked = true;
  }
}

function renderList(targetId, items, formatter, onClick) {
  const target = $(targetId);
  target.innerHTML = "";

  if (!items.length) {
    target.innerHTML =
      '<div class="admin-empty">등록된 항목이 없습니다.</div>';
    return;
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    const formatted = formatter(item);

    button.type = "button";
    button.className = "admin-list-item";
    button.innerHTML = `
      <strong>${formatted.title}</strong>
      <span>${formatted.meta}</span>
    `;
    button.addEventListener("click", () => onClick(item));
    target.appendChild(button);
  });
}

async function loadAll() {
  await Promise.all([
    loadNotices(),
    loadRollingNotices(),
    loadSchedules(),
    loadVideos(),
    loadLiveStatus(),
    loadRankingDataStatus(),
    loadGuildTraceConfig()
  ]);
}

async function loadNotices() {
  const snapshot = await getDocs(
    query(
      collection(db, "notices"),
      orderBy("createdAt", "desc")
    )
  );

  noticeItems = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  renderList(
    "noticeAdminList",
    noticeItems,
    (item) => ({
      title: `${item.pinned ? "📌 " : ""}${item.title || "제목 없음"}`,
      meta: `${item.category || "안내"} · ${item.visible ? "공개" : "비공개"}`
    }),
    editNotice
  );
}

async function loadRollingNotices(){const snapshot=await getDocs(query(collection(db,"rollingNotices"),orderBy("order","asc")));rollingNoticeItems=snapshot.docs.map(item=>({id:item.id,...item.data()}));renderList("rollingNoticeAdminList",rollingNoticeItems,item=>({title:`${item.order??"-"} · ${item.text||"내용 없음"}`,meta:`${item.visible?"공개":"비공개"}${item.url?" · 링크 있음":""}`}),editRollingNotice)}

async function loadSchedules() {
  const snapshot = await getDocs(
    query(
      collection(db, "scheduleEvents"),
      orderBy("date", "desc")
    )
  );

  scheduleItems = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  renderList(
    "scheduleAdminList",
    scheduleItems,
    (item) => ({
      title: `${item.date || "-"} · ${item.title || "일정"}`,
      meta: `${item.type || "-"} · ${item.visible ? "공개" : "비공개"}`
    }),
    editSchedule
  );
}

async function loadVideos() {
  const snapshot = await getDocs(
    query(
      collection(db, "videos"),
      orderBy("order", "asc")
    )
  );

  videoItems = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  renderVideoAdminList();
}

function editNotice(item) {
  $("noticeDocumentId").value = item.id;
  $("noticeCategory").value = item.category || "공지";
  $("noticeTitle").value = item.title || "";
  $("noticeContent").value = item.content || "";
  $("noticePinned").checked = Boolean(item.pinned);
  $("noticeVisible").checked = item.visible !== false;
}

function editRollingNotice(item){$("rollingNoticeDocumentId").value=item.id;$("rollingNoticeTextInput").value=item.text||"";$("rollingNoticeUrl").value=item.url||"";$("rollingNoticeOrder").value=item.order??1;$("rollingNoticeVisible").checked=item.visible!==false}

function editSchedule(item) {
  $("scheduleDocumentId").value = item.id;
  $("scheduleDate").value = item.date || "";
  $("scheduleType").value = item.type || "dayoff";
  $("scheduleTitle").value = item.title || "";
  $("scheduleDescription").value = item.description || "";
  $("scheduleVisible").checked = item.visible !== false;
}

function editVideo(item) {
  $("videoDocumentId").value = item.id;
  $("videoType").value = item.type || "featured";
  $("videoCategory").value = item.category || "영상";
  $("videoTitle").value = item.title || "";
  $("videoDescription").value = item.description || "";
  $("videoUrl").value = item.url || "";
  $("videoOrder").value = item.order ?? 1;
  $("videoVisible").checked = item.visible !== false;
}

async function saveDocument(collectionName, id, data) {
  assertClientAdmin();
  if (id) {
    await updateDoc(
      doc(db, collectionName, id),
      {
        ...data,
        updatedAt: serverTimestamp()
      }
    );
    return;
  }

  await addDoc(
    collection(db, collectionName),
    {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );
}

async function removeDocument(collectionName, id) {
  assertClientAdmin();
  if (!id) {
    showToast("삭제할 항목을 먼저 선택해주세요.");
    return false;
  }

  if (!window.confirm("정말 삭제할까요?")) {
    return false;
  }

  await deleteDoc(doc(db, collectionName, id));
  return true;
}

$("noticeForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  await saveDocument(
    "notices",
    $("noticeDocumentId").value,
    {
      category: $("noticeCategory").value.trim(),
      title: $("noticeTitle").value.trim(),
      content: $("noticeContent").value,
      pinned: $("noticePinned").checked,
      visible: $("noticeVisible").checked
    }
  );

  clearForm("notice");
  await loadNotices();
  showToast("안내사항을 저장했습니다.");
});

$("rollingNoticeForm").addEventListener("submit",async event=>{event.preventDefault();const url=$("rollingNoticeUrl").value.trim();if(url&&!/^https?:\/\//i.test(url)){showToast("연결 링크는 http:// 또는 https://로 시작해야 합니다.");return}await saveDocument("rollingNotices",$("rollingNoticeDocumentId").value,{text:$("rollingNoticeTextInput").value.trim(),url,order:Number($("rollingNoticeOrder").value),visible:$("rollingNoticeVisible").checked});clearForm("rollingNotice");await loadRollingNotices();showToast("한줄 공지를 저장했습니다.")});

$("scheduleForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  await saveDocument(
    "scheduleEvents",
    $("scheduleDocumentId").value,
    {
      date: $("scheduleDate").value,
      type: $("scheduleType").value,
      title: $("scheduleTitle").value.trim(),
      description: $("scheduleDescription").value,
      visible: $("scheduleVisible").checked
    }
  );

  clearForm("schedule");
  await loadSchedules();
  showToast("방송 일정을 저장했습니다.");
});

$("videoForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = $("videoUrl").value.trim();
  const youtubeId = youtubeIdFromUrl(url);

  if (!youtubeId) {
    showToast("올바른 YouTube 주소를 입력해주세요.");
    return;
  }

  await saveDocument(
    "videos",
    $("videoDocumentId").value,
    {
      type: $("videoType").value,
      category: $("videoCategory").value.trim(),
      title: $("videoTitle").value.trim(),
      description: $("videoDescription").value,
      url,
      youtubeId,
      order: Number($("videoOrder").value),
      visible: $("videoVisible").checked
    }
  );

  clearForm("video");
  await loadVideos();
  showToast("영상을 저장했습니다.");
});

$("noticeDelete").addEventListener("click", async () => {
  if (await removeDocument("notices", $("noticeDocumentId").value)) {
    clearForm("notice");
    await loadNotices();
    showToast("안내사항을 삭제했습니다.");
  }
});

$("rollingNoticeDelete").addEventListener("click",async()=>{if(await removeDocument("rollingNotices",$("rollingNoticeDocumentId").value)){clearForm("rollingNotice");await loadRollingNotices();showToast("한줄 공지를 삭제했습니다.")}});

$("scheduleDelete").addEventListener("click", async () => {
  if (await removeDocument("scheduleEvents", $("scheduleDocumentId").value)) {
    clearForm("schedule");
    await loadSchedules();
    showToast("방송 일정을 삭제했습니다.");
  }
});

$("videoDelete").addEventListener("click", async () => {
  if (await removeDocument("videos", $("videoDocumentId").value)) {
    clearForm("video");
    await loadVideos();
    showToast("영상을 삭제했습니다.");
  }
});

$("noticeReset").addEventListener("click", () => clearForm("notice"));
$("rollingNoticeReset").addEventListener("click",()=>clearForm("rollingNotice"));
$("scheduleReset").addEventListener("click", () => clearForm("schedule"));
$("videoReset").addEventListener("click", () => clearForm("video"));

$("liveOnButton")?.addEventListener("click", () => { saveLiveStatus(true); });
$("liveOffButton")?.addEventListener("click", () => { saveLiveStatus(false); });

$("rankingUpdateButton").addEventListener(
  "click",
  startRankingUpdate
);

$("rankingStatusRefresh").addEventListener(
  "click",
  async () => {
    await loadRankingDataStatus();

    if (activeRankingRunId) {
      pollRankingRunStatus(activeRankingRunId);
    } else {
      showToast("최근 데이터 상태를 새로고침했습니다.");
    }
  }
);

$("guildTraceSaveButton")?.addEventListener(
  "click",
  saveGuildTraceConfig
);

$("guildTraceBeforeButton")?.addEventListener(
  "click",
  () => startGuildTraceSnapshotUpdate("before")
);

$("guildTraceAfterButton")?.addEventListener(
  "click",
  () => startGuildTraceSnapshotUpdate("after")
);

["guildTraceTitle", "guildTraceSeason"].forEach((id) => {
  $(id)?.addEventListener("input", () => {
    $("guildTracePreviewTitle").textContent = formatGuildTraceTitle({
      trace_title: $("guildTraceTitle").value,
      trace_season: $("guildTraceSeason").value
    });
  });
});


document
  .querySelectorAll("[data-video-filter]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      activeVideoFilter = button.dataset.videoFilter;

      document
        .querySelectorAll("[data-video-filter]")
        .forEach((item) => {
          const active = item === button;

          item.classList.toggle("active", active);
          item.setAttribute(
            "aria-selected",
            String(active)
          );
        });

      renderVideoAdminList();
    });
  });

document.querySelectorAll("[data-admin-page]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.adminPage;

    document.querySelectorAll(".admin-nav-button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    document.querySelectorAll(".admin-page").forEach((item) => {
      item.classList.remove("active");
    });

    $(`admin${page[0].toUpperCase()}${page.slice(1)}Page`)
      .classList.add("active");

    $("adminPageTitle").textContent = pageTitles[page];
  });
});

$("adminLogoutButton").addEventListener("click", async () => {
  lockAdminApp();
  await signOut(auth);
  window.location.href = "./index.html";
});

async function requireAdmin(user) {
  lockAdminApp();

  if (!user || !isConfiguredAdmin(user.uid)) {
    if (user) {
      $("adminUserName").textContent = "접근 권한 없음";
      $("adminUserEmail").textContent = user.email || "-";
      $("adminUserUid").textContent = "비관리자 계정";
    }

    setGateState({
      icon: "🔒",
      title: "접근 권한이 없는 계정입니다",
      message: "이 Google 계정은 프라시아랩 관리자 UID에 등록되어 있지 않습니다.",
      mode: "denied"
    });
    return false;
  }

  currentAdminUser = user;
  $("adminUserName").textContent = user.displayName || "관리자";
  $("adminUserEmail").textContent = user.email || "-";
  $("adminUserUid").textContent = user.uid;
  setAccess("관리자 권한이 확인되었습니다.", "success");

  setGateState({
    icon: "✓",
    title: "관리자 권한 확인 완료",
    message: "관리자 센터 데이터를 불러오고 있습니다.",
    mode: "allowed"
  });

  try {
    await loadAll();
    unlockAdminApp();
    return true;
  } catch (error) {
    console.error(error);
    lockAdminApp();
    setGateState({
      icon: "!",
      title: "관리자 데이터를 불러오지 못했습니다",
      message: "Firestore 규칙과 관리자 UID 설정을 확인해주세요.",
      mode: "denied"
    });
    return false;
  }
}

$("adminGateLoginButton")?.addEventListener("click", () => {
  openAdminLogin(false);
});

$("adminGateRetryButton")?.addEventListener("click", () => {
  openAdminLogin(true);
});

lockAdminApp();
setGateState({
  icon: "⌛",
  title: "관리자 권한 확인 중",
  message: "로그인 상태와 관리자 권한을 확인하고 있습니다.",
  mode: "checking"
});

onAuthStateChanged(auth, async (user) => {
  authCheckFinished = true;

  if (user) {
    await requireAdmin(user);
    return;
  }

  lockAdminApp();
  setGateState({
    icon: "🔒",
    title: "관리자 로그인이 필요합니다",
    message: "등록된 Google 관리자 계정으로 로그인해야 관리자 센터를 사용할 수 있습니다.",
    mode: "login"
  });
});
