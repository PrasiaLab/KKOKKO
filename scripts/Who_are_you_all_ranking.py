from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests


# =========================================================
# 너 누구야 - 전체 서버 통합 랭킹 추출기 / GitHub Actions 대응
#
# 생성 파일
#   1) Who_are_you.json          : 전체 서버 일반 랭킹
#   2) Who_are_you_guild.json    : 전체 서버 결사 랭킹
#   3) Who_are_you_class.json    : 서버별/클래스별 랭킹
#
# 각 JSON에는 한국시간 기준 추출 시각이 포함됩니다.
# =========================================================

BASE_URL = "https://wp-api.nexon.com/v1/GameData"
GC_RANKING_URL = f"{BASE_URL}/gcranking"
GUILD_RANKING_URL = f"{BASE_URL}/guildranking"

# Bearer라는 글자는 빼고 토큰 값만 입력하세요.
AUTH_TOKEN = "3E5C4287-849D-4EAA-A4EB-4528C9AB8E7D"

HEADERS = {
    "X-Wp-Api-Key": "wp_fe_api_key",
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Origin": "https://wp.nexon.com",
    "Referer": "https://wp.nexon.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/149.0.0.0 Safari/537.36"
    ),
}

WORLDS = [
    "2-1", "2-2", "2-3", "2-4", "2-5",
    "3-1", "3-2", "3-3", "3-4", "3-5",
    "5-1", "5-2", "5-3", "5-4", "5-5",
    "8-1", "8-2", "8-3", "8-4", "8-5",
    "10-1", "10-2", "10-3", "10-4", "10-5",
    "11-1", "11-2", "11-3", "11-4", "11-5",
    "12-1", "12-2", "12-3", "12-4", "12-5",
    "14-1", "14-2", "14-3", "14-4", "14-5",
    "16-1", "16-2", "16-3", "16-4", "16-5",
    "27-1", "27-2", "27-3", "27-4", "27-5",
]

CLASS_MAP = {
    "abyssrevenant": "심연추방자",
    "enforcer": "집행관",
    "solarsentinel": "태양감시자",
    "runescribe": "주문각인사",
    "mirageblade": "환영검사",
    "wildwarrior": "야만투사",
    "incensearcher": "향사수",
}

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = REPO_ROOT / "data"

OUTPUT_CHARACTER = OUTPUT_DIR / "Who_are_you.json"
OUTPUT_GUILD = OUTPUT_DIR / "Who_are_you_guild.json"
OUTPUT_CLASS = OUTPUT_DIR / "Who_are_you_class.json"
OUTPUT_STATUS = OUTPUT_DIR / "ranking_update_status.json"

REQUEST_TIMEOUT = 20
REQUEST_DELAY = 0.15
MAX_RETRIES = 3


def make_world_ids(world: str) -> tuple[str, str]:
    server, channel = world.split("-")
    world_group_id = f"LIVE_W{int(server):02d}"
    world_id = f"{world_group_id}_R{channel}"
    return world_group_id, world_id


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def get_extracted_time() -> tuple[str, str]:
    now = datetime.now(ZoneInfo("Asia/Seoul"))
    return (
        now.isoformat(timespec="seconds"),
        now.strftime("%Y-%m-%d %H:%M:%S"),
    )


def request_ranking(
    session: requests.Session,
    url: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.post(
                url,
                json=payload,
                timeout=REQUEST_TIMEOUT,
            )

            if response.status_code == 401:
                raise RuntimeError(
                    "인증 실패(401): 토큰이 만료되었거나 잘못되었습니다."
                )

            if response.status_code == 403:
                raise RuntimeError(
                    "접근 거부(403): 토큰 또는 API 헤더를 확인하세요."
                )

            response.raise_for_status()
            data = response.json()

            if data.get("code") != "0000":
                raise RuntimeError(
                    f"API 오류: code={data.get('code')}, "
                    f"message={data.get('message')}"
                )

            return data

        except Exception as error:
            last_error = error

            if attempt < MAX_RETRIES:
                print(f"    재시도 {attempt}/{MAX_RETRIES - 1}: {error}")
                time.sleep(1)

    raise RuntimeError(str(last_error))


def extract_character_ranking(
    data: dict[str, Any],
    world: str,
    world_group_id: str,
    world_id: str,
    class_code: str | None = None,
    class_name: str | None = None,
) -> list[dict[str, Any]]:
    players = data.get("result", {}).get("gc", [])
    result: list[dict[str, Any]] = []

    for player in players:
        item = {
            "world": world,
            "world_group_id": world_group_id,
            "world_id": world_id,
            "name": player.get("gc_name"),
            "level": player.get("gc_level"),
            "grade": safe_int(player.get("string_map", {}).get("grade", 0)),
            "class": player.get("class"),
            "guild": player.get("guild_name"),
            "ranking": player.get("ranking"),
        }

        if class_code is not None:
            item["ranking_class_code"] = class_code
            item["ranking_class_name"] = class_name

        result.append(item)

    return result


def extract_guild_ranking(
    data: dict[str, Any],
    world: str,
    world_group_id: str,
    world_id: str,
) -> list[dict[str, Any]]:
    guilds = data.get("result", {}).get("guild_ranking", [])
    result: list[dict[str, Any]] = []

    for guild in guilds:
        result.append({
            "world": world,
            "world_group_id": world_group_id,
            "world_id": world_id,
            "ranking": guild.get("ranking"),
            "ranking_change": guild.get("ranking_change"),
            "guild_name": guild.get("guild_name"),
            "guild_master": guild.get("guild_master_gc_name"),
            "guild_level": guild.get("guild_level"),
            "guild_member_count": guild.get("guild_member_count"),
            "max_guild_member_count": guild.get("max_guild_member_count"),
            "territory_flag_id": guild.get("territory_flag_id", []),
            "territory_name": guild.get("territory_name", []),
        })

    return result


def save_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")

    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)

    temp_path.replace(path)


