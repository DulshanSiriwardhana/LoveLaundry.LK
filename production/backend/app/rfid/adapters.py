"""Concrete reader transports and manufacturer adapter classes.

No adapter fabricates a read. Network and serial adapters exchange real
commands with a configured device and fail closed when no device responds.
The development adapter is gated by configuration and refuses production mode.
"""

from __future__ import annotations

import asyncio
import re
import socket
import time
from abc import ABC, abstractmethod
from typing import Any

from .models import RfidRead, ReaderStatus

_HEX_LINE = re.compile(r"^[0-9A-Fa-f:\- ]{8,}$")


class ReaderTransport(ABC):
    @abstractmethod
    async def send(self, command: str, timeout: float = 2.0) -> str:
        """Send one command and return the raw device response."""

    @abstractmethod
    async def probe(self, timeout: float = 2.0) -> ReaderStatus:
        """Verify the device is reachable without performing a tag read."""


class TcpTransport(ReaderTransport):
    """Serial-over-TCP bridge transport used by handheld and fixed readers."""

    def __init__(self, endpoint: str) -> None:
        host, separator, port = str(endpoint or "").rpartition(":")
        if not separator or not host or not port.isdigit():
            raise ValueError("TCP reader endpoint must be 'host:port'")
        self.host = host
        self.port = int(port)

    async def send(self, command: str, timeout: float = 2.0) -> str:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(self.host, self.port), timeout=timeout
        )
        buffer = ""
        try:
            writer.write((command + "\r\n").encode("utf-8"))
            await writer.drain()
            while True:
                chunk = await asyncio.wait_for(reader.read(4096), timeout=timeout)
                if not chunk:
                    break
                buffer += chunk.decode("utf-8", errors="replace")
                if "\n" in buffer or "\r" in buffer:
                    break
        finally:
            writer.close()
            await writer.wait_closed()
        return buffer

    async def probe(self, timeout: float = 2.0) -> ReaderStatus:
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port), timeout=timeout
            )
            writer.close()
            await writer.wait_closed()
            return ReaderStatus(True, "connected", f"{self.host}:{self.port}")
        except (OSError, asyncio.TimeoutError) as exc:
            return ReaderStatus(False, "disconnected", str(exc))


class SerialTransport(ReaderTransport):
    """Direct serial transport. Requires the optional pyserial dependency."""

    def __init__(self, endpoint: str) -> None:
        parts = str(endpoint or "").split(":")
        if not parts[0] or len(parts) > 2:
            raise ValueError("Serial reader endpoint must be 'device[:baud]'")
        self.port_name = parts[0]
        self.baudrate = int(parts[1]) if len(parts) == 2 else 115200

    @staticmethod
    def _exchange(port_name: str, baudrate: int, command: str, timeout: float) -> str:
        try:
            import serial  # type: ignore
        except ImportError as exc:  # pragma: no cover - depends on deployment extras
            raise RuntimeError("pyserial is required for serial RFID readers") from exc
        with serial.Serial(port=port_name, baudrate=baudrate, timeout=timeout) as handle:
            handle.write((command + "\r\n").encode("utf-8"))
            deadline = time.monotonic() + timeout
            response = ""
            while time.monotonic() < deadline:
                chunk = handle.read(handle.in_waiting or 1)
                if not chunk:
                    break
                response += chunk.decode("utf-8", errors="replace")
                if "\n" in response:
                    break
            return response

    async def send(self, command: str, timeout: float = 2.0) -> str:
        return await asyncio.to_thread(
            self._exchange, self.port_name, self.baudrate, command, timeout
        )

    async def probe(self, timeout: float = 2.0) -> ReaderStatus:
        try:
            await asyncio.to_thread(
                self._exchange, self.port_name, self.baudrate, "", min(timeout, 0.5)
            )
            return ReaderStatus(True, "connected", self.port_name)
        except Exception as exc:
            return ReaderStatus(False, "disconnected", str(exc))


