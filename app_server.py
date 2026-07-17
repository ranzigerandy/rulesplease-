import csv
import hashlib
import html
import ipaddress
import json
import os
import re
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "boardgames_ranks.csv"
DATA_DIR = ROOT / "data"
STATE_PATH = DATA_DIR / "state.json"
PDF_DIR = DATA_DIR / "pdfs"
COVER_DIR = DATA_DIR / "covers"
INDEX_DIR = DATA_DIR / "indexes"
DISCOVERY_LOG = DATA_DIR / "discovery.log"
MAX_PDF_BYTES = 95 * 1024 * 1024
MAX_THUMBNAIL_BYTES = 6 * 1024 * 1024
OPENAI_API_URL = "https://api.openai.com/v1"
EMBEDDING_MODEL = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
ANSWER_MODEL = os.environ.get("OPENAI_ANSWER_MODEL", "gpt-5.4-mini")
TOP_CONTEXT_CHUNKS = 6
DISCOVERY_TIMEOUT = 12

RULEBOOK_SOURCES = {
    822: {
        "url": "https://images.zmangames.com/filer_public/b7/df/b7df3dfa-d535-4473-b422-f4e5d4564c5f/carcassonne_rulesheet_en.pdf",
        "label": "Carcassonne base-game rulebook (Z-Man Games)",
        "confidence": "verified",
        "edition": "base game",
    },
    169786: {
        "url": "https://gamers-hq.de/media/pdf/bd/8a/7b/ScytheRulesCombined_V2_CS_r13-BW.pdf",
        "label": "Scythe complete rulebook PDF",
        "confidence": "medium",
    },
    266192: {
        "url": "https://www.ipswichlibrary.org/wp-content/uploads/2022/02/WS_Rulebook_r23-LR.pdf",
        "label": "Wingspan rulebook PDF",
        "confidence": "medium",
    },
    234900: {
        "url": "https://www.giochix.it/rules/frutticola%20ENG.pdf",
        "label": "Frutticola English rulebook PDF",
        "confidence": "medium-high",
    },
    406257: {
        "url": "https://www.goldenmeeple.be/wp-content/uploads/2024/07/Sumo-Rulebook.pdf",
        "label": "SUMO English rulebook PDF",
        "confidence": "medium-low",
    },
    447174: {
        "url": "https://gamers-hq.de/media/pdf/e8/11/fc/AWV_Rulebook_v9.pdf",
        "label": "A Wild Venture English rulebook PDF",
        "confidence": "medium",
    },
    415147: {
        "url": "https://gamers-hq.de/media/pdf/4b/aa/0e/Spectacular_Rules_Compressed.pdf",
        "label": "Spectacular base-game rulebook (Chilifox Games via Gamer's HQ)",
        "confidence": "verified",
        "edition": "base game",
    },
    154125: {
        "url": "https://www.exodusbooks.com/samples/games/57362sample.pdf",
        "label": "Pocket Battles: Confederacy vs Union rulebook (Z-Man Games sample)",
        "confidence": "verified",
        "edition": "base game",
    },
}

EDITION_MARKERS = (
    "winter edition",
    "anniversary edition",
    "20th anniversary",
    "big box",
    "junior",
    "travel edition",
    "hunters and gatherers",
    "the castle",
    "the city",
    "south seas",
    "amazonas",
    "mists over",
    "star wars",
    "safari",
)

OFFICIAL_RULEBOOK_HOSTS = (
    "asmodee.com",
    "hans-im-glueck.de",
    "images.zmangames.com",
    "zmangames.com",
)

# A title match alone is not enough for broad or reused game titles. These terms
# are strong evidence that a PDF belongs to a different kind of quiz or manual.
RULEBOOK_CONTENT_MISMATCHES = (
    "bible quiz",
    "quizmaster",
    "quiz officials",
    "pqa dress standards",
    "scripture memory",
)

BOARD_GAME_CONTENT_SIGNALS = (
    "components",
    "game board",
    "player board",
    "tiles",
    "cards",
    "dice",
    "setup",
    "round",
    "scoring",
    "victory points",
)

GAMES_BY_ID = {}
STATE_LOCK = threading.Lock()
THUMBNAIL_LOCK = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def ensure_dirs():
    DATA_DIR.mkdir(exist_ok=True)
    PDF_DIR.mkdir(exist_ok=True)
    COVER_DIR.mkdir(exist_ok=True)
    INDEX_DIR.mkdir(exist_ok=True)


def load_catalog():
    global GAMES_BY_ID
    games = {}
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                bgg_id = int(row["id"])
            except (KeyError, ValueError):
                continue
            games[bgg_id] = {
                "id": bgg_id,
                "name": row.get("name", ""),
                "year": int(float(row.get("yearpublished") or 0)),
                "rank": int(float(row.get("rank") or 0)),
                "average": float(row.get("average") or 0),
                "users": int(float(row.get("usersrated") or 0)),
                "expansion": row.get("is_expansion") == "1",
                "searchKey": normalize(row.get("name", "")),
            }
    GAMES_BY_ID = games


