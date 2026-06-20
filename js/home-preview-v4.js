const raidVideoData = [
  {
    level: 23,
    accuracy: "1300",
    skillAccuracy: "750",
    bossName: "파나스",
    bossType: "엘프형",
    image: "./images/23TG.png",
    videoUrl: "https://www.youtube.com/watch?v=A51hSsBCYIw"
  },
  {
    level: 24,
    accuracy: "1370",
    skillAccuracy: "800",
    bossName: "백야의 왕",
    bossType: "신수형",
    image: "./images/24TG.png",
    videoUrl: "https://www.youtube.com/watch?v=XLakE7jZY3I"
  },
  {
    level: 25,
    accuracy: "1440",
    skillAccuracy: "840",
    bossName: "사령관 아조레트",
    bossType: "엘프형",
    image: "./images/25TG.png",
    videoUrl: "https://www.youtube.com/watch?v=IO7I7SMoPyc"
  },
  {
    level: 26,
    accuracy: "1510",
    skillAccuracy: "880",
    bossName: "작열하는 야수",
    bossType: "야수형",
    image: "./images/26TG.png",
    videoUrl: "https://www.youtube.com/watch?v=7fCPHreetQ0&t"
  }
];

const rollingMessages = [
  "23~26 토벌 필요 명중과 공략 영상을 한눈에 확인해보세요.",
  "토벌 카드를 선택하면 해당 레벨의 공략 영상으로 이동합니다.",
  "명중 외 상세 스펙은 상단의 ‘토벌 스펙’에서 확인할 수 있습니다."
];

const toast = document.getElementById("previewToast");
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2100);
}

// 토벌 카드는 HTML에 정적으로 포함되어 로컬에서도 항상 표시됩니다.


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
