const sheetLinks = [
  [
    "토벌 스펙",
    "https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=1876922409"
  ],
  [
    "마법 부여",
    "https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=2108346036"
  ],
  [
    "심연 증폭",
    "https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=413772873"
  ],
  [
    "클래스 주문석",
    "https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=1044209677"
  ],
  [
    "아퀴 채화",
    "https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=454167790"
  ],
  [
    "클래스 체인지",
    "https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=776991324"
  ],
  [
    "클래스 전승",
    "https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=1917128113"
  ],
  [
    "몬스터 도감",
    "https://docs.google.com/spreadsheets/d/10ZIjOh7VgaceXSbSuTR6fMGj28NCzrHujxF9SQyw_UU/preview#gid=1463186653"
  ]
];

const fallbackVideos = [
  {
    id: "L1mT1bWT5Qg",
    title: "전승노드 꿀팁",
    description: "클래스 전승과 노드 세팅에 도움이 되는 주요 팁입니다.",
    category: "주요 영상",
    type: "featured",
    url: "https://www.youtube.com/watch?v=L1mT1bWT5Qg"
  },
  {
    id: "8TokefIDsrg",
    title: "업데이트 소식",
    description: "프라시아 전기의 최신 업데이트 내용을 빠르게 확인하세요.",
    category: "업데이트",
    type: "featured",
    url: "https://www.youtube.com/shorts/8TokefIDsrg"
  },
  {
    id: "DZ6j7Ofsrbg",
    title: "토벌 기적의 세팅법",
    description: "토벌 진행에 도움이 되는 세팅 방법을 소개합니다.",
    category: "토벌 공략",
    type: "featured",
    url: "https://www.youtube.com/watch?v=DZ6j7Ofsrbg"
  }
];

const pages = document.querySelectorAll(".page");
const sideButtons = document.querySelectorAll(".side-menu-item");
const sidebar = document.getElementById("sidebar");
const dim = document.getElementById("mobileDim");

function moveToPage(pageId) {
  const page = document.getElementById(pageId);
  const button = document.querySelector(
    `[data-page="${pageId}"]`
  );

  if (!page) {
    return;
  }

  pages.forEach((item) => {
    item.classList.remove("active");
  });

  sideButtons.forEach((item) => {
    item.classList.remove("active");
  });

  page.classList.add("active");

  if (button) {
    button.classList.add("active");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  closeMenu();
}

sideButtons.forEach((button) => {
  button.addEventListener("click", () => {
    moveToPage(button.dataset.page);
  });
});

document
  .querySelectorAll("[data-move-page]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      moveToPage(button.dataset.movePage);
    });
  });

function closeMenu() {
  sidebar.classList.remove("open");
  dim.classList.remove("open");
}

document
  .getElementById("mobileMenuButton")
  .addEventListener("click", () => {
    sidebar.classList.add("open");
    dim.classList.add("open");
  });

dim.addEventListener("click", closeMenu);

const modal = document.getElementById("sheetModal");
const frame = document.getElementById("sheetFrame");
const modalTitle = document.getElementById(
  "sheetModalTitle"
);
const openNew = document.getElementById(
  "sheetOpenNew"
);

let currentSheetUrl = "";

function openSheet(index) {
  const sheet = sheetLinks[index];

  if (!sheet) {
    return;
  }

  modalTitle.textContent = sheet[0];
  openNew.href = sheet[1];

  /*
   * Google Sheets preview는 같은 문서 안에서 gid만 바뀔 때
   * 기존 iframe 내용을 그대로 유지하는 경우가 있습니다.
   *
   * 따라서 버튼을 누를 때 iframe을 잠시 비운 뒤
   * 선택한 시트 주소를 다시 넣어 강제로 새로 불러옵니다.
   */
  frame.src = "about:blank";
  currentSheetUrl = sheet[1];

  window.setTimeout(() => {
    frame.src = sheet[1];
  }, 30);

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSheet() {
  modal.classList.remove("open");

  /*
   * 다음 시트 선택 시 이전 시트가 남지 않도록
   * iframe을 초기화합니다.
   */
  frame.src = "about:blank";
  currentSheetUrl = "";

  document.body.style.overflow = "";
}

document
  .querySelectorAll(".sheet-button")
  .forEach((button) => {
    button.addEventListener("click", () => {
      openSheet(
        Number(button.dataset.sheetIndex)
      );
    });
  });

document
  .getElementById("sheetModalClose")
  .addEventListener("click", closeSheet);

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeSheet();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSheet();
    closeMenu();
  }
});

function createVideoCard(video) {
  const card = document.createElement("a");

  card.className = "video-card";
  card.href = video.url;
  card.target = "_blank";
  card.rel = "noopener noreferrer";

  card.innerHTML = `
    <div class="video-thumb">
      <img
        src="https://i.ytimg.com/vi/${video.id}/hqdefault.jpg"
        alt="${video.title} 썸네일"
        loading="lazy"
      >
      <span class="play-mark">▶</span>
    </div>

    <div class="video-info">
      <span class="video-category">
        ${video.category || "영상"}
      </span>

      <strong>${video.title}</strong>
      <p>${video.description || ""}</p>
    </div>
  `;

  return card;
}