def normalize(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()


def unexpected_edition_markers(game, value):
    canonical = normalize(game.get("name"))
    evidence = normalize(value)
    return [
        marker
        for marker in EDITION_MARKERS
        if marker in evidence and marker not in canonical
    ]


def validate_rulebook_identity(game, candidate, pages):
    """Return a deterministic identity verdict before a PDF may be indexed."""
    first_pages = "\n".join(page.get("text", "") for page in pages[:3])[:18000]
    url_evidence = " ".join([candidate.get("url", ""), candidate.get("label", "")])
    mismatches = sorted(set(
        unexpected_edition_markers(game, url_evidence)
        + unexpected_edition_markers(game, first_pages)
    ))
    if mismatches:
        return {
            "approved": False,
            "reviewRequired": False,
            "edition": ", ".join(mismatches),
            "confidence": "rejected",
            "reason": f"Edition mismatch: found {', '.join(mismatches)}.",
        }

    canonical = normalize(game.get("name"))
    text = normalize(first_pages)
    url_text = normalize(url_evidence)
    content_mismatches = [
        marker for marker in RULEBOOK_CONTENT_MISMATCHES if marker in text
    ]
    if content_mismatches:
        return {
            "approved": False,
            "reviewRequired": False,
            "edition": candidate.get("edition", "base game"),
            "confidence": "rejected",
            "reason": f"Content mismatch: found {', '.join(content_mismatches)}.",
        }
    title_terms = [term for term in canonical.split() if len(term) > 2]
    exact_title = bool(canonical and re.search(rf"\b{re.escape(canonical)}\b", text))
    title_hits = sum(1 for term in title_terms if re.search(rf"\b{re.escape(term)}\b", text))
    all_title_terms = bool(title_terms and title_hits == len(title_terms))
    english_signals = sum(
        1
        for phrase in ("game", "player", "rules", "setup", "points", "turn")
        if re.search(rf"\b{phrase}\b", text)
    )
    board_game_signals = sum(
        1 for phrase in BOARD_GAME_CONTENT_SIGNALS if phrase in text
    )
    host = urllib.parse.urlparse(candidate.get("url", "")).netloc.lower()

    score = 0
    if exact_title:
        score += 55
    elif all_title_terms:
        score += 38
    if canonical and canonical in url_text:
        score += 15
    if any(host == official or host.endswith(f".{official}") for official in OFFICIAL_RULEBOOK_HOSTS):
        score += 15
    if candidate.get("confidence") == "verified":
        score += 15
    if english_signals >= 3:
        score += 10

    # One-word titles are prone to collisions. A discovered PDF must prove it
    # is a board-game manual, rather than merely containing the same title.
    generic_title_needs_context = len(title_terms) == 1 and candidate.get("confidence") != "verified"
    has_board_game_context = board_game_signals >= 2
    approved = score >= 65 and english_signals >= 2 and (
        not generic_title_needs_context or has_board_game_context
    )
    return {
        "approved": approved,
        "reviewRequired": not approved,
        "edition": candidate.get("edition", "base game"),
        "confidence": "verified" if score >= 85 else "high" if approved else "review_required",
        "reason": (
            "Title, edition, and language match the selected game."
            if approved
            else (
                "A generic game title needs clearer board-game evidence in the PDF."
                if generic_title_needs_context and not has_board_game_context
                else "The PDF title, edition, or language could not be verified with enough confidence."
            )
        ),
    }


def load_state():
    ensure_dirs()
    if not STATE_PATH.exists():
        return {"games": [], "messages": {}}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"games": [], "messages": {}}


def save_state(state):
    ensure_dirs()
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(STATE_PATH)


def update_game(bgg_id, **changes):
    with STATE_LOCK:
        state = load_state()
        for game in state["games"]:
            if game["id"] == bgg_id:
                game.update(changes)
                game["updatedAt"] = now_iso()
                save_state(state)
                return game
    return None


def score_game(game, query_terms, query):
    key = game["searchKey"]
    score = 0
    if key == query:
        score += 600
    if key.startswith(query):
        score += 300
    if query in key:
        score += 180
    for term in query_terms:
        score += 55 if term in key else -120
    if game["rank"]:
        score += max(0, 120 - game["rank"] / 80)
    score += min(80, len(str(game["users"])) * 12)
    score += -25 if game["expansion"] else 20
    return score


def search_catalog(query, base_only=True, limit=30):
    norm = normalize(query)
    if len(norm) < 2:
        return []
    terms = [term for term in norm.split(" ") if term]
    matches = []
    for game in GAMES_BY_ID.values():
        if base_only and game["expansion"]:
            continue
        score = score_game(game, terms, norm)
        if score > 0:
            item = dict(game)
            item["score"] = round(score, 2)
            item.pop("searchKey", None)
            matches.append(item)
    matches.sort(key=lambda item: (-item["score"], item["rank"] or 999999))
    return matches[:limit]


def request_text(url, timeout=DISCOVERY_TIMEOUT):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 BoardGameRulesWizardLocal/0.2",
            "Accept": "text/html,application/pdf;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read(1024 * 1024)
        content_type = response.headers.get("Content-Type", "")
    charset = "utf-8"
    match = re.search(r"charset=([^;\s]+)", content_type, re.I)
    if match:
        charset = match.group(1)
    return raw.decode(charset, errors="replace"), content_type


def log_discovery(message):
    try:
        ensure_dirs()
        with DISCOVERY_LOG.open("a", encoding="utf-8") as handle:
            handle.write(f"{now_iso()} {message}\n")
    except Exception:
        pass


def decode_search_url(url):
    url = html.unescape(url)
    parsed = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(parsed.query)
    if "uddg" in params:
        return params["uddg"][0]
    if url.startswith("//"):
        return "https:" + url
    return url


