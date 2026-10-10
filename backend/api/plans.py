import os
import re
import secrets
from datetime import date, datetime
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, field_validator

from backend.api.auth import get_current_user

# Constants
_REFERENCE_RE = re.compile(r"^SP-[a-f0-9]{32}$")
_VALID_DURATIONS = {"60 minutes", "90 minutes", "2 hours", "3 hours"}
_VALID_SHOOT_TYPES = {"Pre-shoot", "Wedding", "Portrait", "Fashion", "Food"}
_VALID_EQUIPMENT = {"Camera", "Tripod", "Reflector", "Lighting", "Drone"}
_TIME_RE = re.compile(r"^\d{2}:\d{2}$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

router = APIRouter(prefix="/plans", tags=["plans"])


class PlanRequest(BaseModel):
    location: str
    shootDate: str
    startTime: str
    duration: str
    shootTypes: list[str]
    people: object
    equipment: list[str]
    lightingPlan: Optional[str] = None
    accessNotes: str
    consent: bool

    model_config = {"extra": "forbid"}

    @field_validator("location")
    @classmethod
    def validate_location(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Location must be at least 3 characters.")
        if len(v) > 160:
            raise ValueError("Location must be 160 characters or fewer.")
        return v

    @field_validator("shootDate")
    @classmethod
    def validate_shoot_date(cls, v):
        if not _DATE_RE.match(v):
            raise ValueError("Enter date in YYYY-MM-DD format.")
        try:
            parts = v.split("-")
            d = date(int(parts[0]), int(parts[1]), int(parts[2]))
        except (ValueError, IndexError):
            raise ValueError("Enter a valid date.")
        if d.isoformat() != v:
            raise ValueError("Enter a valid date.")
        if d < date.today():
            raise ValueError("Shoot date must be today or later.")
        return v

    @field_validator("startTime")
    @classmethod
    def validate_start_time(cls, v):
        if not _TIME_RE.match(v):
            raise ValueError("Enter time in HH:mm format.")
        parts = v.split(":")
        h, m = int(parts[0]), int(parts[1])
        if h > 23 or m > 59:
            raise ValueError("Enter a valid time.")
        return v

    @field_validator("duration")
    @classmethod
    def validate_duration(cls, v):
        if v not in _VALID_DURATIONS:
            raise ValueError("Duration must be one of: " + ", ".join(sorted(_VALID_DURATIONS)) + ".")
        return v

    @field_validator("shootTypes")
    @classmethod
    def validate_shoot_types(cls, v):
        if not v:
            raise ValueError("At least one shoot type is required.")
        if len(v) != len(set(v)):
            raise ValueError("Shoot types must be unique.")
        if len(v) > len(_VALID_SHOOT_TYPES):
            raise ValueError("Too many shoot types.")
        for t in v:
            if t not in _VALID_SHOOT_TYPES:
                raise ValueError("Invalid shoot type: " + t + ".")
        return v

    @field_validator("people")
    @classmethod
    def validate_people(cls, v):
        if isinstance(v, bool):
            raise ValueError("People must be a whole number between 1 and 50.")
        if isinstance(v, str):
            v = v.strip()
            if "." in v or "," in v:
                raise ValueError("People must be a whole number between 1 and 50.")
            try:
                v = int(v)
            except ValueError:
                raise ValueError("People must be a whole number between 1 and 50.")
        elif isinstance(v, float):
            if v != int(v):
                raise ValueError("People must be a whole number between 1 and 50.")
            v = int(v)
        elif isinstance(v, int):
            pass
        else:
            raise ValueError("People must be a whole number between 1 and 50.")
        if v < 1 or v > 50:
            raise ValueError("People must be between 1 and 50.")
        return v

    @field_validator("equipment")
    @classmethod
    def validate_equipment(cls, v):
        if not v:
            raise ValueError("At least one equipment item is required.")
        if len(v) != len(set(v)):
            raise ValueError("Equipment must be unique.")
        if len(v) > len(_VALID_EQUIPMENT):
            raise ValueError("Too many equipment items.")
        for e in v:
            if e not in _VALID_EQUIPMENT:
                raise ValueError("Invalid equipment: " + e + ".")
        if "Drone" in v:
            raise ValueError("Drone shoots require additional clearance and cannot be planned online.")
        return v

    @field_validator("lightingPlan")
    @classmethod
    def validate_lighting_plan(cls, v, info):
        equipment = info.data.get("equipment", []) if info.data else []
        if "Lighting" in equipment:
            if v is None or not v.strip():
                raise ValueError("Lighting plan is required when Lighting is selected.")
            v = v.strip()
            if len(v) < 10:
                raise ValueError("Lighting plan must be at least 10 characters.")
            if len(v) > 200:
                raise ValueError("Lighting plan must be 200 characters or fewer.")
            return v
        return None

    @field_validator("accessNotes")
    @classmethod
    def validate_access_notes(cls, v):
        v = v.strip()
        if len(v) < 20:
            raise ValueError("Access notes must be at least 20 characters.")
        if len(v) > 300:
            raise ValueError("Access notes must be 300 characters or fewer.")
        return v

    @field_validator("consent")
    @classmethod
    def validate_consent(cls, v):
        if v is not True:
            raise ValueError("Consent must be confirmed.")
        return v


class PlanCreateResponse(BaseModel):
    reference: str


class PlanDetailResponse(BaseModel):
    reference: str
    plan: dict
    createdAt: str


def _get_connection():
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        raise RuntimeError("Database not configured.")
    return psycopg2.connect(dsn, sslmode="require", connect_timeout=10, options="-c statement_timeout=10000")


def _generate_reference():
    return "SP-" + secrets.token_hex(16)


def _safe_error(detail="Unable to process your request."):
    return HTTPException(status_code=500, detail=detail)


@router.post("", status_code=201)
async def create_plan(body: PlanRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    reference = _generate_reference()
    conn = None
    try:
        conn = _get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO public.shoot_plans
                    (user_id, reference, location, shoot_date, start_time,
                     duration, shoot_types, people, equipment,
                     lighting_plan, access_notes, consent)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (user_id, reference, body.location, body.shootDate,
                 body.startTime, body.duration,
                 psycopg2.extras.Json(body.shootTypes),
                 body.people, psycopg2.extras.Json(body.equipment),
                 body.lightingPlan, body.accessNotes, body.consent),
            )
        conn.commit()
    except psycopg2.Error:
        if conn:
            try: conn.rollback()
            except: pass
        raise _safe_error("Unable to save your plan. Please try again.")
    except RuntimeError:
        raise _safe_error("Service is temporarily unavailable.")
    except Exception:
        if conn:
            try: conn.rollback()
            except: pass
        raise _safe_error("Unable to save your plan. Please try again.")
    finally:
        if conn:
            try: conn.close()
            except: pass
    return PlanCreateResponse(reference=reference)


@router.get("/{reference}")
async def get_plan(reference: str, user: dict = Depends(get_current_user)):
    if not _REFERENCE_RE.match(reference):
        raise HTTPException(status_code=404, detail="Not found.")
    user_id = user["id"]
    conn = None
    try:
        conn = _get_connection()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT reference, location, shoot_date, start_time,
                       duration, shoot_types, people, equipment,
                       lighting_plan, access_notes, consent, created_at
                FROM public.shoot_plans
                WHERE reference = %s AND user_id = %s""",
                (reference, user_id),
            )
            row = cur.fetchone()
    except psycopg2.Error:
        raise _safe_error("Unable to retrieve your plan. Please try again.")
    except RuntimeError:
        raise _safe_error("Service is temporarily unavailable.")
    except Exception:
        raise _safe_error("Unable to retrieve your plan. Please try again.")
    finally:
        if conn:
            try: conn.close()
            except: pass
    if row is None:
        raise HTTPException(status_code=404, detail="Not found.")
    plan = {
        "location": row["location"],
        "shootDate": str(row["shoot_date"]),
        "startTime": str(row["start_time"])[:5],
        "duration": row["duration"],
        "shootTypes": row["shoot_types"],
        "people": row["people"],
        "equipment": row["equipment"],
        "lightingPlan": row["lighting_plan"],
        "accessNotes": row["access_notes"],
        "consent": row["consent"],
    }
    created_at = row["created_at"]
    if isinstance(created_at, datetime):
        created_at_str = created_at.isoformat()
    else:
        created_at_str = str(created_at)
    return PlanDetailResponse(reference=row["reference"], plan=plan, createdAt=created_at_str)
