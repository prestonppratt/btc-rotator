"""Run the free SEC foundation locally or from a scheduled AWS job."""

from __future__ import annotations

import argparse
from pathlib import Path

from brae.sec_edgar import SecClient, collect_foundation, write_foundation


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect source-preserving SEC filing data")
    parser.add_argument("--output", type=Path, required=True, help="Private output directory")
    arguments = parser.parse_args()
    snapshot = collect_foundation(SecClient())
    write_foundation(snapshot, arguments.output)
    print(f"SEC filing foundation written to {arguments.output}")


if __name__ == "__main__":
    main()
