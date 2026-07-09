"""
Simple Python program for E2E debugging tests.

Starts with debugpy listening so the CLI debugger can attach.
Provides simple functions for testing breakpoints, stepping, and variable inspection.

Usage:
    python -m debugpy --listen 5678 --wait-for-client simple_program.py
"""

import sys
import time


def add(a: int, b: int) -> int:
    """Simple addition function for stepping tests."""
    result = a + b
    return result


def multiply(a: int, b: int) -> int:
    """Simple multiplication function for stepping tests."""
    result = a * b
    return result


def process_data(data: list[int]) -> dict:
    """Function with more complex data for variable inspection."""
    total = sum(data)
    count = len(data)
    avg = total / count if count > 0 else 0.0
    return {"total": total, "count": count, "average": avg}


def main():
    print("Python simple_program started", flush=True)
    sys.stdout.flush()

    # Small delay to allow debugger to connect
    time.sleep(0.5)

    # Basic variable inspection
    x = 10
    y = 20
    s = add(x, y)
    print(f"add({x}, {y}) = {s}", flush=True)

    # More complex data
    values = [1, 2, 3, 4, 5]
    result = process_data(values)
    print(f"process_data result: {result}", flush=True)

    p = multiply(x, y)
    print(f"multiply({x}, {y}) = {p}", flush=True)

    # Keep program running for debugging
    print("Waiting for debugger commands...", flush=True)
    time.sleep(5)

    print("Python simple_program finished", flush=True)


if __name__ == "__main__":
    main()