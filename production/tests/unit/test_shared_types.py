from shared_types import (
    AuditEvent,
    Device,
    Membership,
    Organization,
    Permission,
    Role,
    SecurityLog,
    Session,
    SystemConfig,
    User,
)
from shared_utilities import currency, new_id, today_key


def test_user_model_defaults() -> None:
    user = User(auth_id="auth-1", user_name="staff")
    assert user.status == "active"


def test_role_model_defaults() -> None:
    role = Role(role_id="role-1", name="MANAGER")
    assert role.capabilities == []


def test_currency_formats_amounts() -> None:
    assert currency(12500.5) == "12,500.50"


def test_today_key_returns_date_string() -> None:
    assert len(today_key()) == 10


def test_new_id_prefixes() -> None:
    assert new_id("ord").startswith("ord-")
