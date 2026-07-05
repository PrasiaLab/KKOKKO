(function () {
  const gradeRules = {
    14: { hit: 720, skill: 410 },
    15: { hit: 780, skill: 440 },
    16: { hit: 840, skill: 480 },
    17: { hit: 900, skill: 500 },
    18: { hit: 960, skill: 520 },
    19: { hit: 1020, skill: 560 },
    20: { hit: 1100, skill: 620 },
    21: { hit: 1170, skill: 660 },
    22: { hit: 1240, skill: 700 },
    23: { hit: 1300, skill: 740 },
    24: { hit: 1370, skill: 800 },
    25: { hit: 1440, skill: 840 },
    26: { hit: 1510, skill: 880 }
  };

  const stanceMap = {
    "향사수": ["장궁", "단궁", "대석궁"],
    "주문각인사": ["원소", "충전", "기류"],
    "환영검사": ["장검", "환영검", "환영방패"],
    "야만투사": ["야성"],
    "집행관": ["수호", "심판", "헌신"],
    "태양감시자": ["검무", "질풍", "환원"],
    "심연추방자": ["복수", "해방", "지배"]
  };

  const $ = (id) => document.getElementById(id);
  const form = $("raidRequestForm");

  if (!form) {
    return;
  }

  const numberIds = [
    "requestPower",
    "requestAttack",
    "requestDefense",
    "requestSpeed",
    "requestCritical",
    "requestHit",
    "requestClassHit",
    "requestSkillHit",
    "requestSomaHit",
    "requestMonsterHit"
  ];

  function n(id) {
    const value = parseFloat($(id)?.value || "0");
    return Number.isFinite(value) ? value : 0;
  }

  function fmt(value) {
    if (value === "" || value === null || value === undefined) {
      return "-";
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return value;
    }
    return numeric.toLocaleString("ko-KR");
  }

  function setText(id, value) {
    const element = $(id);
    if (element) {
      element.textContent = value;
    }
  }

  function updateStances() {
    const className = $("requestClass").value;
    const stanceSelect = $("requestStance");
    const stances = stanceMap[className] || [];

    stanceSelect.innerHTML = stances
      .map((stance) => `<option value="${stance}">${stance}</option>`)
      .join("");
  }

  function getInputData() {
    const grade = Number($("requestGrade").value);
    const marksman = $("requestMarksman").checked;
    const seal = $("requestSeal").checked;
    const finalHit =
      n("requestHit") +
      n("requestClassHit") +
      n("requestSomaHit") +
      n("requestMonsterHit") +
      (marksman ? 21 : 0) +
      (seal ? 5 : 0);
    const finalSkill =
      n("requestSkillHit") +
      n("requestMonsterHit") +
      (marksman ? 17 : 0);

    return {
      grade,
      rule: gradeRules[grade],
      className: $("requestClass").value,
      stance: $("requestStance").value,
      power: n("requestPower"),
      attack: n("requestAttack"),
      defense: n("requestDefense"),
      speed: n("requestSpeed"),
      critical: n("requestCritical"),
      finalHit,
      finalSkill,
      marksman,
      seal
    };
  }

  function judge(data) {
    const hitGap = data.finalHit - data.rule.hit;
    const skillGap = data.finalSkill - data.rule.skill;
    const worstGap = Math.min(hitGap, skillGap);

    if (hitGap >= 0 && skillGap >= 0) {
      return {
        key: "possible",
        label: "의뢰 가능",
        message: `${data.grade}등급 기준 명중과 스킬명중을 모두 충족했습니다. 기본 조건상 클리어 가능성이 높습니다.`
      };
    }

    if (worstGap >= -10) {
      const parts = [];
      if (hitGap < 0) parts.push(`명중 ${Math.abs(hitGap)} 부족`);
      if (skillGap < 0) parts.push(`스킬명중 ${Math.abs(skillGap)} 부족`);
      return {
        key: "maybe",
        label: "가능성 있음",
        message: `${data.grade}등급 기준에서 ${parts.join(" / ")}입니다. -5~-10 정도의 차이라 가능성 있음으로 안내됩니다.`
      };
    }

    const parts = [];
    if (hitGap < 0) parts.push(`명중 ${Math.abs(hitGap)} 부족`);
    if (skillGap < 0) parts.push(`스킬명중 ${Math.abs(skillGap)} 부족`);
    return {
      key: "hard",
      label: "어려움",
      message: `${data.grade}등급 기준에서 ${parts.join(" / ")}입니다. 현재 입력 기준으로는 의뢰 진행이 어려울 수 있습니다.`
    };
  }

  function syncCertificate(data, result) {
    setText("certGrade", data.grade);
    setText("certClass", data.className);
    setText("certStance", data.stance || "-");
    setText("certPower", data.power ? fmt(data.power) : "-");
    setText("certAttack", data.attack ? fmt(data.attack) : "-");
    setText("certDefense", data.defense ? fmt(data.defense) : "-");
    setText("certSpeed", data.speed ? fmt(data.speed) : "-");
    setText("certCritical", data.critical ? fmt(data.critical) : "-");
    setText("certFinalHit", fmt(data.finalHit));
    setText("certFinalSkillHit", fmt(data.finalSkill));
    setText("certVerdict", result.label);
    setText("certNote", result.message);

    const certVerdict = $("certVerdict");
    certVerdict.className = `certificate-verdict ${result.key}`;
  }

  function renderResult() {
    const data = getInputData();
    const result = judge(data);

    setText("finalHit", fmt(data.finalHit));
    setText("finalSkillHit", fmt(data.finalSkill));
    setText("needHitLabel", `${data.grade}등급 필요 명중`);
    setText("needSkillLabel", `${data.grade}등급 필요 스킬명중`);
    setText("needHit", fmt(data.rule.hit));
    setText("needSkillHit", fmt(data.rule.skill));
    setText("raidVerdictText", result.label);
    setText("raidResultMessage", result.message);
    setText("raidResultStamp", new Date().toLocaleString("ko-KR"));

    const verdictCard = $("raidVerdictCard");
    verdictCard.className = `raid-verdict-card ${result.key}`;

    syncCertificate(data, result);
    $("raidSaveButton").disabled = false;
  }

  function resetForm() {
    numberIds.forEach((id) => {
      const input = $(id);
      if (input) input.value = "";
    });
    $("requestGrade").value = "25";
    $("requestClass").value = "향사수";
    $("requestMarksman").checked = false;
    $("requestSeal").checked = false;
    updateStances();

    setText("finalHit", "-");
    setText("finalSkillHit", "-");
    setText("needHit", "-");
    setText("needSkillHit", "-");
    setText("needHitLabel", "필요 명중");
    setText("needSkillLabel", "필요 스킬명중");
    setText("raidVerdictText", "확인 전");
    setText("raidResultMessage", "토벌 등급과 스펙을 입력한 뒤 확인 버튼을 눌러 주세요.");
    setText("raidResultStamp", "입력 대기 중");
    $("raidVerdictCard").className = "raid-verdict-card pending";
    $("raidSaveButton").disabled = true;

    syncCertificate(getInputData(), { key: "pending", label: "확인 전", message: "본 확인증은 토벌 의뢰 전 참고용이며, 최종 가능 여부는 실제 진행 상황에 따라 달라질 수 있습니다." });
  }

  async function saveCertificate() {
    const target = $("raidCertificate");
    const button = $("raidSaveButton");

    if (!target || !window.html2canvas) {
      alert("이미지 저장 기능을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    button.disabled = true;
    button.classList.add("saving");

    try {
      const canvas = await window.html2canvas(target, {
        backgroundColor: null,
        scale: Math.min(window.devicePixelRatio || 2, 3),
        useCORS: true
      });
      const link = document.createElement("a");
      const grade = $("requestGrade").value;
      const className = $("requestClass").value;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      link.download = `토벌스펙확인증_${grade}등급_${className}_${stamp}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      alert("스펙 확인증 저장 중 오류가 발생했습니다.");
    } finally {
      button.disabled = false;
      button.classList.remove("saving");
    }
  }

  $("requestClass").addEventListener("change", updateStances);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderResult();
  });
  $("raidRequestReset").addEventListener("click", resetForm);
  $("raidSaveButton").addEventListener("click", saveCertificate);

  updateStances();
  syncCertificate(getInputData(), { key: "pending", label: "확인 전", message: "본 확인증은 토벌 의뢰 전 참고용이며, 최종 가능 여부는 실제 진행 상황에 따라 달라질 수 있습니다." });
})();
