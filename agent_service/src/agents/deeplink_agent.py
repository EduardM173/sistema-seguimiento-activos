"""
Deeplink Agent
==============
Specialized agent that turns a user's chat conversation into navigable links
into the SPA's UI.

It reads the navigation map exposed by the frontend (`/__deeplink/navigation-map.json`)
and uses an LLM to:
  1. Decide whether the assistant's reply could naturally include a link.
  2. Pick the best `(pageId, modalId?)` target(s) from the navigation map.
  3. Rewrite the reply inserting `[[link:<slug>]]` tokens.
  4. Emit a `slug -> { url, label, page_id, modal_id }` map.

The nav map is the single source of truth: the LLM is forced to choose only
URLs that the registry actually advertises, so we can't hallucinate routes.

Tokens
------
The agent emits tokens of the form ``[[link:<slug>]]``. The frontend
interpolates them into clickable anchors using the accompanying ``deeplinks``
map. ``<slug>`` is a short kebab-case id local to the message (e.g.
``crear-activo``), unrelated to the registry's page/modal ids.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlencode

import httpx
from llama_index.core.llms import LLM

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Result types
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class DeeplinkSuggestion:
    slug: str
    url: str
    label: str
    page_id: str
    modal_id: str | None = None
    params: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "url": self.url,
            "label": self.label,
            "page_id": self.page_id,
            "modal_id": self.modal_id,
            "params": self.params,
        }


@dataclass
class DeeplinkAnnotationResult:
    """Output of `DeeplinkAgent.annotate`."""

    text: str
    """Original assistant text with `[[link:<slug>]]` tokens woven in. If no
    deeplink applies, equal to the input text."""

    deeplinks: dict[str, DeeplinkSuggestion]
    """Map slug → suggestion. Empty when no deeplink is attached."""

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "deeplinks": {k: v.to_dict() for k, v in self.deeplinks.items()},
        }


# ─────────────────────────────────────────────────────────────────────────────
# Prompt
# ─────────────────────────────────────────────────────────────────────────────

_ANNOTATE_PROMPT = """You are the Deeplink Agent. Your only job is to enrich a chat reply with deep links into a Single Page Application.

You are given:
  1. The latest USER message.
  2. The ASSISTANT REPLY (already produced by another agent).
  3. The NAVIGATION MAP of the application as JSON (every page, modal, action that exists).

You must:
  A. Decide whether mentioning a navigable destination would help the user. Be conservative: only add links when the reply naturally talks about something the user can navigate to. If no link applies, return the assistant reply unchanged with no deeplinks.
  B. Pick at most 3 destinations strictly from the NAVIGATION MAP. NEVER invent paths or modal ids that are not in the map.
  C. For each chosen destination, build a stable kebab-case slug (e.g. "crear-activo", "ver-inventario"), pick a short user-facing label, and replace the most natural phrase in the reply with the token "[[link:<slug>]]".
  D. Keep the reply's wording, tone and language identical. Only insert tokens; do not add new sentences.

You MUST output ONLY raw JSON, with this exact shape:

{
  "text": "<reply with [[link:<slug>]] tokens>",
  "deeplinks": [
    {
      "slug": "<kebab-case-slug>",
      "page_id": "<id from navigation map>",
      "modal_id": "<id or null>",
      "params": { "<param>": "<value>" },
      "label": "<short human label>"
    }
  ]
}

If no deeplink applies, output exactly:
{ "text": <original assistant reply unchanged>, "deeplinks": [] }

USER MESSAGE:
{user_message}

ASSISTANT REPLY:
{assistant_reply}

