import json

import pytest

from brae.sec_edgar import ISSUERS, SecClient, collect_foundation, filing_index_url, recent_filings, write_foundation


def test_filing_index_url_removes_accession_hyphens():
    assert filing_index_url("0001050446", "0001193125-26-270366") == "https://www.sec.gov/Archives/edgar/data/1050446/000119312526270366/"


def test_recent_filings_keeps_research_forms_and_sec_links():
    submissions = {
        "filings": {
            "recent": {
                "form": ["4", "8-K", "10-Q"],
                "filingDate": ["2026-01-01", "2026-02-01", "2026-03-01"],
                "accessionNumber": ["0001-01", "0002-02", "0003-03"],
                "primaryDocument": ["a.htm", "b.htm", "c.htm"],
                "reportDate": ["", "2026-01-31", "2026-02-28"],
            }
        }
    }
    filings = recent_filings(submissions, "0001050446")
    assert [filing["form"] for filing in filings] == ["8-K", "10-Q"]
    assert filings[0]["filing_url"].endswith("/b.htm")


def test_sec_client_requires_identifying_user_agent():
    with pytest.raises(ValueError, match="SEC_USER_AGENT"):
        SecClient(user_agent="")


def test_collect_and_write_foundation_preserves_raw_responses(tmp_path):
    submissions = {
        "filings": {
            "recent": {
                "form": ["10-K"],
                "filingDate": ["2026-01-01"],
                "accessionNumber": ["0001-01"],
                "primaryDocument": ["annual.htm"],
                "reportDate": ["2025-12-31"],
            }
        }
    }
    calls = []

    class Response:
        def __init__(self, payload):
            self.payload = payload

        def read(self):
            return json.dumps(self.payload).encode()

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    def opener(request, timeout):
        calls.append((request.full_url, timeout))
        return Response(submissions if "submissions" in request.full_url else {"facts": {}})

    snapshot = collect_foundation(SecClient("BTC-Rotator/1.0", opener=opener, sleeper=lambda _: None))
    write_foundation(snapshot, tmp_path)

    assert len(calls) == 4  # Two distinct issuers x submissions and facts.
    assert {issuer["issuer"]["ticker"] for issuer in snapshot["issuers"]} == {issuer.ticker for issuer in ISSUERS}
    assert (tmp_path / "filing-manifest.json").exists()
    assert (tmp_path / "0001050446" / "submissions.json").exists()
    assert "raw_by_cik" not in json.loads((tmp_path / "filing-manifest.json").read_text())
