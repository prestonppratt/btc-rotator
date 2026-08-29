from brae.sec_lambda import objects_for_snapshot


def test_objects_for_snapshot_contains_immutable_raw_data_and_latest_manifest():
    snapshot = {
        "schema_version": 1,
        "raw_by_cik": {
            "0001": {"raw": {"submissions": {"filings": []}, "company_facts": {"facts": {}}}}
        },
    }
    objects = objects_for_snapshot(snapshot, "20260829T120000Z")
    assert "sec-edgar/manifests/latest.json" in objects
    assert "sec-edgar/manifests/20260829T120000Z.json" in objects
    assert "sec-edgar/raw/20260829T120000Z/0001/submissions.json" in objects
    assert "raw_by_cik" not in objects["sec-edgar/manifests/latest.json"].decode()
