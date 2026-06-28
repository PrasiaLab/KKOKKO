/**
 * 결사 이전 분석 전용 Firebase Functions 예시 코드입니다.
 *
 * 목적:
 * - 기존 홈페이지 자료 갱신 함수(triggerRankingUpdate)는 건드리지 않습니다.
 * - 새 함수 triggerGuildTraceSnapshotUpdate만 추가합니다.
 * - 이 함수는 GitHub Actions의 update-guild-trace-snapshot.yml만 실행합니다.
 *
 * 주의:
 * - 이 파일은 예시입니다. 실제 functions/index.js 또는 functions/src/index.ts 구조에 맞춰 옮겨야 합니다.
 * - GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO 환경변수/Secret 설정이 필요합니다.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");

if (!admin.apps.length) {
  admin.initializeApp();
}

const ADMIN_UIDS = [
  "kgb0KhPYWLZYXt5YdAA7iuHMxYT2",
  "rkT0L6EK6Yd2IFNHBIQ8dVgqdHX2",
  "KhK0yllx62f20RU6YkUbxcDC3W53",
];

function assertAdmin(request) {
  const uid = request.auth && request.auth.uid;

  if (!uid || !ADMIN_UIDS.includes(uid)) {
    throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  }
}

async function githubFetch(path, options = {}) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = GITHUB_TOKEN.value();

  if (!owner || !repo || !token) {
    throw new HttpsError(
      "failed-precondition",
      "GitHub 환경변수 또는 Secret 설정이 필요합니다."
    );
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new HttpsError("internal", `GitHub API 오류: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function findWorkflowRunId({ workflowFile, requestedAtIso }) {
  const since = encodeURIComponent(requestedAtIso);
  const result = await githubFetch(
    `/actions/workflows/${workflowFile}/runs?event=workflow_dispatch&created=>=${since}&per_page=10`
  );

  const runs = Array.isArray(result && result.workflow_runs)
    ? result.workflow_runs
    : [];

  return runs[0] ? String(runs[0].id) : null;
}

exports.triggerGuildTraceSnapshotUpdate = onCall(
  {
    region: "asia-northeast3",
    secrets: [GITHUB_TOKEN],
    timeoutSeconds: 60,
  },
  async (request) => {
    assertAdmin(request);

    const snapshotRole = request.data && request.data.snapshotRole;
    const snapshotId = request.data && request.data.snapshotId;
    const useExisting = Boolean(request.data && request.data.useExisting);

    if (!["before", "after", "normal"].includes(snapshotRole)) {
      throw new HttpsError("invalid-argument", "snapshotRole은 before/after/normal 중 하나여야 합니다.");
    }

    if (!snapshotId || !/^\d{4}-\d{2}-\d{2}_\d{4}$/.test(snapshotId)) {
      throw new HttpsError("invalid-argument", "snapshotId 형식이 올바르지 않습니다.");
    }

    const workflowFile = "update-guild-trace-snapshot.yml";
    const requestedAt = new Date().toISOString();

    await githubFetch(`/actions/workflows/${workflowFile}/dispatches`, {
      method: "POST",
      body: JSON.stringify({
        ref: "main",
        inputs: {
          snapshot_id: snapshotId,
          use_existing: String(useExisting),
          snapshot_role: snapshotRole,
        },
      }),
    });

    /**
     * GitHub workflow_dispatch는 즉시 runId를 주지 않습니다.
     * 기존 triggerRankingUpdate 함수가 이미 runId 확인 로직을 갖고 있다면 그 방식을 그대로 쓰세요.
     * 아래는 최근 실행 목록에서 찾는 단순 예시입니다.
     */
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const runId = await findWorkflowRunId({
      workflowFile,
      requestedAtIso: requestedAt,
    });

    return {
      ok: true,
      runId,
      requestedAt,
      message:
        snapshotRole === "before"
          ? "결사 이전 분석 이전데이터 저장 작업을 요청했습니다."
          : "결사 이전 분석 이후데이터 저장 작업을 요청했습니다.",
    };
  }
);
