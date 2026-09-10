#!/usr/bin/env python3
"""Drain the durable CITIC alert spool independently of alert invocations."""

from __future__ import annotations

import sys

from citic_alert_delivery import DurableSpool


def main() -> int:
    try:
        spool = DurableSpool()
        _delivered, error = spool.flush()
        if error:
            print(f"CITIC alert spool retry failed: {error[:240]}", file=sys.stderr)
            return 1
        return 0
    except Exception as exc:
        print(f"CITIC alert spool worker failed: {str(exc)[:240]}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
