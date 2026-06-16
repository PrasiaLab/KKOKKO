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
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  firebaseConfig,
  isConfiguredAdmin
} from "./firebase-config.js";

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const pageTitles = {
  notice: "안내사항 관리",
  schedule: "방송 일정 관리",
  video: "영상 관리"
};

let noticeItems = [];
let scheduleItems = [];
let videoItems = [];
let activeVideoFilter = "all";

const $ = (id) => document.getElementById(id);

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

function clearForm(prefix) {
  if (prefix === "notice") {
    $("noticeForm").reset();
    $("noticeDocumentId").value = "";
    $("noticeCategory").value = "공지";
    $("noticeVisible").checked = true;
  }

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
    loadSchedules(),
    loadVideos()
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
$("scheduleReset").addEventListener("click", () => clearForm("schedule"));
$("videoReset").addEventListener("click", () => clearForm("video"));

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
  await signOut(auth);
  window.location.href = "./index.html";
});

async function requireAdmin(user) {
  $("adminUserName").textContent = user.displayName || "관리자";
  $("adminUserEmail").textContent = user.email || "-";
  $("adminUserUid").textContent = user.uid;

  if (!isConfiguredAdmin(user.uid)) {
    setAccess(
      `이 계정은 아직 관리자 UID에 등록되지 않았습니다. UID: ${user.uid}`,
      "error"
    );
    return;
  }

  setAccess("관리자 권한이 확인되었습니다.", "success");

  try {
    await loadAll();
  } catch (error) {
    console.error(error);
    setAccess(
      "데이터를 불러오지 못했습니다. Firestore 규칙과 관리자 UID를 확인해주세요.",
      "error"
    );
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await requireAdmin(user);
    return;
  }

  setAccess("Google 관리자 계정으로 로그인해주세요.", "error");

  try {
    const result = await signInWithPopup(auth, provider);
    await requireAdmin(result.user);
  } catch (error) {
    console.error(error);
    window.location.href = "./index.html";
  }
});