def make_metadata(
    data_type: str,
    extracted_at: str,
    extracted_at_text: str,
    item_count: int,
    failure_count: int,
) -> dict[str, Any]:
    return {
        "data_type": data_type,
        "extracted_at": extracted_at,
        "extracted_at_text": extracted_at_text,
        "timezone": "Asia/Seoul",
        "world_count": len(WORLDS),
        "item_count": item_count,
        "failure_count": failure_count,
        "version": 2,
    }


def validate_token() -> None:
    token = AUTH_TOKEN.strip()
    if not token or token == "여기에_토큰_값만_입력":
        raise ValueError("AUTH_TOKEN에 토큰 값을 입력하세요.")

    # 사용자가 실수로 Bearer까지 붙여도 자동 보정
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    HEADERS["Authorization"] = f"Bearer {token}"



def save_status(
    *,
    status: str,
    extracted_at: str,
    extracted_at_text: str,
    character_count: int = 0,
    guild_count: int = 0,
    class_count: int = 0,
    failure_count: int = 0,
    message: str = "",
) -> None:
    save_json(
        OUTPUT_STATUS,
        {
            "status": status,
            "updated_at": extracted_at,
            "updated_at_text": extracted_at_text,
            "timezone": "Asia/Seoul",
            "character_count": character_count,
            "guild_count": guild_count,
            "class_count": class_count,
            "failure_count": failure_count,
            "message": message,
        },
    )


