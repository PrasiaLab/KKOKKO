import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBTo1X0MbgYC-Kh_yqLrakXrBMoRibvWk",
  authDomain: "prasialab.firebaseapp.com",
  projectId: "prasialab",
  storageBucket: "prasialab.firebasestorage.app",
  messagingSenderId: "844238283131",
  appId: "1:844238283131:web:b46548f82cc9e5948d5dde",
  measurementId: "G-YSXY10S0XD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const youtubeChannel =
  "https://www.youtube.com/@%EB%A7%9B%EB%82%98%EB%8A%94%EA%BC%AC%EA%BC%AC";

let notices = [];

function timestampToDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = timestampToDate(value);

  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function moveToPage(pageId) {
  const button = document.querySelector(
    `.side-menu-item[data-page="${pageId}"]`
  );

  if (button) {
    button.click();
  }
}

function renderHomeNotices() {
  const target = document.getElementById("homeNoticeList");

  if (!target) {
    return;
  }

  const visible = notices.slice(0, 4);

  if (!visible.length) {
    target.innerHTML = `
      <div class="content-loading-row">
        등록된 안내사항이 없습니다.
      </div>
    `;
    return;
  }

  target.innerHTML = "";

  visible.forEach((notice) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "notice-row";
    button.innerHTML = `
      <span class="notice-type">${notice.category || "안내"}</span>
      <strong>${notice.title || "제목 없음"}</strong>
      <time>${formatDate(notice.createdAt)}</time>
    `;

    button.addEventListener("click", () => {
      moveToPage("notice");
      renderNoticeDetail(notice.id);
    });

    target.appendChild(button);
  });
}

function renderNoticeList() {
  const target = document.getElementById("noticeBoardList");
  const count = document.getElementById("noticeCountLabel");

  if (!target) {
    return;
  }

  if (count) {
    count.textContent = `${notices.length}개`;
  }

  if (!notices.length) {
    target.innerHTML = `
      <div class="content-loading-row">
        등록된 안내사항이 없습니다.
      </div>
    `;
    return;
  }

  target.innerHTML = "";

  notices.forEach((notice) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "notice-board-item";
    button.dataset.noticeId = notice.id;
    button.innerHTML = `
      <span class="notice-board-category">
        ${notice.category || "안내"}
      </span>
      <strong class="notice-board-title">
        ${notice.pinned ? "📌 " : ""}${notice.title || "제목 없음"}
      </strong>
      <time class="notice-board-date">
        ${formatDate(notice.createdAt)}
      </time>
    `;

    button.addEventListener("click", () => {
      renderNoticeDetail(notice.id);
    });

    target.appendChild(button);
  });
}

function renderNoticeDetail(id) {
  const panel = document.getElementById("noticeDetailPanel");
  const notice = notices.find((item) => item.id === id);

  if (!panel || !notice) {
    return;
  }

  document
    .querySelectorAll(".notice-board-item")
    .forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.noticeId === id
      );
    });

  panel.innerHTML = `
    <span class="notice-detail-category">
      ${notice.category || "안내"}
    </span>

    <h2 class="notice-detail-title">
      ${notice.title || "제목 없음"}
    </h2>

    <div class="notice-detail-meta">
      ${formatDate(notice.createdAt)}
    </div>

    <div class="notice-detail-content">
      ${notice.content || "내용이 없습니다."}
    </div>
  `;

  const url = new URL(window.location.href);
  url.searchParams.set("page", "notice");
  url.searchParams.set("id", id);
  history.replaceState(null, "", url);
}

function youtubeIdFromUrl(url = "") {
  const match = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([^?&/]+)/
  );

  return match ? match[1] : "";
}

function createVideoCard(video) {
  const youtubeId =
    video.youtubeId ||
    youtubeIdFromUrl(video.url);

  const card = document.createElement("a");
  card.className = "video-card";
  card.href = video.url || youtubeChannel;
  card.target = "_blank";
  card.rel = "noopener noreferrer";

  card.innerHTML = `
    <div class="video-thumb">
      <img
        src="https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg"
        alt="${video.title || "영상"} 썸네일"
        loading="lazy"
      >
      <span class="play-mark">▶</span>
    </div>

    <div class="video-info">
      <span class="video-category">
        ${video.category || "영상"}
      </span>

      <strong>${video.title || "영상 제목"}</strong>
      <p>${video.description || ""}</p>
    </div>
  `;

  return card;
}

function renderFirebaseVideos(videos) {
  const groups = {
    featured: document.getElementById("featuredVideoGrid"),
    review: document.getElementById("reviewVideoGrid"),
    raid: document.getElementById("raidVideoGrid")
  };

  Object.entries(groups).forEach(([type, target]) => {
    if (!target) {
      return;
    }

    const list = videos
      .filter((item) => item.type === type)
      .slice(0, type === "featured" ? 3 : 6);

    if (!list.length) {
      return;
    }

    target.innerHTML = "";

    list.forEach((video) => {
      target.appendChild(createVideoCard(video));
    });
  });
}

async function loadNotices() {
  try {
    const noticeQuery = query(
      collection(db, "notices"),
      where("visible", "==", true),
      orderBy("pinned", "desc"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const snapshot = await getDocs(noticeQuery);

    notices = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));

    renderHomeNotices();
    renderNoticeList();

    const params = new URLSearchParams(window.location.search);
    const noticeId = params.get("id");

    if (params.get("page") === "notice") {
      moveToPage("notice");

      if (noticeId) {
        renderNoticeDetail(noticeId);
      }
    }
  } catch (error) {
    console.error("안내사항 로드 오류", error);

    document.getElementById("homeNoticeList").innerHTML = `
      <div class="content-loading-row">
        안내사항을 불러오지 못했습니다.
      </div>
    `;

    document.getElementById("noticeBoardList").innerHTML = `
      <div class="content-loading-row">
        안내사항을 불러오지 못했습니다.
      </div>
    `;
  }
}

async function loadSchedule() {
  try {
    const scheduleQuery = query(
      collection(db, "scheduleEvents"),
      where("visible", "==", true),
      orderBy("date", "asc"),
      limit(120)
    );

    const snapshot = await getDocs(scheduleQuery);

    const events = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));

    window.dispatchEvent(
      new CustomEvent("kkokko:schedule-loaded", {
        detail: events
      })
    );
  } catch (error) {
    console.error("방송 일정 로드 오류", error);

    window.dispatchEvent(
      new CustomEvent("kkokko:schedule-loaded", {
        detail: []
      })
    );
  }
}

async function loadVideos() {
  try {
    const videoQuery = query(
      collection(db, "videos"),
      where("visible", "==", true),
      orderBy("order", "asc"),
      limit(50)
    );

    const snapshot = await getDocs(videoQuery);

    const videos = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));

    renderFirebaseVideos(videos);
  } catch (error) {
    /*
     * Firestore에 영상이 없거나 규칙 설정 전이라도
     * 기존 videos.json 출력은 app.js에서 그대로 유지됩니다.
     */
    console.warn("Firebase 영상 데이터를 사용하지 못했습니다.", error);
  }
}

Promise.all([
  loadNotices(),
  loadSchedule(),
  loadVideos()
]);
