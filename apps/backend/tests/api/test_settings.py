"""Tests for Settings API — focus on security settings (UNI-1865).

Standalone logic tests that avoid the shared conftest fixture stack
(which has a pre-existing import error). Full route-integration tests
can be added later once conftest is restored.
"""

import pytest
from pydantic import ValidationError


def test_security_settings_model_exports():
    """SecuritySettings is importable and has the expected __tablename__."""
    from src.db import security_models

    assert hasattr(security_models, "SecuritySettings")
    assert security_models.SecuritySettings.__tablename__ == "security_settings"


def test_session_timeout_default_is_60():
    """The SecuritySettings column default is 60 minutes."""
    from src.db.security_models import SecuritySettings

    col = SecuritySettings.__table__.columns["session_timeout_minutes"]
    assert col.default.arg == 60


@pytest.mark.parametrize(
    "minutes, valid",
    [
        (0, False),
        (1, True),
        (5, True),
        (60, True),
        (720, True),
        (1440, True),
        (1441, False),
        (-1, False),
    ],
)
def test_session_timeout_validation_range(minutes, valid):
    """Pydantic request schema accepts 1..1440 inclusive, rejects anything else."""
    from src.api.routes.settings import UpdateSecuritySettingsRequest

    if valid:
        req = UpdateSecuritySettingsRequest(session_timeout_minutes=minutes)
        assert req.session_timeout_minutes == minutes
    else:
        with pytest.raises(ValidationError):
            UpdateSecuritySettingsRequest(session_timeout_minutes=minutes)
