"""AWS Lambda entry point for the source-preserving SEC collector."""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import Any

from brae.sec_edgar import SecClient, collect_foundation


def _json_bytes(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, indent=2) + "\n").encode("utf-8")


def objects_for_snapshot(snapshot: dict[str, Any], run_id: str) -> dict[str, bytes]:
    """Return immutable raw objects plus one easy-to-read latest manifest."""
    manifest = {key: value for key, value in snapshot.items() if key != "raw_by_cik"}
    objects = {
        f"sec-edgar/manifests/{run_id}.json": _json_bytes(manifest),
        "sec-edgar/manifests/latest.json": _json_bytes(manifest),
    }
    for cik, result in snapshot["raw_by_cik"].items():
        objects[f"sec-edgar/raw/{run_id}/{cik}/submissions.json"] = _json_bytes(result["raw"]["submissions"])
        objects[f"sec-edgar/raw/{run_id}/{cik}/companyfacts.json"] = _json_bytes(result["raw"]["company_facts"])
    return objects


def lambda_handler(event: dict[str, Any], context: Any, s3_client: Any = None) -> dict[str, Any]:
    bucket = os.environ.get("SEC_DATA_BUCKET", "")
    if not bucket:
        raise RuntimeError("SEC_DATA_BUCKET is required")

    if s3_client is None:
        import boto3

        s3_client = boto3.client("s3")

    snapshot = collect_foundation(SecClient())
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    objects = objects_for_snapshot(snapshot, run_id)
    for key, body in objects.items():
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType="application/json",
            ServerSideEncryption="AES256",
        )
    return {"status": "ok", "run_id": run_id, "object_count": len(objects)}