NAVIGATION MAP (JSON):
{navigation_map}
"""


# ─────────────────────────────────────────────────────────────────────────────
# Agent
# ─────────────────────────────────────────────────────────────────────────────

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,40}$")
_TOKEN_RE = re.compile(r"\[\[link:([a-zA-Z0-9_-]+)\]\]")


class DeeplinkAgent:
    """Annotates chat replies with deeplinks pulled from the SPA navigation map.

    Parameters
    ----------
    llm : LLM
        Any LlamaIndex LLM. The agent uses ``acomplete`` only.
    nav_map_url : str
        Absolute URL of the frontend's navigation map endpoint, e.g.
        ``http://frontend:5173/__deeplink/navigation-map.json``.
    cache_ttl_s : int
        How long to cache the navigation map. Refreshed on demand.
    timeout_s : float
        HTTP timeout for fetching the navigation map.
    """

    def __init__(
        self,
        *,
        llm: LLM,
        nav_map_url: str,
        cache_ttl_s: int = 60,
        timeout_s: float = 5.0,
    ) -> None:
        self._llm = llm
        self._nav_map_url = nav_map_url
        self._cache_ttl_s = cache_ttl_s
        self._timeout_s = timeout_s

        self._cached_map: dict[str, Any] | None = None
        self._cached_at: float = 0.0
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ map
    async def get_navigation_map(self, *, force_refresh: bool = False) -> dict[str, Any]:
        """Return the navigation map JSON, fetching/refreshing as needed."""
        async with self._lock:
            now = time.monotonic()
            if (
                not force_refresh
                and self._cached_map is not None
                and (now - self._cached_at) < self._cache_ttl_s
            ):
                return self._cached_map

            try:
                async with httpx.AsyncClient(timeout=self._timeout_s) as client:
                    resp = await client.get(self._nav_map_url)
                    resp.raise_for_status()
                    data = resp.json()
            except Exception as e:
                logger.warning(
                    "DeeplinkAgent: failed to fetch nav map from %s: %s",
                    self._nav_map_url,
                    e,
                )
                # Fall back to whatever we had cached, even if stale.
                if self._cached_map is not None:
                    return self._cached_map
                # Empty map: agent will simply output no deeplinks.
                return {"pages": []}

            self._cached_map = data
            self._cached_at = now
            return data

    # ------------------------------------------------------------ annotate
    async def annotate(
        self,
        *,
        user_message: str,
        assistant_reply: str,
        permissions: list[str] | None = None,
    ) -> DeeplinkAnnotationResult:
        """Try to insert deeplinks into ``assistant_reply``.

        Returns the original reply unchanged with an empty deeplink map when
        no link applies, the LLM fails, or the navigation map is unavailable.
        """
        if not assistant_reply or not assistant_reply.strip():
            return DeeplinkAnnotationResult(text=assistant_reply, deeplinks={})

        nav_map = await self.get_navigation_map()
        scoped_map = self._scope_map(nav_map, permissions)
        if not scoped_map.get("pages"):
            return DeeplinkAnnotationResult(text=assistant_reply, deeplinks={})

        prompt = _ANNOTATE_PROMPT.format(
            user_message=user_message,
            assistant_reply=assistant_reply,
            navigation_map=json.dumps(scoped_map, ensure_ascii=False),
        )

        try:
            raw = (await self._llm.acomplete(prompt)).text.strip()
        except Exception as e:
            logger.warning("DeeplinkAgent: LLM call failed: %s", e)
            return DeeplinkAnnotationResult(text=assistant_reply, deeplinks={})

        parsed = self._parse_llm_json(raw)
        if parsed is None:
            return DeeplinkAnnotationResult(text=assistant_reply, deeplinks={})

        return self._build_result(
            llm_output=parsed,
            fallback_text=assistant_reply,
            nav_map=scoped_map,
        )

    # ----------------------------------------------------------- internals
    def _scope_map(
        self,
        nav_map: dict[str, Any],
        permissions: list[str] | None,
    ) -> dict[str, Any]:
        """Drop pages/modals the user can't access, plus heavy metadata the LLM
        doesn't need (proof traces, descriptions are kept; tags are kept).
        """
        if not permissions:
            return nav_map
        permset = set(permissions)

        def _ok(req: str | None) -> bool:
            return not req or req in permset

        pages = []
        for p in nav_map.get("pages", []):
            if not _ok(p.get("requiredPermission")):
                continue
            modals = [m for m in p.get("modals", []) if _ok(m.get("requiredPermission"))]
            pages.append({**p, "modals": modals})
        return {**nav_map, "pages": pages}

    def _parse_llm_json(self, raw: str) -> dict[str, Any] | None:
        text = raw.strip()
        # Strip code fences if the LLM wrapped them despite instructions.
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            logger.warning("DeeplinkAgent: LLM JSON decode failed: %s | raw=%r", e, raw[:300])
            return None
        if not isinstance(data, dict):
            return None
        return data

    def _build_result(
        self,
        *,
        llm_output: dict[str, Any],
        fallback_text: str,
        nav_map: dict[str, Any],
    ) -> DeeplinkAnnotationResult:
        text = llm_output.get("text")
        raw_links = llm_output.get("deeplinks", [])
        if not isinstance(text, str) or not isinstance(raw_links, list):
            return DeeplinkAnnotationResult(text=fallback_text, deeplinks={})

        # Index pages/modals by id for validation.
        pages_by_id = {p["id"]: p for p in nav_map.get("pages", []) if "id" in p}

        suggestions: dict[str, DeeplinkSuggestion] = {}
        for raw in raw_links:
            if not isinstance(raw, dict):
                continue
            slug = raw.get("slug")
            page_id = raw.get("page_id")
            if not isinstance(slug, str) or not _SLUG_RE.match(slug):
                continue
            if not isinstance(page_id, str) or page_id not in pages_by_id:
                continue
            page = pages_by_id[page_id]
            modal_id = raw.get("modal_id") or None
            if modal_id and not any(m.get("id") == modal_id for m in page.get("modals", [])):
                modal_id = None

            params = raw.get("params") or {}
            if not isinstance(params, dict):
                params = {}
            params = {str(k): v for k, v in params.items() if v is not None and v != ""}

            url = self._build_url(page=page, modal_id=modal_id, params=params)
            label = raw.get("label")
            if not isinstance(label, str) or not label.strip():
                label = page.get("title", page_id)

            suggestions[slug] = DeeplinkSuggestion(
                slug=slug,
                url=url,
                label=label.strip(),
                page_id=page_id,
                modal_id=modal_id,
                params=params,
            )

        # Drop tokens from the text whose slug we could not resolve, so the
        # frontend never sees an orphan `[[link:foo]]`.
        used_slugs = set(suggestions.keys())

        def _replace_orphan(match: re.Match[str]) -> str:
            return match.group(0) if match.group(1) in used_slugs else match.group(0).replace(
                f"[[link:{match.group(1)}]]", ""
            )

        cleaned_text = _TOKEN_RE.sub(_replace_orphan, text)

        # Keep only suggestions that actually appear in the text.
        present = {m.group(1) for m in _TOKEN_RE.finditer(cleaned_text)}
        suggestions = {k: v for k, v in suggestions.items() if k in present}
        if not suggestions:
            # No usable token survived → fall back to the original reply.
            return DeeplinkAnnotationResult(text=fallback_text, deeplinks={})

        return DeeplinkAnnotationResult(text=cleaned_text, deeplinks=suggestions)

    def _build_url(
        self,
        *,
        page: dict[str, Any],
        modal_id: str | None,
        params: dict[str, Any],
    ) -> str:
        """Build a URL for a (page, modal, params) target.

        Mirrors the small subset of `DeeplinkRegistry.buildUrl` that we need.
        """
        path: str = page.get("path", "/")
        path_keys: list[str] = re.findall(r":([A-Za-z_][A-Za-z0-9_]*)", path)

        def _fill(match: re.Match[str]) -> str:
            key = match.group(1)
            v = params.get(key)
            if v is None or v == "":
                return f":{key}"
            return str(v)

        pathname = re.sub(r":([A-Za-z_][A-Za-z0-9_]*)", _fill, path)

        query: dict[str, str] = {}
        if modal_id:
            query["modal"] = modal_id
        for k, v in params.items():
            if k in path_keys or v is None or v == "":
                continue
            if k == "modal":
                continue
            query[k] = str(v)
        if not query:
            return pathname
        return f"{pathname}?{urlencode(query)}"
