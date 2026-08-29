"""Small, source-preserving reader for public SEC EDGAR data.

This module deliberately collects filing records and structured SEC facts.  It
does not infer Bitcoin holdings, debt, or a trade recommendation from them;
those figures require a reviewable extraction step.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable
from urllib.request import Request, urlopen

SEC_DATA_BASE = "https://data.sec.gov"
SEC_ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data"
RELEVANT_FORMS = frozenset({"10-K", "10-Q", "8-K"})


@dataclass(frozen=True)
class Issuer:
    ticker: str
    name: str
    cik: str
    notes: str


# STRC is a Strategy preferred security, so it shares Strategy's issuer filings.
ISSUERS = (
    Issuer("MSTR", "Strategy Inc.", "0001050446", "Common stock"),
    Issuer("STRC", "Strategy Inc.", "0001050446", "Preferred security; same issuer as MSTR"),
    Issuer("ASST", "Strive, Inc.", "0001920406", "Formerly Asset Entities Inc."),
)


def filing_index_url(cik: str, accession_number: str) -> str:
    """Return the SEC filing-folder URL for an accession number."""
    return f"{SEC_ARCHIVES_BASE}/{int(cik)}/{accession_number.replace('-', '')}/"


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


class SecClient:
    """Respectful SEC client with an explicit, configurable User-Agent."""

    def __init__(
        self,
        user_agent: str | None = None,
        opener: Callable[..., Any] = urlopen,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        self.user_agent = user_agent or os.environ.get("SEC_USER_AGENT", "")
        if not self.user_agent.strip():
            raise ValueError("SEC_USER_AGENT is required for automated SEC access")
        self.opener = opener
        self.sleeper = sleeper

    def get_json(self, url: str) -> dict[str, Any]:
        request = Request(
            url,
            headers={
                "User-Agent": self.user_agent,
                "Accept-Encoding": "gzip, deflate",
                "Host": "data.sec.gov",
            },
        )
        with self.opener(request, timeout=30) as response:
            payload = response.read().decode("utf-8")
        # Stay well below the SEC's published automated-access ceiling.
        self.sleeper(0.2)
        return json.loads(payload)

    def submissions(self, issuer: Issuer) -> dict[str, Any]:
        return self.get_json(f"{SEC_DATA_BASE}/submissions/CIK{issuer.cik}.json")

    def company_facts(self, issuer: Issuer) -> dict[str, Any]:
        return self.get_json(f"{SEC_DATA_BASE}/api/xbrl/companyfacts/CIK{issuer.cik}.json")


def recent_filings(submissions: dict[str, Any], cik: str, limit: int = 25) -> list[dict[str, str]]:
    recent = submissions.get("filings", {}).get("recent", {})
    filings: list[dict[str, str]] = []
    for form, filed, accession, document, report_date in zip(
        recent.get("form", []),
        recent.get("filingDate", []),
        recent.get("accessionNumber", []),
        recent.get("primaryDocument", []),
        recent.get("reportDate", []),
    ):
        if form not in RELEVANT_FORMS:
            continue
        folder = filing_index_url(cik, accession)
        filings.append(
            {
                "form": form,
                "filed_at": filed,
                "report_date": report_date,
                "accession_number": accession,
                "filing_url": f"{folder}{document}" if document else folder,
                "filing_index_url": folder,
            }
        )
        if len(filings) >= limit:
            break
    return filings


def collect_issuer(client: SecClient, issuer: Issuer) -> dict[str, Any]:
    submissions = client.submissions(issuer)
    facts = client.company_facts(issuer)
    return {
        "issuer": {
            "ticker": issuer.ticker,
            "name": issuer.name,
            "cik": issuer.cik,
            "notes": issuer.notes,
        },
        "filings": recent_filings(submissions, issuer.cik),
        "source_urls": {
            "submissions": f"{SEC_DATA_BASE}/submissions/CIK{issuer.cik}.json",
            "company_facts": f"{SEC_DATA_BASE}/api/xbrl/companyfacts/CIK{issuer.cik}.json",
        },
        "raw": {"submissions": submissions, "company_facts": facts},
    }


def collect_foundation(client: SecClient) -> dict[str, Any]:
    """Collect raw SEC responses once per distinct issuer CIK."""
    by_cik: dict[str, dict[str, Any]] = {}
    for issuer in ISSUERS:
        if issuer.cik not in by_cik:
            by_cik[issuer.cik] = collect_issuer(client, issuer)

    issuers: list[dict[str, Any]] = []
    for issuer in ISSUERS:
        result = by_cik[issuer.cik]
        issuers.append(
            {
                "issuer": {"ticker": issuer.ticker, "name": issuer.name, "cik": issuer.cik, "notes": issuer.notes},
                "filings": result["filings"],
                "source_urls": result["source_urls"],
            }
        )
    return {
        "schema_version": 1,
        "collected_at": _now(),
        "source": "SEC EDGAR public data APIs",
        "issuers": issuers,
        "raw_by_cik": by_cik,
    }


def write_foundation(snapshot: dict[str, Any], destination: Path) -> None:
    """Write a human-readable manifest and the untouched raw SEC responses."""
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {key: value for key, value in snapshot.items() if key != "raw_by_cik"}
    (destination / "filing-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for cik, result in snapshot["raw_by_cik"].items():
        issuer_directory = destination / cik
        issuer_directory.mkdir(exist_ok=True)
        (issuer_directory / "submissions.json").write_text(json.dumps(result["raw"]["submissions"], indent=2) + "\n")
        (issuer_directory / "companyfacts.json").write_text(json.dumps(result["raw"]["company_facts"], indent=2) + "\n")
