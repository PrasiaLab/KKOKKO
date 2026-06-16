/*
 * Firebase 공통 설정
 * 웹용 firebaseConfig는 공개되어도 되는 연결 정보입니다.
 */

export const firebaseConfig = {
  apiKey: "AIzaSyBTo1X0MbgYC-Kh_yqLrakXrBMoRibvWk",
  authDomain: "prasialab.firebaseapp.com",
  projectId: "prasialab",
  storageBucket: "prasialab.firebasestorage.app",
  messagingSenderId: "844238283131",
  appId: "1:844238283131:web:b46548f82cc9e5948d5dde",
  measurementId: "G-YSXY10S0XD"
};

/*
 * 최초 로그인 후 표시되는 관리자 UID를 아래에 입력하세요.
 */
export const ADMIN_UIDS = [
  "PASTE_ADMIN_UID_HERE"
];

export function isConfiguredAdmin(uid) {
  return Boolean(uid) &&
    ADMIN_UIDS.includes(uid) &&
    uid !== "PASTE_ADMIN_UID_HERE";
}
