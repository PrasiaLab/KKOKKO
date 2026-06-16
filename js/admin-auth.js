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
  firebaseConfig,
  isConfiguredAdmin
} from "./firebase-config.js";

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

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
  setStatus("Google 계정을 확인하는 중입니다.");

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (!isConfiguredAdmin(user.uid)) {
      setStatus(
        `등록되지 않은 계정입니다. 관리자 UID: ${user.uid}`
      );
      await signOut(auth);
      return;
    }

    window.location.href = "./admin.html";
  } catch (error) {
    console.error(error);
    setStatus("로그인하지 못했습니다. 팝업 차단 여부를 확인해주세요.");
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
});
