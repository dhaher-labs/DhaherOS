"""P1 characterization tests for the base_agent typing redesign.

Design: docs/12-tasks/plans/2026-11-01-base-agent-typing-redesign.md
(commit 2526f8b, Phase 5 M2+ backlog item 1).

These tests PIN today's (defective) behaviour of the subagent-spawn seam so
that any accidental use of the broken path before the P2 redesign lands fails
loudly.  They are characterization tests, not contract tests:

* ``spawn_subagent`` raises ``AttributeError`` today because the seam
  (``src/core/base_agent.py`` line ~483) calls ``AgentRegistry.get()``, a
  method that does not exist — the call conflates ``AgentRegistry`` with
  ``ToolRegistry.get(name)`` (design doc §2 defect 1).
* ``AgentRegistry``'s public API is frozen (no ``get``; pinned signatures for
  ``create_agent``/``get_agent``/``register_type``) so P2 cannot silently
  break existing callers while bridging the seam (Option B REJECTED).
* The role/type enum split is pinned: ``AgentRole`` includes ``SUPERVISOR``
  but ``AGENT_TYPES`` (keyed by ``AgentType``) does not, so the seam's string
  lookup can never type-check (design doc §2 defect 2).

After P2 lands, rewrite these as regression tests for the new
``AgentRegistry.create_subagent`` contract.
"""

import asyncio
import inspect
import pathlib
import re
import unittest


class TestSpawnSubagentCharacterization(unittest.TestCase):
    """Pins the current behaviour of the (latent, broken) spawn seam."""

    def test_spawn_subagent_raises_attribute_error(self):
        """Characterization: the seam calls AgentRegistry.get() — which is absent."""
        from src.colony_types.agent import AgentConfig, AgentRole, SubagentSpawn
        from src.core.base_agent import BaseAgent

        parent = BaseAgent(config=AgentConfig(role=AgentRole.PLANNER))
        spawn = SubagentSpawn(role=AgentRole.PLANNER, task="ping")

        with self.assertRaises(AttributeError) as ctx:
            asyncio.run(parent.spawn_subagent(spawn))
        self.assertIn("get", str(ctx.exception))

    def test_zero_callers_of_spawn_subagent_in_src(self):
        """Design doc §2 defect 5: the seam is latent, not live.

        Guards the invariant that kept pytest green despite the broken seam:
        no module outside src/core/base_agent.py may call ``.spawn_subagent(``
        until P2 introduces the typed registry-owned factory.
        """
        root = pathlib.Path(__file__).resolve().parents[1] / "src"
        pattern = re.compile(r"\.spawn_subagent\(")
        hits = [
            str(p.relative_to(root.parent))
            for p in sorted(root.rglob("*.py"))
            if p.name != "base_agent.py" and pattern.search(p.read_text(encoding="utf-8"))
        ]
        self.assertEqual(hits, [])


class TestAgentRegistryApiFreeze(unittest.TestCase):
    """Freezes AgentRegistry's public API ahead of the P2 redesign."""

    def test_registry_has_no_get_method(self):
        from src.agents.registry import AgentRegistry

        self.assertFalse(
            hasattr(AgentRegistry, "get"),
            "AgentRegistry.get must NOT be added: Option B (quick fix) is "
            "rejected per ROADMAP — spawn ownership belongs to "
            "create_subagent (design doc §5 Option A).",
        )

    def test_create_agent_signature_pinned(self):
        from src.agents.registry import AgentRegistry

        params = list(inspect.signature(AgentRegistry.create_agent).parameters)
        self.assertEqual(params, ["self", "agent_type", "spec", "tools"])

    def test_get_agent_signature_pinned(self):
        from src.agents.registry import AgentRegistry

        params = list(inspect.signature(AgentRegistry.get_agent).parameters)
        self.assertEqual(params, ["self", "agent_id"])

    def test_register_type_signature_pinned(self):
        from src.agents.registry import AgentRegistry

        params = list(inspect.signature(AgentRegistry.register_type).parameters)
        self.assertEqual(params, ["self", "agent_type", "agent_class"])

    def test_supervisor_role_has_no_agent_type_counterpart(self):
        """Defect 2 pinned: AgentRole.SUPERVISOR exists, AGENT_TYPES has none."""
        from src.agents.registry import AGENT_TYPES
        from src.colony_types.agent import AgentRole

        role_names = {r.name for r in AgentRole}
        type_names = {t.name for t in AGENT_TYPES}
        self.assertIn("SUPERVISOR", role_names)
        self.assertNotIn("SUPERVISOR", type_names)
        self.assertTrue(type_names.issubset(role_names))
        self.assertEqual(
            role_names - type_names,
            {"SUPERVISOR", "WORKER"},
            "unexpected drift in the role/type split — update the P2 "
            "_ROLE_TO_TYPE mapping design if this set changed",
        )


if __name__ == "__main__":
    unittest.main()
