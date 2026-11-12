#!/usr/bin/env python3
# run-33 Track 1 (DL-37): blackhornet runtime layer — mission.py
#
# A Python mission runner that can be invoked as a control-plane task command:
#   POST /api/tasks {"runtime":"python3","command":"python3 mission.py <spec>"}
#
# A mission = list of steps. Each step:
#   {action: "echo"|"compute"|"search-notes", input: <str>, expected?: <str>}
# The runner executes steps in order, captures each step's output, and writes a
# JSON summary to stdout (consumed by the control plane artifact pipeline).
#
# Spec sources (tried in order):
#   1) argv[1] if it points to an existing readable file → JSON file path.
#   2) argv[1] if it parses as a JSON object → inline JSON string.
#   3) stdin if it is not a TTY → JSON stream (note: control-plane executor
#      currently uses stdin="ignore", so this path is dormant but supported
#      for standalone CLI use).
#   4) Otherwise → built-in demo mission (proves python3 runtime works end-to-end
#      without any external file).
#
# Constraints (mirror the control plane):
#   - No external network calls (runs locally only).
#   - No mutation outside the current working directory.
#   - "compute" uses a restricted eval (no builtins) — only arithmetic on literals.
#   - Exit 0 on success, non-zero on hard failure; partial results still emitted.
#
# This file is intentionally stdlib-only (json, sys, os, ast) so it runs under
# the executor's clean child env (PATH=/usr/local/bin:/usr/bin:/bin, HOME=ws).
from __future__ import annotations

import ast
import json
import os
import select
import sys
from typing import Any


DEMO_SPEC: dict[str, Any] = {
    "mission": "blackhornet:demo",
    "steps": [
        {"action": "echo", "input": "blackhornet runtime up", "expected": "blackhornet runtime up"},
        {"action": "compute", "input": "6 * 7", "expected": "42"},
        {"action": "search-notes", "input": "blackhornet", "expected": "search:blackhornet"},
    ],
}


def load_spec(argv: list[str]) -> dict[str, Any]:
    if len(argv) > 1:
        arg = argv[1]
        if os.path.isfile(arg):
            with open(arg, "r", encoding="utf-8") as f:
                return json.load(f)
        # Try inline JSON.
        try:
            obj = json.loads(arg)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    # stdin (dormant under control-plane executor: stdin is "ignore" so there
    # is nothing to read; we guard with a non-blocking select so we never hang
    # waiting for input on a closed/empty stdin).
    if not sys.stdin.isatty():
        try:
            rdy, _, _ = select.select([sys.stdin], [], [], 0.0)
        except (OSError, ValueError):
            rdy = []
        if rdy:
            data = sys.stdin.read().strip()
            if data:
                try:
                    obj = json.loads(data)
                    if isinstance(obj, dict):
                        return obj
                except json.JSONDecodeError:
                    pass
    return DEMO_SPEC


def _safe_compute(expr: str) -> str:
    """Evaluate an arithmetic/literal expression with no builtins (no I/O, no names)."""
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError as e:
        return f"compute_error:syntax:{e.msg}"
    # Allow only literal/arith nodes — explicitly reject calls/attributes/names.
    allowed = (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant,
               ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod,
               ast.Pow, ast.USub, ast.UAdd, ast.BoolOp, ast.And, ast.Or,
               ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE)
    for node in ast.walk(tree):
        if not isinstance(node, allowed):
            return f"compute_error:disallowed_node:{type(node).__name__}"
    try:
        value = eval(compile(tree, "<mission-compute>", "eval"),
                     {"__builtins__": {}}, {})
    except Exception as e:  # noqa: BLE001 — surface any compute failure
        return f"compute_error:runtime:{type(e).__name__}:{e}"
    return str(value)


def run_step(step: dict[str, Any], index: int) -> dict[str, Any]:
    action = str(step.get("action", "")).strip()
    inp = step.get("input", "")
    expected = step.get("expected")
    out: Any = None
    if action == "echo":
        out = str(inp)
    elif action == "compute":
        out = _safe_compute(str(inp))
    elif action == "search-notes":
        # Local stub: produces a deterministic placeholder string. A real
        # blackhornet researcher seat would call the control plane knowledge
        # API; here we only prove the python3 runtime executes the step.
        out = f"search:{inp}"
    else:
        out = f"unknown_action:{action}"
    ok = expected is None or str(out) == str(expected)
    return {
        "step": index,
        "action": action,
        "input": inp,
        "expected": expected,
        "output": out,
        "ok": ok,
    }


def run_mission(spec: dict[str, Any]) -> dict[str, Any]:
    steps = spec.get("steps", [])
    if not isinstance(steps, list):
        steps = []
    results = [run_step(s if isinstance(s, dict) else {}, i)
               for i, s in enumerate(steps)]
    passed = sum(1 for r in results if r["ok"])
    return {
        "ok": passed == len(results),
        "mission": spec.get("mission", "blackhornet:unnamed"),
        "runtime": os.environ.get("DHOS_RUNTIME", "python3"),
        "runtime_version": os.environ.get("DHOS_RUNTIME_VERSION", ""),
        "step_count": len(results),
        "steps_passed": passed,
        "results": results,
    }


def main(argv: list[str]) -> int:
    try:
        spec = load_spec(argv)
    except Exception as e:  # noqa: BLE001 — emit a hard-fail result + exit non-zero
        print(json.dumps({
            "ok": False,
            "error": f"spec_load_failed:{type(e).__name__}:{e}",
        }))
        return 2
    summary = run_mission(spec)
    print(json.dumps(summary, indent=2))
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
