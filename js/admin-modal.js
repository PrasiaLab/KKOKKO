(() => {
  "use strict";

  const loginButton = document.getElementById(
    "adminLoginButton"
  );

  const modal = document.getElementById(
    "adminLoginModal"
  );

  const closeButton = document.getElementById(
    "adminLoginClose"
  );

  if (!loginButton || !modal) {
    return;
  }

  function openModal() {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  /*
   * Firebase 모듈이 늦게 로드되거나 오류가 발생하더라도
   * 관리자 로그인 버튼을 누르면 팝업 자체는 항상 열립니다.
   */
  loginButton.addEventListener("click", openModal);

  closeButton?.addEventListener(
    "click",
    closeModal
  );

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        modal.classList.contains("open")
      ) {
        closeModal();
      }
    }
  );

  window.KKOKKO_ADMIN_MODAL = {
    open: openModal,
    close: closeModal
  };
})();
