"""Price + holdings ingest. Phase 0: Yahoo fallback -> fixture. Phase 1: Polygon/Tiingo with quality flags."""
import json
from pathlib import Path
UNIVERSE = Path("data/universe.csv")
SNAPSHOT_DIR = Path("data/snapshots")
