"""Small, idempotent upgrades for existing local SQLite and MySQL databases."""
from sqlalchemy import inspect, text


def migrate_portfolio(engine):
    inspector = inspect(engine)
    if "projects" not in inspector.get_table_names():
        return
    if "is_portfolio" in {column["name"] for column in inspector.get_columns("projects")}:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE projects ADD COLUMN is_portfolio BOOLEAN NOT NULL DEFAULT 0"))
        # Preserve all projects already published by the portfolio owner.
        connection.execute(text("UPDATE projects SET is_portfolio = 1 WHERE is_public = 1 "
                                "AND owner_id IN (SELECT id FROM users WHERE role = 'OWNER')"))