def discover_rulebook_candidates(game, progress=None):
    name = game["name"]
    year = game.get("year") or ""
    queries = [
        f'"{name}" board game rulebook pdf',
        f'"{name}" rules pdf board game',
        f'"{name}" {year} rulebook pdf' if year else f'"{name}" rulebook pdf',
    ]
    candidates = {}

    for query in queries:
        if progress:
            progress(28, f"Searching web for rulebook: {query}")
        search_url = "https://lite.duckduckgo.com/lite/?" + urllib.parse.urlencode({"q": query})
        try:
            body, _ = request_text(search_url)
            log_discovery(f"query={query!r} bytes={len(body)} pdf_hits={body.lower().count('.pdf')}")
            if ".pdf" not in body.lower() or "anomaly.js" in body.lower():
                jina_url = "https://r.jina.ai/http://r.jina.ai/http://" + search_url.replace("https://", "").replace("http://", "")
                body, _ = request_text(jina_url, timeout=30)
                log_discovery(f"query={query!r} jina_bytes={len(body)} jina_pdf_hits={body.lower().count('.pdf')}")
        except Exception:
            log_discovery(f"query={query!r} failed")
            continue

        urls = []
        for match in re.finditer(r'href=["\']([^"\']+)["\']', body, re.I):
            url = decode_search_url(match.group(1))
            if url.startswith("http"):
                urls.append(url)
        for match in re.finditer(r'https?://[^\s"\'<>]+', body, re.I):
            urls.append(decode_search_url(match.group(0)))

        for url in urls[:35]:
            if is_pdf_url(url):
                add_candidate(candidates, url, game)
                continue
            for pdf_url in extract_pdf_links(url, game)[:6]:
                add_candidate(candidates, pdf_url, game)

    ordered = sorted(candidates.values(), key=lambda item: item["score"], reverse=True)
    log_discovery(f"game={name!r} candidates={len(ordered)}")
    return ordered[:12]


def extract_pdf_links(page_url, game):
    parsed = urllib.parse.urlparse(page_url)
    if parsed.scheme not in {"http", "https"}:
        return []
    blocked = {"facebook.com", "youtube.com", "youtu.be", "reddit.com", "scribd.com"}
    if any(domain in parsed.netloc.lower() for domain in blocked):
        return []
    try:
        body, content_type = request_text(page_url)
    except Exception:
        return []
    if "pdf" in content_type.lower() or parsed.path.lower().endswith(".pdf"):
        return [page_url]

    links = []
    for match in re.finditer(r'href=["\']([^"\']+\.pdf(?:\?[^"\']*)?)["\']', body, re.I):
        links.append(urllib.parse.urljoin(page_url, html.unescape(match.group(1))))
    for match in re.finditer(r'https?://[^\s"\'<>]+\.pdf(?:\?[^\s"\'<>]+)?', body, re.I):
        links.append(html.unescape(match.group(0)))
    return dedupe(links)


def is_pdf_url(url):
    return ".pdf" in urllib.parse.urlparse(url).path.lower()


def dedupe(items):
    seen = set()
    result = []
    for item in items:
        item = item.strip().rstrip(").,;")
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result


def add_candidate(candidates, url, game):
    url = url.strip().rstrip(").,;")
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return
    if not is_pdf_url(url):
        return
    host = parsed.netloc.lower()
    if any(blocked in host for blocked in ["facebook.com", "youtube.com", "youtu.be", "reddit.com", "scribd.com"]):
        return
    if unexpected_edition_markers(game, url):
        return
    key = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", parsed.query, ""))
    score = score_rulebook_candidate(key, game)
    if score <= 0:
        return
    current = candidates.get(key)
    if not current or score > current["score"]:
        candidates[key] = {
            "url": key,
            "label": f"{game['name']} discovered rulebook PDF",
            "confidence": "auto",
            "score": score,
        }


def score_rulebook_candidate(url, game):
    parsed = urllib.parse.urlparse(url)
    text = normalize(urllib.parse.unquote(url))
    path = parsed.path.lower()
    score = 0
    if unexpected_edition_markers(game, url):
        return -100
    if path.endswith(".pdf") or ".pdf" in path:
        score += 45
    if any(word in text for word in ["rulebook", "rules", "manual", "learn to play"]):
        score += 30
    game_terms = [term for term in normalize(game["name"]).split() if len(term) > 2]
    if game_terms:
        hits = sum(1 for term in game_terms if term in text)
        score += hits * 18
        if hits == len(game_terms):
            score += 35
    if game.get("year") and str(game["year"]) in text:
        score += 8
    if any(bad in text for bad in ["expansion", "promo", "solo", "landmarks", "rolling", "mini"]) and "solo" not in normalize(game["name"]):
        score -= 18
    if any(good in text for good in ["basegame", "base game", "official", "english"]):
        score += 10
    return score


def safe_file_stem(value):
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', " ", str(value or ""))
    stem = re.sub(r"\s+", " ", stem).strip(" .")
    return stem[:120] or "Untitled game"


def rules_pdf_path(game):
    return PDF_DIR / f"{safe_file_stem(game.get('name'))} rules.pdf"


def move_pdf_to_rules_name(game):
    current_path = game.get("pdfPath")
    if not current_path:
        return None
    current = Path(current_path)
    target = rules_pdf_path(game)
    if not current.exists() or current == target:
        return current if current.exists() else None
    if target.exists() and target.stat().st_size > 0:
        return target
    current.replace(target)
    return target


def cover_path(bgg_id):
    return COVER_DIR / f"{int(bgg_id)}.jpg"


