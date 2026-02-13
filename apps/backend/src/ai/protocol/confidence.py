"""Agents Protocol v1.0 — Confidence Scoring.

Pure functions for computing confidence scores on agent outputs.
Section 8 (Quality & Verification).
"""

from .models import ConfidenceScore


def score_from_execution(execution_time_ms: int, expected_time_ms: int) -> float:
    """Compute confidence factor from execution time.

    Faster execution relative to expected time yields higher confidence.
    Execution beyond 2x expected time is capped at 0.1.

    Args:
        execution_time_ms: Actual execution time in milliseconds
        expected_time_ms: Expected execution time in milliseconds

    Returns:
        Score between 0.0 and 1.0
    """
    if expected_time_ms <= 0:
        return 0.5  # Cannot evaluate without expected time

    if execution_time_ms <= 0:
        return 1.0  # Instant execution

    ratio = execution_time_ms / expected_time_ms

    if ratio <= 0.5:
        return 1.0  # Very fast
    elif ratio <= 1.0:
        return 1.0  # Within expected time
    elif ratio <= 2.0:
        # Linear degradation from 1.0 to 0.3 between 1x and 2x
        return max(0.3, 1.0 - (ratio - 1.0) * 0.7)
    else:
        return 0.1  # Very slow


def score_from_health(health_score: float) -> float:
    """Compute confidence factor from agent health score.

    Direct pass-through with clamping to [0.0, 1.0].

    Args:
        health_score: Agent health score (expected 0.0-1.0)

    Returns:
        Score between 0.0 and 1.0
    """
    return max(0.0, min(1.0, health_score))


def score_from_completeness(
    result: dict,
    expected_keys: list[str],
) -> float:
    """Compute confidence factor from result completeness.

    Measures what proportion of expected output keys are present.

    Args:
        result: Agent execution result dictionary
        expected_keys: List of keys expected in the result

    Returns:
        Score between 0.0 and 1.0
    """
    if not expected_keys:
        return 1.0  # No expectations = fully complete

    if not result:
        return 0.0  # Empty result = not complete

    present = sum(1 for key in expected_keys if key in result)
    return present / len(expected_keys)


def aggregate_confidence(
    factors: dict[str, float],
    weights: dict[str, float] | None = None,
) -> ConfidenceScore:
    """Aggregate multiple confidence factors into a single score.

    Args:
        factors: Individual factor scores (name → value 0.0-1.0)
        weights: Optional weights for each factor (name → weight).
                 If None, equal weighting is used.

    Returns:
        Aggregated ConfidenceScore
    """
    if not factors:
        return ConfidenceScore(
            score=0.0,
            reasoning="no factors provided",
            factors={},
        )

    if weights:
        # Weighted average (only for factors that have weights)
        total_weight = 0.0
        weighted_sum = 0.0
        for name, value in factors.items():
            w = weights.get(name, 0.0)
            weighted_sum += max(0.0, min(1.0, value)) * w
            total_weight += w

        if total_weight > 0:
            score = weighted_sum / total_weight
        else:
            score = 0.0
    else:
        # Equal weighting
        clamped_values = [max(0.0, min(1.0, v)) for v in factors.values()]
        score = sum(clamped_values) / len(clamped_values)

    score = max(0.0, min(1.0, round(score, 3)))

    # Build reasoning
    low_factors = [
        name for name, value in factors.items() if value < 0.5
    ]
    if low_factors:
        reasoning = f"low factors: {', '.join(low_factors)}"
    elif score >= 0.8:
        reasoning = "all factors nominal"
    else:
        reasoning = "moderate confidence across factors"

    return ConfidenceScore(
        score=score,
        reasoning=reasoning,
        factors=factors,
    )
