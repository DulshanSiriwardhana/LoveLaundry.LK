"""Parity-test fixtures. Sets test secrets BEFORE importing service code."""
import os

os.environ.setdefault("JWT_SECRET", "parity-test-secret-0123456789abcdef")
os.environ.setdefault("MASTER_KEY", "parity-test-master-key-0123456789abcdef01")
os.environ.setdefault("LOVE_AI_API_KEYS", "parity-key")
os.environ.setdefault("VERCEL", "1")  # disable background sync workers