class RfidReaderAdapter(ABC):
    vendor = "generic"

    def __init__(self, reader: dict, transport: ReaderTransport | None = None) -> None:
        self.reader = reader
        self.reader_id = str(reader.get("reader_id") or "")
        self.config = dict(reader.get("metadata") or {})
        self.transport = transport

    @abstractmethod
    async def read_tags(self, timeout: float = 2.0) -> list[RfidRead]:
        raise NotImplementedError

    @abstractmethod
    async def read_tid(self, epc: str) -> str:
        raise NotImplementedError

    @abstractmethod
    async def write_epc(self, current_epc: str, new_epc: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    async def status(self) -> ReaderStatus:
        raise NotImplementedError


class ConfiguredUhfAdapter(RfidReaderAdapter):
    """Real UHF adapter driven by a registered device's command configuration."""

    def _command(self, key: str, **values) -> str:
        template = str(self.config.get(key) or "").strip()
        if not template:
            raise RuntimeError(
                f"Reader {self.reader_id} has no {key} configured for {self.vendor} adapter"
            )
        return template.format(**values)

    def _parse_reads(self, response: str) -> list[RfidRead]:
        pattern = str(self.config.get("response_pattern") or "").strip()
        if pattern:
            reads: list[RfidRead] = []
            for match in re.finditer(pattern, response):
                groups = match.groupdict()
                epc = groups.get("epc")
                if not epc:
                    continue
                rssi = groups.get("rssi")
                reads.append(
                    RfidRead(
                        epc=epc,
                        tid=str(groups.get("tid") or ""),
                        rssi=float(rssi) if rssi not in (None, "") else None,
                        antenna=str(groups.get("antenna") or ""),
                        reader_id=self.reader_id,
                    )
                )
            return reads

        prefix = str(self.config.get("response_prefix") or "")
        separator = str(self.config.get("line_separator") or "\n")
        reads = []
        for raw_line in response.replace("\r", "\n").split(separator):
            line = raw_line.strip()
            if prefix and line.startswith(prefix):
                line = line[len(prefix) :].strip()
            if not _HEX_LINE.match(line):
                continue
            reads.append(RfidRead(epc=line, reader_id=self.reader_id))
        return reads

    async def read_tags(self, timeout: float = 2.0) -> list[RfidRead]:
        response = await self.transport.send(
            self._command("read_command"), timeout=timeout
        )
        return self._parse_reads(response)

    async def read_tid(self, epc: str) -> str:
        response = await self.transport.send(
            self._command("tid_command", epc=epc)
        )
        reads = self._parse_reads(response)
        return reads[0].tid if reads else ""

    async def write_epc(self, current_epc: str, new_epc: str) -> dict:
        response = await self.transport.send(
            self._command(
                "write_command", current_epc=current_epc, new_epc=new_epc
            )
        )
        marker = str(self.config.get("success_marker") or "").strip()
        success = not marker or marker in response
        return {"success": success, "response": response.strip()}

    async def status(self) -> ReaderStatus:
        command = str(self.config.get("status_command") or "").strip()
        if command:
            response = await self.transport.send(command)
            return ReaderStatus(
                True,
                "connected",
                response.strip(),
                details={"adapter": self.vendor},
            )
        return await self.transport.probe()


class ZebraAdapter(ConfiguredUhfAdapter):
    vendor = "zebra"


class ChainwayAdapter(ConfiguredUhfAdapter):
    vendor = "chainway"


class GenericUhfAdapter(ConfiguredUhfAdapter):
    vendor = "generic_uhf"


class DevelopmentAdapter(RfidReaderAdapter):
    """Explicit test-only source. It never claims to represent hardware reads."""

    vendor = "development"

    def __init__(self, reader: dict, transport: ReaderTransport | None = None) -> None:
        super().__init__(reader, transport)
        epcs = self.config.get("simulated_epcs") or []
        if not isinstance(epcs, list) or not epcs:
            raise RuntimeError(
                "Development RFID readers require a configured simulated_epcs list"
            )
        self.epcs = [str(value) for value in epcs]

    async def read_tags(self, timeout: float = 2.0) -> list[RfidRead]:
        return [
            RfidRead(epc=epc, reader_id=self.reader_id, simulated=True)
            for epc in self.epcs
        ]

    async def read_tid(self, epc: str) -> str:
        return ""

    async def write_epc(self, current_epc: str, new_epc: str) -> dict:
        raise RuntimeError("Simulated RFID adapters cannot write EPCs")

    async def status(self) -> ReaderStatus:
        return ReaderStatus(
            True,
            "simulated",
            "Development-only simulated reader; not valid for production scans",
            details={"simulated": True},
        )


_ADAPTERS = {
    "zebra": ZebraAdapter,
    "chainway": ChainwayAdapter,
    "generic_uhf": GenericUhfAdapter,
    "development": DevelopmentAdapter,
}


def supported_adapters() -> list[str]:
    return sorted(_ADAPTERS)


def build_adapter(reader: dict, settings) -> RfidReaderAdapter:
    """Construct a real adapter, refusing simulated hardware in production."""

    adapter_name = str(reader.get("adapter") or "").strip().lower()
    adapter_type = _ADAPTERS.get(adapter_name)
    if adapter_type is None:
        raise ValueError(f"Unsupported RFID adapter: {adapter_name}")
    if adapter_name == "development":
        rfid_mode = str(getattr(settings, "rfid_mode", "production")).lower()
        allow_simulation = bool(getattr(settings, "rfid_allow_simulated_reads", False))
        if rfid_mode not in {"development", "test"} or not allow_simulation:
            raise RuntimeError(
                "Simulated RFID reads are disabled; use a registered hardware adapter"
            )
        return adapter_type(reader)

    transport_name = str(reader.get("transport") or "tcp").strip().lower()
    endpoint = str(reader.get("endpoint") or "").strip()
    if not endpoint:
        raise ValueError("A registered RFID reader requires an endpoint")
    if transport_name == "tcp":
        transport: ReaderTransport = TcpTransport(endpoint)
    elif transport_name == "serial":
        transport = SerialTransport(endpoint)
    else:
        raise ValueError(f"Unsupported RFID reader transport: {transport_name}")
    return adapter_type(reader, transport)


def socket_family_probe(endpoint: str) -> bool:
    """Small helper used by deployment checks; does not perform a tag read."""

    host, separator, port = endpoint.rpartition(":")
    if not separator or not port.isdigit():
        return False
    try:
        with socket.create_connection((host, int(port)), timeout=1):
            return True
    except OSError:
        return False
