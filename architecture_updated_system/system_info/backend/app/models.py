"""Response models for the system_info API."""
from __future__ import annotations

from pydantic import BaseModel


class Route(BaseModel):
    method: str
    path: str
    file: str


class ServiceSummary(BaseModel):
    name: str
    language: str
    framework: str
    mount_prefix: str = ""
    route_count: int
    python_files: int = 0
    env_var_names: list[str] = []
    entrypoints: list[str] = []


class ServiceDetail(ServiceSummary):
    routes: list[Route] = []
    dependencies: list[str] = []


class ArchitectureModel(BaseModel):
    source_root: str
    service_count: int
    route_count: int
    services: list[ServiceDetail]


class DependencyGraph(BaseModel):
    nodes: list[str]
    edges: list[dict]


class Summary(BaseModel):
    source_root: str
    service_count: int
    route_count: int
    services: list[ServiceSummary]