def fetch_game_thumbnail(bgg_id):
    bgg_id = int(bgg_id)
    target = cover_path(bgg_id)
    if target.exists() and target.stat().st_size > 0:
        return target

    with THUMBNAIL_LOCK:
        if target.exists() and target.stat().st_size > 0:
            return target
        if bgg_id not in GAMES_BY_ID:
            return None
        api_url = "https://api.geekdo.com/api/geekitems?" + urllib.parse.urlencode({"objectid": bgg_id, "objecttype": "thing"})
        request = urllib.request.Request(
            api_url,
            headers={"User-Agent": "BoardGameRulesWizardLocal/0.3", "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read(2 * 1024 * 1024).decode("utf-8"))
        item = payload.get("item") or {}
        images = item.get("images") or {}
        thumbnail_url = (images.get("tallthumb") or images.get("thumb") or item.get("imageurl") or "").strip()
        if not thumbnail_url:
            return None

        image_request = urllib.request.Request(
            thumbnail_url,
            headers={"User-Agent": "BoardGameRulesWizardLocal/0.3", "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"},
        )
        with urllib.request.urlopen(image_request, timeout=20) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            if not content_type.startswith("image/"):
                raise ValueError(f"BGG thumbnail is not an image: {content_type}")
            image_bytes = response.read(MAX_THUMBNAIL_BYTES + 1)
        if len(image_bytes) > MAX_THUMBNAIL_BYTES:
            raise ValueError("BGG thumbnail is above the local cache limit.")
        temp = target.with_suffix(".tmp")
        temp.write_bytes(image_bytes)
        temp.replace(target)
        return target


def validate_public_pdf_url(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Imported PDF URLs must use public HTTPS addresses.")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise ValueError("The imported PDF hostname could not be resolved.") from exc
    if not addresses:
        raise ValueError("The imported PDF hostname could not be resolved.")
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("Imported PDF URLs may not access private or local networks.")
    return url


class PublicHttpsRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_public_pdf_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download_pdf(source, game, progress=None, force=False, require_public_https=False):
    url = source["url"]
    target = rules_pdf_path(game)
    if force:
        target.unlink(missing_ok=True)
    if target.exists() and target.stat().st_size > 0:
        return target

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "BoardGameRulesWizardLocal/0.1"},
    )
    if require_public_https:
        validate_public_pdf_url(url)
        response_context = urllib.request.build_opener(PublicHttpsRedirectHandler()).open(request, timeout=30)
    else:
        response_context = urllib.request.urlopen(request, timeout=30)
    with response_context as response:
        # Some hosts serve downloadable PDFs as application/octet-stream (and a
        # few incorrectly label them as HTML). Trust the file signature as well
        # as the header, but never write a non-PDF response to the local cache.
        content_type = response.headers.get("Content-Type", "")
        first_chunk = response.read(4096)
        is_pdf = "pdf" in content_type.lower() or first_chunk.lstrip().startswith(b"%PDF-")
        if not is_pdf:
            fallback_urls = [
                candidate for candidate in extract_pdf_links(url, game)
                if candidate != url
            ]
            if fallback_urls:
                # A pasted URL can be a publisher download page or viewer. Keep
                # the same public-HTTPS / redirect checks for the discovered
                # direct PDF and retain that final URL for preview links.
                source["url"] = fallback_urls[0]
                return download_pdf(
                    source, game, progress=progress, force=False, require_public_https=require_public_https,
                )
            if require_public_https:
                raise ValueError(
                    "The imported link opened a web page, not a PDF, and no downloadable PDF was found on that page. "
                    "Paste the direct PDF download link or upload the PDF file."
                )
            raise ValueError(f"Source is not a PDF response: {content_type}")
        expected = int(response.headers.get("Content-Length") or 0)
        total = len(first_chunk)
        temp = target.with_suffix(".part")
        with temp.open("wb") as handle:
            if total > MAX_PDF_BYTES:
                temp.unlink(missing_ok=True)
                raise ValueError("PDF is above the local MVP max size.")
            handle.write(first_chunk)
            while True:
                chunk = response.read(1024 * 256)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_PDF_BYTES:
                    handle.close()
                    temp.unlink(missing_ok=True)
                    raise ValueError("PDF is above the local MVP max size.")
                handle.write(chunk)
                if progress and expected:
                    percent = min(58, 35 + int((total / expected) * 23))
                    progress(percent, f"Downloading rulebook ({total // 1024} KB).")
        temp.replace(target)
    return target


def extract_pages(pdf_path, progress=None):
    pages = []
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(pdf_path))
        total_pages = len(reader.pages)
        for index, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            pages.append({"page": index, "text": clean_text(text)})
            if progress and (index == 1 or index == total_pages or index % 5 == 0):
                percent = min(88, 62 + int((index / max(total_pages, 1)) * 26))
                progress(percent, f"Extracting page {index} of {total_pages}.")
    except Exception:
        pages = []

    if not any(page["text"] for page in pages):
        try:
            import pdfplumber

            pages = []
            with pdfplumber.open(str(pdf_path)) as pdf:
                total_pages = len(pdf.pages)
                for index, page in enumerate(pdf.pages, start=1):
                    text = page.extract_text() or ""
                    pages.append({"page": index, "text": clean_text(text)})
                    if progress and (index == 1 or index == total_pages or index % 5 == 0):
                        percent = min(88, 62 + int((index / max(total_pages, 1)) * 26))
                        progress(percent, f"Extracting page {index} of {total_pages}.")
        except Exception as exc:
            raise ValueError(f"Could not extract PDF text: {exc}") from exc

    chars = sum(len(page["text"]) for page in pages)
    if chars < 500:
        raise ValueError("Rulebook text extraction produced too little text. OCR/manual review is required.")
    return pages


def clean_text(text):
    return re.sub(r"\s+", " ", text).strip()


def chunk_pages(pages, source):
    chunks = []
    for page in pages:
        text = page["text"]
        if not text:
            continue
        sentences = re.split(r"(?<=[.!?])\s+", text)
        current = []
        current_len = 0
        for sentence in sentences:
            if current_len + len(sentence) > 900 and current:
                chunks.append(make_chunk(page["page"], " ".join(current), source))
                current = []
                current_len = 0
            current.append(sentence)
            current_len += len(sentence)
        if current:
            chunks.append(make_chunk(page["page"], " ".join(current), source))
    return chunks


def make_chunk(page, text, source):
    return {
        "page": page,
        "text": text[:1400],
        "sourceUrl": source["url"],
        "sourceLabel": source["label"],
    }


def openai_key():
    return os.environ.get("OPENAI_API_KEY", "").strip()


