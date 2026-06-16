/*
 * Firebase 공통 설정
 * 웹용 firebaseConfig는 공개되어도 되는 연결 정보입니다.
 */

export const firebaseConfig = {
  apiKey: "AIzaSyBTo1X0MbgYC-Kh_yqLrakXrBMoRibvwvk",
  authDomain: "prasialab.firebaseapp.com",
  projectId: "prasialab",
  storageBucket: "prasialab.firebasestorage.app",
  messagingSenderId: "844238283131",
  appId: "1:844238283131:web:b46548f82cc9e5948d5dde",
  measurementId: "G-YSXY10S0XD"
};

/*
 * 관리자 UID
 */
export const ADMIN_UIDS = [
  "kgb0KhPYWLZYXt5YdAA7iuHMxYT2",
  "rkT0L6EK6Yd2IFNHBIQ8dVgqdHX2",
  "KhK0yllx62f20RU6YkUbxcDC3W53"
];

export function isConfiguredAdmin(uid) {
  return Boolean(uid) &&
    ADMIN_UIDS.includes(uid);
}
