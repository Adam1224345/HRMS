import sqlite3
import psycopg2
import os

# --- CONFIGURATION ---
# 1. Source: Your local SQLite database (already has 'users' table)
SQLITE_DB = "src/database/new_app.db"

# 2. Destination: Your NEW Neon PostgreSQL URL
NEON_URL = "postgresql://neondb_owner:npg_x8KPZuq3opyk@ep-muddy-darkness-a16txpfz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

def migrate():
    print(f"--- MIGRATING DATA TO NEON DB ---")
    print(f"Source: {SQLITE_DB}")
    
    if not os.path.exists(SQLITE_DB):
        print(f"ERROR: Database file {SQLITE_DB} not found!")
        return

    # Connect to SQLite
    try:
        sqlite = sqlite3.connect(SQLITE_DB)
        sqlite.row_factory = sqlite3.Row
        scur = sqlite.cursor()
    except Exception as e:
        print(f"SQLite Connection Error: {e}")
        return

    # Connect to Neon (Postgres)
    try:
        pg = psycopg2.connect(NEON_URL)
        pcur = pg.cursor()
    except Exception as e:
        print(f"Postgres Connection Error: {e}")
        return

    # Get all tables from SQLite
    scur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in scur.fetchall()]

    for table in tables:
        # Skip internal SQLite tables
        if table.startswith("sqlite_"):
            continue

        print(f"\nProcessing table: {table}")

        # 1. Drop table in Postgres to ensure a clean slate
        try:
            pcur.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')
            pg.commit()
        except Exception as e:
            print(f"   Error dropping table: {e}")
            pg.rollback()

        # 2. Analyze columns to generate CREATE TABLE statement
        scur.execute(f"PRAGMA table_info(`{table}`)")
        cols = scur.fetchall()

        # Identify Primary Keys
        pk_columns = [col[1] for col in cols if col[5] > 0]
        is_composite_pk = len(pk_columns) > 1

        col_defs = []
        for col in cols:
            name = col[1]
            type_ = col[2].upper()
            notnull = col[3]
            is_pk = col[5] > 0

            # Map SQLite types to Postgres types
            if is_pk and not is_composite_pk and "INT" in type_:
                pg_type = "SERIAL PRIMARY KEY"
            elif "INT" in type_:
                pg_type = "INTEGER"
            elif "TEXT" in type_ or "VARCHAR" in type_ or "CHAR" in type_:
                pg_type = "TEXT"
            elif "REAL" in type_ or "FLOAT" in type_ or "DOUBLE" in type_:
                pg_type = "DOUBLE PRECISION"
            elif "BOOL" in type_:
                pg_type = "BOOLEAN"
            elif "DATE" in type_ or "TIME" in type_:
                pg_type = "TIMESTAMP"
            else:
                pg_type = "TEXT"

            col_def = f'"{name}" {pg_type}'
            # Add NOT NULL constraint (PKs are implicitly NOT NULL)
            if notnull and not is_pk:
                col_def += " NOT NULL"
            
            col_defs.append(col_def)

        # Handle Composite Keys (like in user_roles)
        if is_composite_pk:
            quoted_pks = [f'"{c}"' for c in pk_columns]
            col_defs.append(f"PRIMARY KEY ({', '.join(quoted_pks)})")

        # 3. Create Table in Postgres
        create_sql = f'CREATE TABLE "{table}" ({", ".join(col_defs)})'
        try:
            pcur.execute(create_sql)
            pg.commit()
        except Exception as e:
            print(f"   Error creating table: {e}")
            pg.rollback()
            continue

        # 4. Copy Data
        scur.execute(f'SELECT * FROM "{table}"')
        rows = scur.fetchall()

        if rows:
            # Generate INSERT statement
            columns = rows[0].keys()
            safe_cols = ', '.join([f'"{c}"' for c in columns])
            placeholders = ', '.join(['%s'] * len(columns))
            insert_sql = f'INSERT INTO "{table}" ({safe_cols}) VALUES ({placeholders})'

            data = [tuple(row) for row in rows]
            try:
                pcur.executemany(insert_sql, data)
                pg.commit()
                print(f"   -> Copied {len(rows)} rows")
            except Exception as e:
                print(f"   Error inserting data: {e}")
                pg.rollback()

            # 5. Reset Sequence (Crucial for SERIAL IDs)
            # If we inserted ID 5 manually, Postgres needs to know the next ID is 6
            if not is_composite_pk and any("INT" in c[2].upper() for c in cols if c[5] > 0):
                pk_col = pk_columns[0]
                try:
                    # Sync the SERIAL sequence to the max ID in the table
                    pcur.execute(f"""
                        SELECT setval(
                            pg_get_serial_sequence('"{table}"', '{pk_col}'), 
                            COALESCE((SELECT MAX("{pk_col}") FROM "{table}"), 1)
                        );
                    """)
                    pg.commit()
                    print("   -> Sequence reset (IDs synced)")
                except Exception as e:
                    # Sometimes fails if table name/seq name don't match exactly, safe to ignore usually
                    pg.rollback()
        else:
            print("   -> Table is empty")

    # Cleanup
    scur.close()
    sqlite.close()
    pcur.close()
    pg.close()
    print("\n--- MIGRATION COMPLETE! ---")

if __name__ == '__main__':
    migrate()