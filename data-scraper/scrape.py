#!/usr/bin/env python3
"""Deprecated shim for the old one-company scraper."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.cli import main


if __name__ == "__main__":
    print("This script is deprecated. Use the new CLI: recon discover | recon build | recon report")
    raise SystemExit(main())
