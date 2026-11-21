"""Runtime hardware compatibility information.

These entries describe adapter support and validation status. Durability and
wash resistance are never asserted from software; they require manufacturer
documentation and physical sample evidence recorded against a tag batch.
"""

from __future__ import annotations


COMPATIBILITY_MATRIX = [
    {
        "adapter": "zebra",
        "vendor": "Zebra Technologies",
        "device_family": "UHF RFID handhelds and fixed readers with serial-over-TCP or serial bridge",
        "transport": ["tcp", "serial"],
        "epc_gen2": True,
        "tid_read": "when supported by device and configured",
        "epc_write": "when supported by device and configured",
        "bulk_read": True,
        "validation_status": "requires physical sample integration test",
        "configuration": [
            "read_command",
            "response_pattern or response_prefix",
            "status_command",
            "tid_command",
            "write_command",
        ],
    },
    {
        "adapter": "chainway",
        "vendor": "Chainway",
        "device_family": "UHF RFID handhelds exposing a documented command bridge",
        "transport": ["tcp", "serial"],
        "epc_gen2": True,
        "tid_read": "when supported by device and configured",
        "epc_write": "when supported by device and configured",
        "bulk_read": True,
        "validation_status": "requires physical sample integration test",
        "configuration": [
            "read_command",
            "response_pattern or response_prefix",
            "status_command",
            "tid_command",
            "write_command",
        ],
    },
    {
        "adapter": "generic_uhf",
        "vendor": "Other EPC Gen2 / ISO 18000-63 readers",
        "device_family": "Readers with a documented ASCII command protocol",
        "transport": ["tcp", "serial"],
        "epc_gen2": True,
        "tid_read": "when supported by device and configured",
        "epc_write": "when supported by device and configured",
        "bulk_read": True,
        "validation_status": "requires physical sample integration test",
        "configuration": [
            "read_command",
            "response_pattern or response_prefix",
            "status_command",
            "tid_command",
            "write_command",
        ],
    },
    {
        "adapter": "development",
        "vendor": "None",
        "device_family": "Explicit development/test source",
        "transport": ["none"],
        "epc_gen2": False,
        "tid_read": False,
        "epc_write": False,
        "bulk_read": True,
        "validation_status": "disabled in production; simulated reads are not hardware evidence",
        "configuration": ["RFID_MODE=development|test", "RFID_ALLOW_SIMULATED_READS=true", "simulated_epcs"],
    },
]


def compatibility_matrix() -> list[dict]:
    return [dict(row) for row in COMPATIBILITY_MATRIX]
