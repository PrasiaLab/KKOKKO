window.guildTraceFirestoreConfigPromise = (async () => {
  try {
    const [
      appModule,
      firestoreModule,
      configModule
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js"),
      import("./firebase-config.js")
    ]);

    const app = appModule.getApps().length
      ? appModule.getApps()[0]
      : appModule.initializeApp(configModule.firebaseConfig);

    const db = firestoreModule.getFirestore(app);
    const snapshot = await firestoreModule.getDoc(
      firestoreModule.doc(db, "siteSettings", "guildTraceConfig")
    );

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  } catch (error) {
    console.warn("결사 이전 분석 Firestore 설정 로드 실패", error);
    return null;
  }
})();
