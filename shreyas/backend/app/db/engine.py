from sqlalchemy import create_engine, text

DATABASE_URL = "sqlite:///./savemom.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=True,
    implicit_returning=False,
)


def _ensure_sqlite_column(table: str, column: str, definition: str):
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        result = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        existing = {row[1] for row in result}
        if column not in existing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


# Lightweight fallback migration for local SQLite dev
_ensure_sqlite_column("users", "hospital_id", "VARCHAR")
_ensure_sqlite_column("doctors", "user_id", "VARCHAR")
_ensure_sqlite_column("appointments", "doctor_id", "VARCHAR")
_ensure_sqlite_column("appointments", "hospital_id", "VARCHAR")
_ensure_sqlite_column("appointments", "department", "VARCHAR")
_ensure_sqlite_column("appointments", "appointment_date", "DATE")
_ensure_sqlite_column("appointments", "time_slot", "VARCHAR")
_ensure_sqlite_column("appointments", "reason", "VARCHAR")
_ensure_sqlite_column("appointments", "symptoms", "VARCHAR")
_ensure_sqlite_column("appointments", "status", "VARCHAR")
_ensure_sqlite_column("appointments", "priority", "VARCHAR DEFAULT 'normal'")
_ensure_sqlite_column("checkups", "priority", "VARCHAR DEFAULT 'normal'")
_ensure_sqlite_column("checkups", "report_url", "VARCHAR")
_ensure_sqlite_column("checkups", "remarks", "TEXT")
_ensure_sqlite_column("doctor_availability", "hospital_id", "VARCHAR")
_ensure_sqlite_column("doctor_availability", "start_time", "VARCHAR")
_ensure_sqlite_column("doctor_availability", "end_time", "VARCHAR")
_ensure_sqlite_column("doctor_availability", "slot_duration", "INTEGER")
_ensure_sqlite_column("doctor_availability", "status", "VARCHAR DEFAULT 'available'")

if DATABASE_URL.startswith("sqlite"):
    with engine.begin() as conn:
        conn.execute(text("UPDATE appointments SET doctor_id = '' WHERE doctor_id IS NULL"))
        conn.execute(text("UPDATE appointments SET priority = 'normal' WHERE priority IS NULL"))
        conn.execute(text("UPDATE checkups SET priority = 'normal' WHERE priority IS NULL"))