def openai_json(path, payload, timeout=90):
    key = openai_key()
    if not key:
        raise ValueError("OPENAI_API_KEY is not configured.")
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{OPENAI_API_URL}{path}",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"OpenAI API error {exc.code}: {detail[:500]}") from exc


def embed_texts(texts, progress=None):
    if not texts:
        return []
    embeddings = []
    batch_size = 64
    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        result = openai_json(
            "/embeddings",
            {"model": EMBEDDING_MODEL, "input": batch},
            timeout=120,
        )
        ordered = sorted(result.get("data", []), key=lambda item: item.get("index", 0))
        embeddings.extend(item["embedding"] for item in ordered)
        if progress:
            done = min(start + batch_size, len(texts))
            progress(done, len(texts))
    return embeddings


def add_embeddings_to_chunks(chunks, progress=None):
    texts = [chunk["text"] for chunk in chunks]

    def batch_progress(done, total):
        if progress:
            percent = min(98, 92 + int((done / max(total, 1)) * 6))
            progress(percent, f"Creating AI embeddings ({done}/{total} chunks).")

    embeddings = embed_texts(texts, progress=batch_progress)
    for chunk, embedding in zip(chunks, embeddings):
        chunk["embedding"] = embedding
    return chunks


def ensure_embeddings(index, bgg_id=None):
    chunks = index.get("chunks", [])
    missing = [chunk for chunk in chunks if "embedding" not in chunk]
    if not missing:
        return False
    if not openai_key():
        return False
    embeddings = embed_texts([chunk["text"] for chunk in missing])
    for chunk, embedding in zip(missing, embeddings):
        chunk["embedding"] = embedding
    if bgg_id:
        (INDEX_DIR / f"{bgg_id}.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    return True


def cosine_similarity(left, right):
    if not left or not right:
        return 0.0
    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for a, b in zip(left, right):
        dot += a * b
        left_norm += a * a
        right_norm += b * b
    if not left_norm or not right_norm:
        return 0.0
    return dot / ((left_norm ** 0.5) * (right_norm ** 0.5))


def keyword_score(question, chunk_text):
    terms = expanded_terms(question)
    text_key = normalize(chunk_text)
    question_key = normalize(question)
    score = 0.0
    for term in terms:
        if term in text_key:
            score += 0.02
            score += min(0.08, text_key.count(term) * 0.01)
    score += phrase_boost(question_key, text_key) / 1000
    return score


def retrieve_context(index, question):
    chunks = index.get("chunks", [])
    if not chunks:
        return []

    query_embedding = None
    if openai_key() and any("embedding" in chunk for chunk in chunks):
        query_embedding = embed_texts([question])[0]

    scored = []
    for chunk in chunks:
        vector_score = cosine_similarity(query_embedding, chunk.get("embedding")) if query_embedding else 0.0
        score = vector_score + keyword_score(question, chunk["text"])
        if score > 0:
            item = dict(chunk)
            item.pop("embedding", None)
            item["score"] = round(score, 5)
            item["vectorScore"] = round(vector_score, 5)
            scored.append(item)

    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:TOP_CONTEXT_CHUNKS]


def fallback_retrieve_context(index, question):
    terms = expanded_terms(question)
    if not terms:
        return []
    question_key = normalize(question)
    scored = []
    for chunk in index.get("chunks", []):
        text_key = normalize(chunk["text"])
        score = 0
        for term in terms:
            score += text_key.count(term) * 4
            if term in text_key:
                score += 3
        score += phrase_boost(question_key, text_key)
        if score:
            item = dict(chunk)
            item.pop("embedding", None)
            item["score"] = score
            scored.append(item)
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:4]


def process_rulebook_async(bgg_id):
    def run():
        def progress(percent, message):
            update_game(
                bgg_id,
                status="processing_rulebook",
                statusLabel="Processing rulebook",
                statusMessage=message,
                progress=percent,
            )

        try:
            update_game(
                bgg_id,
                status="searching_rulebook",
                statusLabel="Searching rulebook",
                statusMessage="Looking for a matching English rulebook source.",
                progress=20,
            )
            time.sleep(0.5)
            game = GAMES_BY_ID.get(bgg_id, {"id": bgg_id, "name": f"BGG {bgg_id}"})
            known_source = RULEBOOK_SOURCES.get(bgg_id)
            if known_source:
                sources = [known_source]
            else:
                update_game(
                    bgg_id,
                    status="searching_rulebook",
                    statusLabel="Searching rulebook",
                    statusMessage="No known source yet. Searching the web for rulebook PDFs.",
                    progress=25,
                )
                sources = discover_rulebook_candidates(game, progress=progress)
                if not sources:
                    update_game(
                        bgg_id,
                        status="rulebook_not_found",
                        statusLabel="Rulebook not found",
                        statusMessage="Automatic web discovery could not find a usable rulebook PDF yet.",
                        progress=100,
                    )
                    return

            source = None
            pdf_path = None
            pages = None
            chunks = None
            last_error = None
            for candidate in sources:
                try:
                    update_game(
                        bgg_id,
                        status="downloading_rulebook",
                        statusLabel="Downloading rulebook",
                        statusMessage=f"Trying rulebook source: {candidate['url']}",
                        sourceUrl=candidate["url"],
                        sourceConfidence=candidate.get("confidence", "auto"),
                        progress=45,
                    )
                    pdf_path = download_pdf(candidate, game, progress=progress)
                    update_game(
                        bgg_id,
                        status="processing_rulebook",
                        statusLabel="Processing rulebook",
                        statusMessage="Checking whether the PDF contains extractable text.",
                        progress=70,
                    )
                    pages = extract_pages(pdf_path, progress=progress)
                    progress(92, "Building searchable rulebook chunks.")
                    chunks = chunk_pages(pages, candidate)
                    if not chunks:
                        raise ValueError("No searchable chunks were produced.")
                    source = candidate
                    break
                except Exception as exc:
                    last_error = exc
                    log_discovery(f"candidate rejected game={game['name']!r} url={candidate['url']} error={exc}")
                    pdf_path = None
                    pages = None
                    chunks = None
                    update_game(
                        bgg_id,
                        status="searching_rulebook",
                        statusLabel="Searching rulebook",
                        statusMessage="Rejected an unreadable PDF. Trying another rulebook source.",
                        progress=35,
                    )
                    continue
            if not source or not pdf_path or not pages or not chunks:
                update_game(
                    bgg_id,
                    status="rulebook_not_found",
                    statusLabel="Rulebook not found",
                    statusMessage=f"Found candidates, but none had enough extractable text. Last error: {last_error}",
                    progress=100,
                )
                return
            if openai_key():
                chunks = add_embeddings_to_chunks(chunks, progress=progress)

            index_path = INDEX_DIR / f"{bgg_id}.json"
            index_path.write_text(
                json.dumps({"pages": pages, "chunks": chunks}, indent=2),
                encoding="utf-8",
            )
            update_game(
                bgg_id,
                status="ready",
                statusLabel="Ready",
                statusMessage="Rulebook is indexed. You can ask questions.",
                progress=100,
                pageCount=len(pages),
                chunkCount=len(chunks),
                aiSearch="embeddings" if chunks and "embedding" in chunks[0] else "keyword",
                extractedChars=sum(len(page["text"]) for page in pages),
                pdfPath=str(pdf_path),
                pdfUrl=f"/data/pdfs/{pdf_path.name}",
            )
        except (urllib.error.URLError, ValueError, OSError) as exc:
            update_game(
                bgg_id,
                status="rulebook_not_found",
                statusLabel="Rulebook not found",
                statusMessage=str(exc),
                progress=100,
            )

    threading.Thread(target=run, daemon=True).start()


