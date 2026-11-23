"""Network-address validation for registered RFID reader endpoints.

A reader endpoint is attacker-influenced whenever an operator with
``manage_readers`` can register one. Without validation, the probe and capture
paths become an SSRF primitive against loopback, cloud metadata or arbitrary
internal services. Only configured hardware networks are accepted by default.
"""

from __future__ import annotations

import ipaddress
import re
import socket

_HOSTNAME = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$")


def parse_endpoint(endpoint: str) -> tuple[str, int]:
    """Parse ``host:port`` (or ``[ipv6]:port``) without performing I/O."""

    text = str(endpoint or "").strip()
    if not text or any(char.isspace() for char in text) or "/" in text:
        raise ValueError("Reader endpoint must be 'host:port'")

    if text.startswith("["):
        host, separator, remainder = text.partition("]")
        if not separator or not remainder.startswith(":"):
            raise ValueError("Reader endpoint must be 'host:port'")
        host = host[1:]
        port_text = remainder[1:]
    else:
        host, separator, port_text = text.rpartition(":")
        if not separator or not host or ":" in host:
            raise ValueError("Reader endpoint must be 'host:port'")

    if not port_text.isdigit():
        raise ValueError("Reader endpoint port must be numeric")
    port = int(port_text)
    if not 1 <= port <= 65535:
        raise ValueError("Reader endpoint port is out of range")
    return host, port


def _assert_allowed_address(address: ipaddress._BaseAddress, settings) -> None:
    if (
        address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_unspecified
        or address.is_reserved
    ):
        raise ValueError("Reader endpoint address is not permitted")
    networks = getattr(settings, "rfid_allowed_endpoint_networks", ())
    if not networks or not any(address in network for network in networks):
        raise ValueError("Reader endpoint is outside the allowed hardware networks")


def validate_reader_endpoint(endpoint: str, settings) -> tuple[str, int]:
    """Validate an endpoint before any connection is attempted."""

    host, port = parse_endpoint(endpoint)
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        if not getattr(settings, "rfid_allow_endpoint_hostnames", False):
            raise ValueError("Reader endpoint hostnames are disabled") from None
        if not _HOSTNAME.fullmatch(host):
            raise ValueError("Invalid reader endpoint hostname") from None
        try:
            resolved = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except OSError as exc:
            raise ValueError("Reader endpoint hostname could not be resolved") from exc
        if not resolved:
            raise ValueError("Reader endpoint hostname could not be resolved")
        for entry in resolved:
            try:
                candidate = ipaddress.ip_address(entry[4][0])
            except ValueError:
                raise ValueError("Reader endpoint resolved to an invalid address") from None
            _assert_allowed_address(candidate, settings)
        return host, port

    _assert_allowed_address(address, settings)
    return host, port
