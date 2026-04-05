"""Agents Protocol v1.0 — Confidence Scoring.

Pure functions for computing output confidence from multiple factors:
execution time, agent health, result completeness, and weighted aggregation.
"""

from __future__ import annotations

from typing import Any

from .models import ConfidenceScore


def score_from_execution(execution_time_ms: int, expected_time_ms: int) -> float:
    """Score execution speed relative to expectation.

    Returns:
        1.0 if execution_time <= expected_time
        Degrades linearly toward 0.1 as execution_time approaches 3x expected
        Floors at 0.1 for anything >= 3x expected
    """
    if expected_time_ms <= 0:
        return 1.0

    ratio = execution_time_ms / expected_time_ms

    if ratio <= 1.0:
        return 1.0
    elif ratio >= 3.0:
        return 0.1
    else:
        # Linear interpolation: 1.0 at ratio=1, 0.1 at ratio=3
        return 1.0 - (ratio - 1.0) * 0.45


def score_from_health(health_score: float) -> float:
    """Score based on agent health (pass-through, clamped to 0–1)."""
    return max(0.0, min(1.0, health_score))


def score_from_completeness(
    result: dict[str, Any],
    expected_keys: list[str],
) -> float:
    """Score based on how many expected keys are present in the result.

    Returns:
        Proportion of expected_keys found in result (0.0–1.0)
    """
    if not expected_keys:
        return 1.0

    present = sum(1 for key in expected_keys if key in result)
    return present / len(expected_keys)


def aggregate_confidence(
    factors: dict[str, float],
    weights: dict[str, float] | None = None,
) -> ConfidenceScore:
    """Aggregate multiple factor scores into a single confidence score.

    If weights are provided, computes a weighted average.
    Otherwise, computes a simple average.

    Returns:
        ConfidenceScore with aggregated score and factor details
    """
    if not factors:
        return ConfidenceScore(
            score=0.0,
            reasoning="no factors provided",
            factors={},
        )

    if weights:
        total_weight = sum(weights.get(k, 0.0) for k in factors)
        if total_weight == 0:
            score = 0.0
        else:
            score = sum(
                factors[k] * weights.get(k, 0.0)
                for k in factors
            ) / total_weight
    else:
        score = sum(factors.values()) / len(factors)

    score = max(0.0, min(1.0, round(score, 4)))

    if score >= 0.8:
        reasoning = "high confidence"
    elif score >= 0.5:
        reasoning = "moderate confidence"
    else:
        reasoning = "low confidence"

    return ConfidenceScore(
        score=score,
        reasoning=reasoning,
        factors=dict(factors),
    )