def add_game(bgg_id):
    game = GAMES_BY_ID.get(bgg_id)
    if not game:
        raise ValueError("Unknown BGG id in local catalog.")
    with STATE_LOCK:
        state = load_state()
        existing = next((item for item in state["games"] if item["id"] == bgg_id), None)
        if existing:
            return existing, False
        record = {
            "id": game["id"],
            "name": game["name"],
            "year": game["year"],
            "rank": game["rank"],
            "average": game["average"],
            "users": game["users"],
            "expansion": game["expansion"],
            "status": "queued",
            "statusLabel": "Queued",
            "statusMessage": "Rulebook discovery is queued.",
            "progress": 5,
            "addedAt": now_iso(),
            "updatedAt": now_iso(),
        }
        state["games"].append(record)
        state["messages"][str(bgg_id)] = []
        save_state(state)
    process_rulebook_async(bgg_id)
    return record, True


def remove_game(bgg_id):
    with STATE_LOCK:
        state = load_state()
        state["games"] = [game for game in state["games"] if game["id"] != bgg_id]
        state.get("messages", {}).pop(str(bgg_id), None)
        save_state(state)
    (INDEX_DIR / f"{bgg_id}.json").unlink(missing_ok=True)


def resume_known_sources():
    state = load_state()
    for game in state.get("games", []):
        bgg_id = game.get("id")
        index_path = INDEX_DIR / f"{bgg_id}.json"
        if game.get("status") == "ready" and index_path.exists():
            continue
        if game.get("status") in {"queued", "searching_rulebook", "downloading_rulebook", "processing_rulebook", "review_required", "rulebook_not_found"}:
            update_game(
                bgg_id,
                status="queued",
                statusLabel="Queued",
                statusMessage="Rulebook discovery will start now.",
                progress=5,
            )
            process_rulebook_async(bgg_id)


def migrate_state():
    state = load_state()
    changed = False
    for game in state.get("games", []):
        renamed_path = move_pdf_to_rules_name(game)
        if renamed_path:
            renamed_path_string = str(renamed_path)
            renamed_url = f"/data/pdfs/{renamed_path.name}"
            if game.get("pdfPath") != renamed_path_string or game.get("pdfUrl") != renamed_url:
                game["pdfPath"] = renamed_path_string
                game["pdfUrl"] = renamed_url
                changed = True
        pdf_path = game.get("pdfPath")
        if pdf_path and not game.get("pdfUrl"):
            name = Path(pdf_path).name
            if name:
                game["pdfUrl"] = f"/data/pdfs/{name}"
                changed = True
        if game.get("status") == "review_required" and game.get("id") not in RULEBOOK_SOURCES:
            game["status"] = "rulebook_not_found"
            game["statusLabel"] = "Rulebook not found"
            changed = True
    if changed:
        save_state(state)


def tokenize(value):
    stop = {
        "a", "an", "and", "are", "as", "at", "be", "can", "do", "does", "for", "from",
        "how", "i", "if", "in", "is", "it", "may", "of", "on", "or", "the", "to",
        "what", "when", "where", "who", "with", "you", "your",
        "work", "works",
        "de", "het", "een", "en", "of", "voor", "van", "met", "hoe", "wat", "waar",
        "wanneer", "waarom", "mag", "moet", "kan", "ik", "je", "jij", "spel",
    }
    return [term for term in normalize(value).split() if len(term) > 2 and term not in stop]


def expanded_terms(question):
    terms = set(tokenize(question))
    if terms & {"win", "wins", "winner", "winning", "victory"}:
        terms.update({"win", "wins", "winner", "winning", "victory", "score", "final", "highest"})
    if terms & {"combat", "battle", "fight"}:
        terms.update({"combat", "battle", "attacker", "defender", "power", "cards"})
    return terms


