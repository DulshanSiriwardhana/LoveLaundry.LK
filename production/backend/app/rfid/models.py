"""Hardware-neutral RFID models shared by readers, sessions and scans."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from ..events.models import utc_now


@dataclass(frozen=True)
class ReaderCapabilities:
    supports_tid: bool = False
    supports_write: bool = False
    supports_rssi: bool = False
    supports_multi_antenna: bool = False
    supports_bulk_scan: bool = True
    max_antennas: int = 1

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ReaderStatus:
    connected: bool
    state: str
    message: str = ""
    last_seen_at: str = field(default_factory=utc_now)
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class RfidRead:
    """One physical tag observation reported by a reader adapter."""

    epc: str
    tid: str = ""
    rssi: float | None = None
    antenna: str = ""
    reader_id: str = ""
    occurred_at: str = field(default_factory=utc_now)
    read_count: int = 1
    simulated: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_payload(cls, payload: dict) -> "RfidRead":
        epc = str(payload.get("epc") or payload.get("EPC") or "").strip()
        if not epc:
            raise ValueError("RFID read requires an EPC")
        rssi = payload.get("rssi", payload.get("RSSI"))
        try:
            rssi_value = float(rssi) if rssi not in (None, "") else None
        except (TypeError, ValueError) as exc:
            raise ValueError("RSSI must be numeric") from exc
        return cls(
            epc=epc,
            tid=str(payload.get("tid") or payload.get("TID") or "").strip(),
            rssi=rssi_value,
            antenna=str(payload.get("antenna") or payload.get("ANT") or "").strip(),
            reader_id=str(payload.get("reader_id") or "").strip(),
            occurred_at=str(payload.get("occurred_at") or utc_now()),
            read_count=max(1, int(payload.get("read_count") or 1)),
            simulated=bool(payload.get("simulated", False)),
        )
