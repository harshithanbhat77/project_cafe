import pytest
from pydantic import ValidationError

from app.config import Settings


@pytest.mark.parametrize("secret", ["dev-only-change-me", "replace-with-a-long-random-secret", "short", ""])
def test_weak_jwt_secrets_are_rejected(secret):
    with pytest.raises(ValidationError):
        Settings(jwt_secret=secret, _env_file=None)


def test_strong_secret_is_accepted():
    assert Settings(jwt_secret="a" * 64, _env_file=None).jwt_secret == "a" * 64