def ask_rulebook(bgg_id, question):
    index_path = INDEX_DIR / f"{bgg_id}.json"
    if not index_path.exists():
        raise ValueError("This game does not have a searchable rulebook yet.")
    index = json.loads(index_path.read_text(encoding="utf-8"))
    if not question.strip():
        raise ValueError("Ask a more specific rules question.")
    ensure_embeddings(index, bgg_id=bgg_id)
    top = retrieve_context(index, question)
    if not top:
        top = fallback_retrieve_context(index, question)

    if not top:
        answer = "I could not find enough support for that in the indexed rulebook."
        citations = []
    else:
        answer = generate_grounded_answer(question, top)
        citations = build_citations(select_useful_chunks(top, answer))

    save_chat_turn(bgg_id, question, answer, citations)
    return {"answer": answer, "citations": citations}


def save_chat_turn(bgg_id, question, answer, citations):
    with STATE_LOCK:
        state = load_state()
        messages = state.setdefault("messages", {}).setdefault(str(bgg_id), [])
        messages.append({"role": "user", "text": question, "createdAt": now_iso()})
        messages.append({"role": "assistant", "text": answer, "citations": citations, "createdAt": now_iso()})
        save_state(state)


def build_citations(chunks):
    return [
        {
            "page": chunk["page"],
            "quote": trim_quote(chunk["text"]),
            "sourceUrl": chunk["sourceUrl"],
            "sourceLabel": chunk["sourceLabel"],
            "score": chunk.get("score"),
            "vectorScore": chunk.get("vectorScore"),
        }
        for chunk in chunks
    ]


def select_useful_chunks(chunks, answer):
    if not chunks:
        return []

    cited_pages = set()
    for match in re.finditer(r"\bpages?\s+([0-9][0-9,\s\-–and]*)", answer, re.I):
        cited_pages.update(int(value) for value in re.findall(r"\d+", match.group(1)))

    selected = []
    seen_pages = set()
    if cited_pages:
        for chunk in chunks:
            page = chunk.get("page")
            if page in cited_pages and page not in seen_pages:
                selected.append(chunk)
                seen_pages.add(page)
        if selected:
            return selected

    best_score = chunks[0].get("score") or 0
    for chunk in chunks:
        score = chunk.get("score") or 0
        if len(selected) >= 3:
            break
        if not selected or score >= best_score * 0.82:
            selected.append(chunk)
    return selected or chunks[:1]


def context_prompt(chunks):
    parts = []
    for index, chunk in enumerate(chunks, start=1):
        parts.append(
            f"[{index}] Page {chunk['page']} | {chunk.get('sourceLabel', 'Rulebook')}\n"
            f"{chunk['text']}"
        )
    return "\n\n".join(parts)


def answer_instructions(question):
    language = "Dutch" if looks_dutch(question) else "English"
    return (
        "You are a board game rules assistant. Answer only from the provided rulebook passages. "
        "Do not use outside knowledge. If the passages do not support an answer, say that the rulebook passages do not contain enough information. "
        "Be concise, practical, and mention page numbers inline like (page 14). "
        f"Answer in {language}."
    )


def generate_grounded_answer(question, chunks):
    if not openai_key():
        return build_answer(question, chunks)
    payload = {
        "model": ANSWER_MODEL,
        "instructions": answer_instructions(question),
        "input": (
            f"Question:\n{question}\n\n"
            f"Rulebook passages:\n{context_prompt(chunks)}"
        ),
        "store": False,
        "max_output_tokens": 550,
    }
    result = openai_json("/responses", payload, timeout=120)
    text = result.get("output_text")
    if text:
        return text.strip()
    output = result.get("output", [])
    parts = []
    for item in output:
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"}:
                parts.append(content.get("text", ""))
    return clean_text(" ".join(parts)) or build_answer(question, chunks)


def stream_grounded_answer(question, chunks, on_delta):
    if not openai_key():
        answer = build_answer(question, chunks)
        for start in range(0, len(answer), 18):
            on_delta(answer[start:start + 18])
            time.sleep(0.02)
        return answer

    payload = {
        "model": ANSWER_MODEL,
        "instructions": answer_instructions(question),
        "input": (
            f"Question:\n{question}\n\n"
            f"Rulebook passages:\n{context_prompt(chunks)}"
        ),
        "store": False,
        "max_output_tokens": 550,
        "stream": True,
    }
    return stream_openai_response(payload, on_delta)


