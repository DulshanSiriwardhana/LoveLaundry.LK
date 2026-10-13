"""Laundry-management routes.

Assembly order matters: static paths (``/customers/summary``,
``/expenses/categories``) are registered before parameterised paths
(``/customers/{id}``) so they are never swallowed by the ``{id}`` route.
"""
from __future__ import annotations

from fastapi import APIRouter

from .crud import RESOURCES, register_resource
from .custom import register_custom
from .endpoints import register_endpoints

router = APIRouter(tags=["laundry"])

register_custom(router)
register_endpoints(router)
for _spec in RESOURCES:
    register_resource(router, _spec)
