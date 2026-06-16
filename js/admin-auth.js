import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  firebaseConfig,
  isConfiguredAdmin
} from "./firebase-config.js";

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account"
});

const loginButton = document.getElementById("adminLoginButton");
const loginButtonText = document.getElementById("adminLoginButtonText");
const modal = document.getElementById("adminLoginModal");
const closeButton = document.getElementById("adminLoginClose");
const googleButton = document.getElementById("googleAdminLogin");
const status = document.getElementById("adminLoginStatus");

function openModal() {
  if (window.KKOKKO_ADMIN_MODAL) {
    window.KKOKKO_ADMIN_MODAL.open();
    return;
  }

  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (window.KKOKKO_ADMIN_MODAL) {
    window.KKOKKO_ADMIN_MODAL.close();
    return;
  }

  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setStatus(message = "") {
  if (status) {
    status.textContent = message;
  }
}

function showUnregisteredUser(user) {
  if (!status) {
    return;
  }

  status.innerHTML = `
    <strong>Google 로그인은 완료되었습니다.</strong><br>
    아직 관리자 UID에 등록되지 않은 계정입니다.<br>
    <span class="admin-uid-label">관리자 UID</span>
    <code class="admin-uid-value">${user.uid}</code><br>
    위 UID를 복사해 관리자 설정 파일과 Firestore 규칙에 등록해주세요.
  `;
}

setStatus("Google 관리자 계정으로 로그인해주세요.");

loginButton?.addEventListener("click", () => {
  if (auth.currentUser && isConfiguredAdmin(auth.currentUser.uid)) {
    window.location.href = "./admin.html";
    return;
  }

  openModal();
});

closeButton?.addEventListener("click", closeModal);

modal?.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

googleButton?.addEventListener("click", async () => {
  googleButton.disabled = true;
  setStatus("Google 계정 로그인 창을 여는 중입니다.");

  try {
    await setPersistence(
      auth,
      browserLocalPersistence
    );

    const result = await signInWithPopup(
      auth,
      provider
    );

    const user = result.user;

    if (!isConfiguredAdmin(user.uid)) {
      /*
       * 최초 관리자 설정 단계에서는 로그아웃하지 않습니다.
       * 로그인된 계정의 UID를 화면에 표시해 등록할 수 있게 합니다.
       */
      showUnregisteredUser(user);
      return;
    }

    window.location.href = "./admin.html";
  } catch (error) {
    console.error("관리자 Google 로그인 오류", error);

    const errorMessages = {
      "auth/popup-blocked":
        "브라우저가 로그인 팝업을 차단했습니다. 주소창의 팝업 허용을 켜주세요.",
      "auth/popup-closed-by-user":
        "로그인 창이 완료되기 전에 닫혔습니다.",
      "auth/cancelled-popup-request":
        "로그인 창이 이미 열려 있습니다. 잠시 후 다시 시도해주세요.",
      "auth/unauthorized-domain":
        "현재 홈페이지 주소가 Firebase 승인된 도메인에 등록되지 않았습니다.",
      "auth/operation-not-allowed":
        "Firebase Authentication에서 Google 로그인이 활성화되지 않았습니다.",
      "auth/network-request-failed":
        "네트워크 오류로 로그인하지 못했습니다."
    };

    setStatus(
      errorMessages[error.code] ||
      `로그인 오류: ${error.code || error.message || "알 수 없는 오류"}`
    );
  } finally {
    googleButton.disabled = false;
  }
});

onAuthStateChanged(auth, (user) => {
  if (loginButtonText) {
    loginButtonText.textContent =
      user && isConfiguredAdmin(user.uid)
        ? "관리자 센터"
        : "관리자 로그인";
  }

  if (
    user &&
    modal?.classList.contains("open") &&
    !isConfiguredAdmin(user.uid)
  ) {
    showUnregisteredUser(user);
  }
});