def stream_openai_response(payload, on_delta):
    key = openai_key()
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{OPENAI_API_URL}/responses",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        },
    )
    answer_parts = []
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            event_name = None
            for raw in response:
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    event_name = None
                    continue
                if line.startswith("event:"):
                    event_name = line[6:].strip()
                    continue
                if not line.startswith("data:"):
                    continue
                data_text = line[5:].strip()
                if data_text == "[DONE]":
                    break
                event = json.loads(data_text)
                event_type = event.get("type") or event_name
                if event_type == "response.output_text.delta":
                    delta = event.get("delta", "")
                    if delta:
                        answer_parts.append(delta)
                        on_delta(delta)
                elif event_type == "error":
                    raise ValueError(event.get("message", "OpenAI streaming error"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"OpenAI API error {exc.code}: {detail[:500]}") from exc
    return "".join(answer_parts).strip()


def phrase_boost(question_key, text_key):
    score = 0
    win_intent = any(term in question_key.split() for term in ["win", "wins", "winner"]) or "win ik" in question_key
    combat_intent = "combat" in question_key or "battle" in question_key or "fight" in question_key

    if win_intent:
        for phrase in ["wins the game", "highest final score", "final score wins", "player with the highest"]:
            if phrase in text_key:
                score += 120
        if "example" in text_key:
            score -= 35

    if combat_intent:
        for phrase in ["highest total power wins", "power dials", "selected combat cards", "ties go to the attacking player"]:
            if phrase in text_key:
                score += 95
        if any(term in text_key for term in ["automa", "spoiler", "mad tesla", "desolation", "airship"]):
            score -= 80

    return score


def build_answer(question, chunks):
    terms = expanded_terms(question)
    selected = []
    for chunk in chunks:
        sentences = re.split(r"(?<=[.!?])\s+", chunk["text"])
        for sentence in sentences:
            key = normalize(sentence)
            if any(term in key for term in terms):
                selected.append(clean_text(sentence))
            if len(selected) >= 3:
                break
        if len(selected) >= 3:
            break

    if not selected:
        selected = [trim_quote(chunks[0]["text"])]

    prefix = "Volgens de spelregels: " if looks_dutch(question) else "According to the rulebook: "
    answer = prefix + " ".join(selected)
    if len(answer) > 950:
        answer = answer[:950].rsplit(" ", 1)[0] + "..."
    return answer


def looks_dutch(question):
    dutch_terms = {"hoe", "wat", "waar", "wanneer", "waarom", "mag", "moet", "kan", "ik", "je", "jij", "het", "de", "een", "spel", "win"}
    words = set(normalize(question).split())
    return len(words & dutch_terms) >= 2


def trim_quote(text):
    text = clean_text(text)
    if len(text) <= 520:
        return text
    return text[:520].rsplit(" ", 1)[0] + "..."


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        thumbnail_match = re.fullmatch(r"/api/games/(\d+)/thumbnail", parsed.path)
        if thumbnail_match:
            try:
                thumbnail = fetch_game_thumbnail(int(thumbnail_match.group(1)))
                if not thumbnail:
                    self.send_response(204)
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(thumbnail.stat().st_size))
                self.send_header("Cache-Control", "public, max-age=2592000")
                self.end_headers()
                with thumbnail.open("rb") as handle:
                    self.wfile.write(handle.read())
            except (OSError, urllib.error.URLError, urllib.error.HTTPError, ValueError, json.JSONDecodeError) as exc:
                log_discovery(f"thumbnail failed bgg_id={thumbnail_match.group(1)} error={exc}")
                self.send_response(204)
                self.end_headers()
            return
        if parsed.path == "/api/search":
            params = urllib.parse.parse_qs(parsed.query)
            query = params.get("q", [""])[0]
            base_only = params.get("baseOnly", ["true"])[0] != "false"
            self.send_json({"results": search_catalog(query, base_only=base_only)})
            return
        if parsed.path == "/api/my-games":
            self.send_json(load_state())
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/my-games":
            body = self.read_json()
            try:
                record, created = add_game(int(body.get("id")))
                self.send_json({"game": record, "created": created}, status=201 if created else 200)
            except (TypeError, ValueError) as exc:
                self.send_json({"error": str(exc)}, status=400)
            return
        stream_match = re.fullmatch(r"/api/games/(\d+)/ask-stream", parsed.path)
        if stream_match:
            self.handle_ask_stream(int(stream_match.group(1)))
            return
        ask_match = re.fullmatch(r"/api/games/(\d+)/ask", parsed.path)
        if ask_match:
            body = self.read_json()
            try:
                result = ask_rulebook(int(ask_match.group(1)), body.get("question", ""))
                self.send_json(result)
            except ValueError as exc:
                self.send_json({"error": str(exc)}, status=409)
            return
        self.send_json({"error": "Not found"}, status=404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        match = re.fullmatch(r"/api/my-games/(\d+)", parsed.path)
        if match:
            remove_game(int(match.group(1)))
            self.send_json({"ok": True})
            return
        self.send_json({"error": "Not found"}, status=404)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def handle_ask_stream(self, bgg_id):
        body = self.read_json()
        question = body.get("question", "").strip()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

        def emit(event, payload):
            data = json.dumps(payload).replace("\n", "\\n")
            self.wfile.write(f"event: {event}\ndata: {data}\n\n".encode("utf-8"))
            self.wfile.flush()

        try:
            if not question:
                raise ValueError("Ask a more specific rules question.")
            index_path = INDEX_DIR / f"{bgg_id}.json"
            if not index_path.exists():
                raise ValueError("This game does not have a searchable rulebook yet.")
            index = json.loads(index_path.read_text(encoding="utf-8"))

            emit("status", {"text": "Checking AI embeddings"})
            created = ensure_embeddings(index, bgg_id=bgg_id)
            if created:
                update_game(bgg_id, aiSearch="embeddings")

            emit("status", {"text": "Searching semantically similar passages"})
            top = retrieve_context(index, question)
            if not top:
                top = fallback_retrieve_context(index, question)
            if not top:
                answer = "I could not find enough support for that in the indexed rulebook."
                citations = []
                emit("delta", {"text": answer})
                emit("sources", {"citations": citations})
                save_chat_turn(bgg_id, question, answer, citations)
                emit("done", {"answer": answer, "citations": citations})
                return

            emit("status", {"text": "Asking AI with relevant rulebook context"})

            parts = []

            def on_delta(delta):
                parts.append(delta)
                emit("delta", {"text": delta})

            answer = stream_grounded_answer(question, top, on_delta)
            if not answer:
                answer = "".join(parts).strip()
            citations = build_citations(select_useful_chunks(top, answer))
            emit("sources", {"citations": citations})
            save_chat_turn(bgg_id, question, answer, citations)
            emit("done", {"answer": answer, "citations": citations})
        except Exception as exc:
            emit("error", {"message": str(exc)})
        finally:
            self.close_connection = True

    def send_json(self, payload, status=200):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")


def main():
    ensure_dirs()
    load_catalog()
    migrate_state()
    resume_known_sources()
    port = int(os.environ.get("PORT", "4173"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Rules Please! local server")
    print(f"Serving: {ROOT}")
    print(f"URL: http://localhost:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