def main() -> None:
    try:
        validate_token()
    except ValueError as error:
        print(f"설정 오류: {error}")
        try:
            input("\n엔터를 누르면 종료합니다...")
        except EOFError:
            pass
        return

    extracted_at, extracted_at_text = get_extracted_time()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    save_status(
        status="running",
        extracted_at=extracted_at,
        extracted_at_text=extracted_at_text,
        message="랭킹 데이터를 갱신하고 있습니다.",
    )

    all_characters: list[dict[str, Any]] = []
    all_guilds: list[dict[str, Any]] = []
    all_class_rankings: list[dict[str, Any]] = []

    failed_character_worlds: list[dict[str, str]] = []
    failed_guild_worlds: list[dict[str, str]] = []
    failed_class_requests: list[dict[str, str]] = []

    total_class_requests = len(WORLDS) * len(CLASS_MAP)
    class_request_index = 0

    print("=" * 66)
    print("너 누구야 - 전체 서버 일반/결사/클래스 랭킹 통합 추출")
    print(f"추출 시작: {extracted_at_text} (KST)")
    print(f"대상 서버: {len(WORLDS)}개")
    print(f"클래스 요청: {total_class_requests}회")
    print("=" * 66)

    with requests.Session() as session:
        session.headers.update(HEADERS)

        for index, world in enumerate(WORLDS, start=1):
            world_group_id, world_id = make_world_ids(world)

            base_payload = {
                "world_group_id": world_group_id,
                "world_id": world_id,
            }

            print(f"\n[{index:02d}/{len(WORLDS)}] {world} ({world_id})")

            # 전체 랭킹
            try:
                character_data = request_ranking(
                    session,
                    GC_RANKING_URL,
                    base_payload,
                )
                characters = extract_character_ranking(
                    character_data,
                    world,
                    world_group_id,
                    world_id,
                )
                all_characters.extend(characters)
                print(f"  전체 랭킹 완료: {len(characters):,}명")
            except Exception as error:
                failed_character_worlds.append({
                    "world": world,
                    "world_id": world_id,
                    "error": str(error),
                })
                print(f"  전체 랭킹 실패: {error}")

            time.sleep(REQUEST_DELAY)

            # 결사 랭킹
            try:
                guild_data = request_ranking(
                    session,
                    GUILD_RANKING_URL,
                    base_payload,
                )
                guilds = extract_guild_ranking(
                    guild_data,
                    world,
                    world_group_id,
                    world_id,
                )
                all_guilds.extend(guilds)
                print(f"  결사 랭킹 완료: {len(guilds):,}개")
            except Exception as error:
                failed_guild_worlds.append({
                    "world": world,
                    "world_id": world_id,
                    "error": str(error),
                })
                print(f"  결사 랭킹 실패: {error}")

            time.sleep(REQUEST_DELAY)

            # 클래스별 랭킹
            server_class_total = 0

            for class_code, class_name in CLASS_MAP.items():
                class_request_index += 1
                class_payload = {
                    **base_payload,
                    "class": class_code,
                }

                try:
                    class_data = request_ranking(
                        session,
                        GC_RANKING_URL,
                        class_payload,
                    )
                    class_players = extract_character_ranking(
                        class_data,
                        world,
                        world_group_id,
                        world_id,
                        class_code=class_code,
                        class_name=class_name,
                    )
                    all_class_rankings.extend(class_players)
                    server_class_total += len(class_players)
                    print(
                        f"  클래스 [{class_name}] 완료: "
                        f"{len(class_players):,}명 "
                        f"({class_request_index}/{total_class_requests})"
                    )
                except Exception as error:
                    failed_class_requests.append({
                        "world": world,
                        "world_id": world_id,
                        "class_code": class_code,
                        "class_name": class_name,
                        "error": str(error),
                    })
                    print(f"  클래스 [{class_name}] 실패: {error}")

                time.sleep(REQUEST_DELAY)

            print(f"  클래스별 합계: {server_class_total:,}명")

    character_document = {
        "metadata": make_metadata(
            "overall_ranking",
            extracted_at,
            extracted_at_text,
            len(all_characters),
            len(failed_character_worlds),
        ),
        "rankings": all_characters,
        "failures": failed_character_worlds,
    }

    guild_document = {
        "metadata": make_metadata(
            "guild_ranking",
            extracted_at,
            extracted_at_text,
            len(all_guilds),
            len(failed_guild_worlds),
        ),
        "rankings": all_guilds,
        "failures": failed_guild_worlds,
    }

    class_document = {
        "metadata": {
            **make_metadata(
                "class_ranking",
                extracted_at,
                extracted_at_text,
                len(all_class_rankings),
                len(failed_class_requests),
            ),
            "class_count": len(CLASS_MAP),
            "request_count": total_class_requests,
        },
        "class_map": CLASS_MAP,
        "rankings": all_class_rankings,
        "failures": failed_class_requests,
    }

    save_json(OUTPUT_CHARACTER, character_document)
    save_json(OUTPUT_GUILD, guild_document)
    save_json(OUTPUT_CLASS, class_document)

    total_failures = (
        len(failed_character_worlds)
        + len(failed_guild_worlds)
        + len(failed_class_requests)
    )

    final_status = "success" if total_failures == 0 else "partial_failure"
    final_message = (
        "모든 랭킹 데이터가 정상적으로 갱신되었습니다."
        if total_failures == 0
        else f"일부 요청이 실패했습니다. 실패 건수: {total_failures}"
    )

    save_status(
        status=final_status,
        extracted_at=extracted_at,
        extracted_at_text=extracted_at_text,
        character_count=len(all_characters),
        guild_count=len(all_guilds),
        class_count=len(all_class_rankings),
        failure_count=total_failures,
        message=final_message,
    )

    print("
" + "=" * 66)
    print("추출 완료")
    print(f"갱신 시간: {extracted_at_text} (KST)")
    print(f"전체 랭킹: {len(all_characters):,}명")
    print(f"결사 랭킹: {len(all_guilds):,}개")
    print(f"클래스별 랭킹: {len(all_class_rankings):,}명")
    print(f"전체 JSON: {OUTPUT_CHARACTER.resolve()}")
    print(f"결사 JSON: {OUTPUT_GUILD.resolve()}")
    print(f"클래스 JSON: {OUTPUT_CLASS.resolve()}")
    print(f"상태 JSON: {OUTPUT_STATUS.resolve()}")
    print(f"전체 랭킹 실패: {len(failed_character_worlds)}건")
    print(f"결사 랭킹 실패: {len(failed_guild_worlds)}건")
    print(f"클래스 요청 실패: {len(failed_class_requests)}건")
    print("=" * 66)

    if total_failures > 0:
        raise RuntimeError(
            f"일부 랭킹 요청이 실패하여 자동 커밋을 중단합니다. "
            f"실패 건수: {total_failures}"
        )


if __name__ == "__main__":
    main()
