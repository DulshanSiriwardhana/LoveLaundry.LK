"""Pydantic schemas for the auth/users module.

The public user representation never exposes ``password`` (legacy guarantee).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | str
    user_name: str
    role_id: str
    auth_id: str
    email: str | None = None
    mobile_number: str | None = None
    employee_id: str | None = None
    bio_data: str | None = None
    user_dp: str | None = None
    status: str = "unset"
    permissions: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class LoginRequest(BaseModel):
    user_name: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class UserCreate(BaseModel):
    user_name: str = Field(min_length=1)
    password: str = Field(min_length=6)
    role_id: str = Field(min_length=1)
    email: EmailStr | None = None
    mobile_number: str | None = None
    employee_id: str | None = None
    bio_data: str | None = None
    user_dp: str | None = None
    permissions: str | None = None
    status: str = "unset"


class UserUpdate(BaseModel):
    user_name: str | None = None
    role_id: str | None = None
    email: EmailStr | None = None
    mobile_number: str | None = None
    employee_id: str | None = None
    bio_data: str | None = None
    user_dp: str | None = None
    permissions: str | None = None


class PasswordUpdate(BaseModel):
    password: str = Field(min_length=6)


class ProfileUpdate(BaseModel):
    bio_data: str | None = None
    user_dp: str | None = None
    mobile_number: str | None = None
    email: EmailStr | None = None


class StatusUpdate(BaseModel):
    status: str = Field(min_length=1)


class TokenClaims(BaseModel):
    sub: str | None = None
    auth_id: str | None = None
    role: str | None = None
    user_name: str | None = None