function createEmptyVideoMessage(text) {
  return `
    <div
      class="empty-state compact-state"
      style="grid-column: 1 / -1;"
    >
      <strong>${text}</strong>
      <p>
        추후 영상 데이터가 추가되면 자동으로 카드가 생성됩니다.
      </p>
    </div>
  `;
}

function renderVideos(videos) {
  const targets = [
    [
      "featuredVideoGrid",
      "featured",
      "주요 영상 준비 중"
    ],
    [
      "reviewVideoGrid",
      "review",
      "리뷰 방송 영상 준비 중"
    ],
    [
      "raidVideoGrid",
      "raid",
      "토벌 공략 영상 준비 중"
    ]
  ];

  targets.forEach(([id, type, emptyText]) => {
    const grid = document.getElementById(id);

    if (!grid) {
      return;
    }

    const list = videos.filter(
      (video) => video.type === type
    );

    grid.innerHTML = "";

    if (list.length) {
      list.forEach((video) => {
        grid.appendChild(
          createVideoCard(video)
        );
      });
    } else {
      grid.innerHTML =
        createEmptyVideoMessage(emptyText);
    }
  });
}

fetch("./data/videos.json", {
  cache: "no-store"
})
  .then((response) => {
    if (!response.ok) {
      throw new Error();
    }

    return response.json();
  })
  .then(renderVideos)
  .catch(() => {
    renderVideos(fallbackVideos);
  });


/* Nickname status popup: loads class ranking data only when first opened. */
(() => {
  const openButton = document.getElementById("nicknameStatusButton");
  const nicknameModal = document.getElementById("nicknameStatusModal");
  const closeButton = document.getElementById("nicknameStatusClose");
  const form = document.getElementById("nicknameStatusForm");
  const input = document.getElementById("nicknameStatusInput");
  const result = document.getElementById("nicknameStatusResult");

  if (!openButton || !nicknameModal || !closeButton || !form || !input || !result) {
    return;
  }

  const dataUrl = "./data/Who_are_you_class.json";
  let nicknameCountPromise = null;

  function setResult(message, options = {}) {
    const { error = false, nickname = "", count = null } = options;

    result.classList.toggle("error", error);
    result.replaceChildren();

    if (nickname && Number.isInteger(count)) {
      const name = document.createElement("strong");
      const countValue = document.createElement("span");
      name.textContent = `‘${nickname}’`;
      countValue.className = "nickname-status-count";
      countValue.textContent = String(count);
      countValue.style.marginLeft = "4px";
      result.append(name, " 닉네임은 현재 랭킹 데이터에서", countValue, "건 확인됩니다.");
      return;
    }

    result.textContent = message;
  }

  function loadNicknameCounts() {
    if (nicknameCountPromise) {
      return nicknameCountPromise;
    }

    nicknameCountPromise = fetch(dataUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.rankings)) {
          throw new Error("Invalid ranking data");
        }

        const counts = new Map();

        data.rankings.forEach((character) => {
          const name = typeof character?.name === "string"
            ? character.name.trim()
            : "";

          if (name) {
            counts.set(name, (counts.get(name) || 0) + 1);
          }
        });

        return counts;
      })
      .catch((error) => {
        nicknameCountPromise = null;
        throw error;
      });

    return nicknameCountPromise;
  }

  function isValidNickname(value) {
    return /^[가-힣]{1,10}$/.test(value) || /^[A-Za-z]{1,10}$/.test(value);
  }

  function openNicknameStatus() {
    nicknameModal.classList.add("open");
    nicknameModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeMenu();

    window.setTimeout(() => {
      input.focus();
    }, 0);
  }

  function closeNicknameStatus() {
    nicknameModal.classList.remove("open");
    nicknameModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    openButton.focus();
  }

  openButton.addEventListener("click", openNicknameStatus);
  closeButton.addEventListener("click", closeNicknameStatus);

  nicknameModal.addEventListener("click", (event) => {
    if (event.target === nicknameModal) {
      closeNicknameStatus();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nickname = input.value.trim();

    if (!nickname) {
      setResult("닉네임을 입력해 주세요.", { error: true });
      input.focus();
      return;
    }

    if (!isValidNickname(nickname)) {
      setResult(
        "정확한 닉네임을 입력해 주세요. 한글 또는 영문으로 최대 10자까지 입력할 수 있으며, 한글과 영문은 함께 사용할 수 없습니다.",
        { error: true }
      );
      input.focus();
      return;
    }

    setResult("랭킹 데이터를 확인하고 있습니다.");

    try {
      const counts = await loadNicknameCounts();
      const count = counts.get(nickname) || 0;

      if (count === 0) {
        setResult(
          `검색한 닉네임 ‘${nickname}’은 현재 랭킹 데이터에서 확인되지 않습니다.`,
          { error: false }
        );
        return;
      }

      setResult("", { nickname, count });
    } catch (error) {
      console.error("닉네임 현황 데이터를 불러오지 못했습니다.", error);
      setResult(
        "랭킹 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        { error: true }
      );
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nicknameModal.classList.contains("open")) {
      closeNicknameStatus();
    }
  });
})();
