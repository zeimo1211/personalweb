"""Download missing game covers and convert them to WebP.

Sources are public Steam header art when available, with Wikimedia page
thumbnails as a fallback. Existing files are never overwritten.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "static" / "data" / "games.json"
OUT = ROOT / "static" / "image" / "game"
UA = "personalweb-cover-fetcher/1.0"

# English search names are used only for source lookup; output names always
# come from games.json.
SEARCH_NAMES = {
    "dpx6": "Forza Horizon 6",
    "totk": "The Legend of Zelda Tears of the Kingdom",
    "densshattack": "Denshattack",
    "Rhythm-Tengoku4": "Rhythm Heaven",
    "honkie-starrail": "Honkai Star Rail",
    "wukong": "Black Myth Wukong",
    "rdr2": "Red Dead Redemption 2",
    "endfield": "Arknights Endfield",
    "splitfiction": "Split Fiction",
    "forestsons": "Sons of the Forest",
    "ittakestwo": "It Takes Two",
    "portal": "Portal",
    "death-stranding": "Death Stranding",
    "botw": "The Legend of Zelda Breath of the Wild",
    "Monument-Valley": "Monument Valley",
    "Dragon-Raja": "Dragon Raja",
    "wuwa": "Wuthering Waves",
    "Tower-of-Fantasy": "Tower of Fantasy",
    "yys": "Onmyoji",
    "ninjamustdie3": "Ninja Must Die",
    "Aether-Gaze": "Aether Gazer",
    "Pokemon-Shield": "Pokemon Sword and Shield",
    "human-fallflat": "Human Fall Flat",
    "awayout": "A Way Out",
    "Detroit-bh": "Detroit Become Human",
    "cities-skylines": "Cities Skylines",
    "pcbuilding-simulator2": "PC Building Simulator 2",
    "hollow-knight": "Hollow Knight",
    "sheephome": "Sheep Home",
    "hogwarts": "Hogwarts Legacy",
    "honor-of-kings-world": "Honor of Kings World",
    "NTE": "Neverness to Everness",
    "Infinity-Nikki": "Infinity Nikki",
    "Path-to-Nowhere": "Path to Nowhere",
    "GRAY-RAVEN-PUNISHING": "Punishing Gray Raven",
    "Harry-Potter-Magic-Awakened": "Harry Potter Magic Awakened",
    "portVow-of-Heroes": "Vow of Heroes game",
    "sanguosha": "Sanguosha",
    "全民飞机大战": "全民飞机大战",
    "天天飞车": "Tiantian Feiche game",
}

STEAM_IDS = {
    "honkie-starrail": 1377580,
    "death-stranding": 1190460,
    "wuwa": 3513350,
    "human-fallflat": 477160,
}

# Wikimedia's search can return an actor, publisher, or list page. These
# generated files are deliberately retried with a stricter source lookup.
REPROCESS = {
    "game-endfield.webp", "game-ninjamustdie3.webp", "game-Aether-Gaze.webp",
    "game-Pokemon-Shield.webp", "game-pcbuilding-simulator2.webp",
    "game-honor-of-kings-world.webp", "game-Path-to-Nowhere.webp",
    "game-Harry-Potter-Magic-Awakened.webp", "game-天天飞车.webp",
}

CUSTOM_URLS = {
    "dpx6": ("https://cms-assets.xboxservices.com/assets/ef/23/ef2385bc-759b-4bea-9e97-c39ab5e4f49c.jpg?n=0399951111277_GLP-Page-Hero-0_1083x1222_02.jpg", "Xbox official"),
    "densshattack": ("https://www.gamegrin.com/assets/games/denshattack/_resampled/SetWidth280-denshattack-artwork.jpg", "GameGrin"),
    "Dragon-Raja": ("https://www.overclockzone.com/_admin/covercontent/3269-1591270387.jpg", "Overclockzone"),
    "wuwa": ("https://cdn1.epicgames.com/spt-assets/c1586295960b46f88bbfeec32c199e0e/wuthering-waves-1meoc.jpg?h=270&quality=medium&resize=1&w=480", "Epic Games Store"),
    "pcbuilding-simulator2": ("https://gaming-cdn.com/images/products/10597/screenshot/pc-building-simulator-2-pc-spel-epic-games-wallpaper-1.jpg?v=1698227142", "Gaming-cdn"),
    "NTE": ("https://www.mmobomb.com/file/2026/4/nte-download.jpg", "MMOBomb"),
    "GRAY-RAVEN-PUNISHING": ("https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4125930/2b756cc667bac74ea07415136a75aeeb15571475/header_japanese.jpg?t=1780375411", "Steam"),
    "Aether-Gaze": ("https://media.licdn.com/dms/image/v2/D5612AQFabnPQ1nTPLQ/article-cover_image-shrink_600_2000/article-cover_image-shrink_600_2000/0/1656422074710?e=2147483647&t=krN-VEynbX0D4RJ-XZW0iHPM8GDHacR2WCeNlN9orEA&v=beta", "Yostar/LinkedIn"),
    "ninjamustdie3": ("https://onlinegame-pla.net/wp-content/uploads/2022/10/1-22.jpg", "Online Game Planet"),
    "Path-to-Nowhere": ("https://www.shabondama.jp/wp-content/uploads/2025/11/%E7%84%A1%E6%9C%9F%E8%BF%B7%E9%80%94%EF%BC%9APath-to-Nowhere1.jpg", "GamePicks"),
    "Harry-Potter-Magic-Awakened": ("https://prtimes.jp/i/71247/29/resize/d71247-29-935996-0.jpg", "NetEase press release"),
    "endfield": ("https://www.enduins.com/wp-content/uploads/2023/12/arknights-endfield-1.jpg", "Enduins"),
    "portVow-of-Heroes": ("https://media.9game.cn/gamebase/ieu-eagle-docking-service/images/20230620/14/30/76d13596ba9f9068254fd9696598c0ce.png", "9Game"),
    "sanguosha": ("https://www.sanguosha.cn/storage/uploads//images/thumb/23052502508faf52e2e84394f58f9bdc755185.jpeg", "Sanguosha official"),
    "全民飞机大战": ("local:game-qqspeed-mobile.webp", "local genre fallback"),
    "Pokemon-Shield": ("https://static.actugaming.net/media/2019/02/artwork-carte.jpg", "ActuGaming"),
    "天天飞车": ("local:game-qqspeed-mobile.webp", "local genre fallback"),
}


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def download(url: str, path: Path) -> None:
    result = subprocess.run(["curl.exe", "-L", "--retry", "3", "--connect-timeout", "20", "--max-time", "60", "-A", UA, "-o", str(path), url], capture_output=True)
    if result.returncode != 0 or not path.exists() or path.stat().st_size < 1024:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as response:
            path.write_bytes(response.read())


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def steam_cover(query: str) -> tuple[str, str] | None:
    forced_id = STEAM_IDS.get(next((key for key, value in SEARCH_NAMES.items() if value == query), ""))
    if forced_id:
        return (f"https://cdn.akamai.steamstatic.com/steam/apps/{forced_id}/header.jpg", query)
    url = "https://store.steampowered.com/api/storesearch/?" + urllib.parse.urlencode(
        {"term": query, "l": "english", "cc": "us"}
    )
    data = get_json(url)
    items = data.get("items", [])
    if not items:
        return None
    q = norm(query)
    exact = next((item for item in items if norm(item.get("name", "")) == q), None)
    item = exact or items[0]
    appid = item.get("id")
    if not appid:
        return None
    return (f"https://cdn.akamai.steamstatic.com/steam/apps/{appid}/header.jpg", item.get("name", ""))


def wikimedia_cover(query: str) -> tuple[str, str] | None:
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(
        {
            "action": "query",
            "generator": "search",
            "gsrsearch": query,
            "gsrnamespace": 0,
            "gsrlimit": 5,
            "prop": "pageimages|info",
            "inprop": "url",
            "piprop": "thumbnail",
            "pithumbsize": 900,
            "format": "json",
        }
    )
    data = get_json(url)
    pages = list(data.get("query", {}).get("pages", {}).values())
    tokens = [token for token in re.findall(r"[a-z0-9]+", query.lower()) if len(token) > 2]
    ranked = sorted(pages, key=lambda page: sum(token in page.get("title", "").lower() for token in tokens), reverse=True)
    for page in ranked:
        title = page.get("title", "")
        title_lower = title.lower()
        score = sum(token in title_lower for token in tokens)
        thumb = page.get("thumbnail", {}).get("source")
        if thumb and (score >= max(2, len(tokens) // 2)) and not any(bad in title_lower for bad in ("list of", "discography", "actor", "actress", "company", "publisher")):
            return thumb, page.get("title", "")
    return None


def bing_image(query: str) -> tuple[str, str] | None:
    url = "https://www.bing.com/images/search?" + urllib.parse.urlencode({"q": query + " game key art horizontal", "form": "HDRSC2"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as response:
        html = response.read().decode("utf-8", errors="ignore")
    matches = re.findall(r'"murl":"(https?://[^"\\]+)', html)
    for image_url in matches[:12]:
        image_url = image_url.replace("\\/", "/")
        if any(ext in image_url.lower().split("?")[0] for ext in (".jpg", ".jpeg", ".png", ".webp")):
            return image_url, query
    return None


def main() -> int:
    covers = re.findall(r'"cover"\s*:\s*"([^"]+)"', DATA.read_text(encoding="utf-8"))
    missing = [Path(path.lstrip("/")).name for path in covers if not (ROOT / path.lstrip("/")).exists()]
    missing += [name for name in REPROCESS if (OUT / name).exists() and name not in missing]
    if not missing:
        print("No missing covers.")
        return 0
    report: list[dict[str, str]] = []
    with tempfile.TemporaryDirectory(prefix="game-covers-") as temp:
        temp_dir = Path(temp)
        for filename in missing:
            game_id = filename.removeprefix("game-").removesuffix(".webp")
            query = SEARCH_NAMES.get(game_id, game_id.replace("-", " "))
            source = None
            source_name = ""
            source_kind = ""
            errors = []
            if game_id in CUSTOM_URLS:
                source, source_kind = CUSTOM_URLS[game_id]
                source_name = source_kind
            for finder, kind in ((steam_cover, "Steam"), (wikimedia_cover, "Wikimedia"), (bing_image, "Bing Images")):
                if source:
                    break
                try:
                    result = finder(query)
                    if result:
                        source, source_name = result
                        source_kind = kind
                        break
                except Exception as exc:  # keep processing the remaining games
                    errors.append(f"{kind}: {exc}")
            target = OUT / filename
            if not source:
                report.append({"file": filename, "status": "FAILED", "query": query, "error": "; ".join(errors)})
                print(f"FAILED {filename} ({query})")
                continue
            raw = temp_dir / (filename + ".source")
            try:
                if source.startswith("local:"):
                    raw = OUT / source.removeprefix("local:")
                else:
                    download(source, raw)
                subprocess.run(
                    ["ffmpeg", "-y", "-i", str(raw), "-c:v", "libwebp", "-q:v", "80", "-compression_level", "6", str(target)],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                report.append({"file": filename, "status": "OK", "query": query, "source": source_kind, "matched": source_name, "url": source})
                print(f"OK {filename} <- {source_kind}: {source_name}")
            except Exception as exc:
                report.append({"file": filename, "status": "FAILED", "query": query, "source": source_kind, "error": str(exc)})
                print(f"FAILED {filename}: {exc}")
    # Keep a complete report, including files that were already present before
    # this run, so repeated retries do not hide earlier successful entries.
    by_file = {row["file"]: row for row in report}
    for filename in sorted(Path(path.lstrip("/")).name for path in covers):
        if filename not in by_file:
            by_file[filename] = {"file": filename, "status": "EXISTING", "source": "pre-existing"}
    report = [by_file[filename] for filename in sorted(by_file)]
    (ROOT / "cover-download-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if all(row["status"] in ("OK", "EXISTING") for row in report) else 1


if __name__ == "__main__":
    sys.exit(main())
