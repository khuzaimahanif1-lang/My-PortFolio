from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"Backend"))
from sqlalchemy.schema import CreateTable,CreateIndex
from sqlalchemy.dialects import mysql
from app.core.database import Base
from app import models
out=Path(__file__).resolve().parents[1]/"docs"/"mysql-schema.sql"
dialect=mysql.dialect()
statements=["-- Generated from the same SQLAlchemy models used by the API.\n-- Apply to a new database; never use this file to overwrite an existing schema.\n"]
for table in Base.metadata.sorted_tables:
    statements.append(str(CreateTable(table).compile(dialect=dialect))+";\n")
    for index in table.indexes:
        statements.append(str(CreateIndex(index).compile(dialect=dialect))+";\n")
out.write_text("\n".join(statements),encoding="utf-8")
print("Exported MySQL schema:",len(Base.metadata.tables),"tables")

