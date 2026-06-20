const raidPreviewData = [
  { level: 23, min: "확인 중", recommended: "확인 중", tag: "자주 찾음" },
  { level: 24, min: "확인 중", recommended: "확인 중", tag: "자주 찾음" },
  { level: 25, min: "확인 중", recommended: "확인 중", tag: "인기" },
  { level: 26, min: "확인 중", recommended: "확인 중", tag: "최신" }
];

const rollingMessages = [
  "23~26 토벌 레벨별 명중 정보를 메인에서 빠르게 확인해보세요.",
  "명중 외 상세 스펙은 상단의 ‘토벌 스펙’에서 확인할 수 있습니다.",
  "카드를 누르면 최소·권장 기준과 간단한 계산 안내가 열립니다."
];

const grid = document.getElementById("raidAccuracyGrid");
const modal = document.getElementById("raidDetailModal");
const modalTitle = document.getElementById("raidDetailTitle");
const modalLead = document.getElementById("raidDetailLead");
const modalMin = document.getElementById("raidDetailMin");
const modalRecommended = document.getElementById("raidDetailRecommended");
const toast = document.getElementById("previewToast");
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1900);
}

function renderRaidCards() {
  grid.innerHTML = raidPreviewData.map((raid) => `
    <button class="raid-accuracy-card" type="button" data-raid-level="${raid.level}">
      <span class="raid-card-top">
        <strong class="raid-card-level">${raid.level}토벌</strong>
        <span class="raid-card-badge">${raid.tag}</span>
      </span>
      <span class="raid-card-values">
        <span>최소 명중<strong>${raid.min}</strong></span>
        <span>권장 명중<strong>${raid.recommended}</strong></span>
      </span>
      <span class="raid-card-foot"><span>기준·계산법 보기</span><b>›</b></span>
    </button>
  `).join("");

  grid.querySelectorAll(".raid-accuracy-card").forEach((card) => {
    card.addEventListener("click", () => openRaidDetail(Number(card.dataset.raidLevel)));
  });
}

function openRaidDetail(level) {
  const raid = raidPreviewData.find((item) => item.level === level);
  if (!raid) return;

  modalTitle.textContent = `${raid.level}토벌 명중 정보`;
  modalLead.textContent = "현재 명중 수치는 미리보기용으로 ‘확인 중’ 상태입니다. 실제 적용 전 확정 값을 넣으면 됩니다.";
  modalMin.textContent = raid.min;
  modalRecommended.textContent = raid.recommended;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeRaidDetail() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function openRaidSpecPreview() {
  closeRaidDetail();
  showToast("실제 적용 시 상단 ‘토벌 스펙’ 시트가 열립니다.");
}

renderRaidCards();

document.getElementById("raidDetailClose").addEventListener("click", closeRaidDetail);
document.getElementById("raidDetailCancel").addEventListener("click", closeRaidDetail);
document.getElementById("raidSpecButton").addEventListener("click", openRaidSpecPreview);
document.getElementById("openRaidSpec").addEventListener("click", openRaidSpecPreview);

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeRaidDetail();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeRaidDetail();
});

document.querySelectorAll("a[href='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showToast("미리보기에서는 외부 이동을 막아두었습니다.");
  });
});

document.querySelectorAll(".preview-sheet-button").forEach((button) => {
  button.addEventListener("click", () => showToast(`${button.dataset.previewSheet} 미리보기 버튼입니다.`));
});

const previewSidebar = document.getElementById("previewSidebar");
const previewDim = document.getElementById("previewDim");
document.getElementById("previewMenuButton").addEventListener("click", () => {
  previewSidebar.classList.add("open");
  previewDim.classList.add("open");
});
previewDim.addEventListener("click", () => {
  previewSidebar.classList.remove("open");
  previewDim.classList.remove("open");
});

let messageIndex = 0;
const rollingText = document.getElementById("previewRollingText");
window.setInterval(() => {
  messageIndex = (messageIndex + 1) % rollingMessages.length;
  rollingText.style.opacity = "0";
  rollingText.style.transform = "translateY(5px)";
  window.setTimeout(() => {
    rollingText.textContent = rollingMessages[messageIndex];
    rollingText.style.opacity = "1";
    rollingText.style.transform = "translateY(0)";
  }, 220);
}, 4200);

const calendarDays = [
  { day: 31, muted: true }, 1, 2, 3, 4, 5, 6,
  7, 8, 9, 10, 11, 12, 13,
  14, 15, 16, 17, 18, { day: 19, event: true }, 20,
  21, 22, 23, 24, { day: 25, event: true }, 26, 27,
  28, 29, 30, { day: 1, muted: true }, { day: 2, muted: true }, { day: 3, muted: true }, { day: 4, muted: true }
];

document.getElementById("previewDays").innerHTML = calendarDays.map((item) => {
  const value = typeof item === "number" ? { day: item } : item;
  const classes = [value.muted ? "muted" : "", value.event ? "event" : ""].filter(Boolean).join(" ");
  return `<span class="${classes}">${value.day}</span>`;
}).join("");
