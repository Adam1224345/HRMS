import sqlite3
import psycopg2
import os

# --- CONFIGURATION ---
SQLITE_DB = "src/database/new_app.db" 
NEON_URL = "postgresql://neondb_owner:npg_x8KPZuq3opyk@ep-muddy-darkness-a16txpfz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Tables required for full functionality
REQUIRED_TABLES = ['users', 'role', 'permission', 'user_roles', 'role_permissions', 'audit_logs', 'notifications', 'task', 'leave', 'document'] 

def migrate():
    print(f"--- MIGRATING DATA FROM {SQLITE_DB} TO NEON DB ---")
    
    if not os.path.exists(SQLITE_DB):
        print(f"CRITICAL ERROR: Database file {SQLITE_DB} not found! Check path.")
        return

    # Connect to SQLite (Source)
    sqlite = sqlite3.connect(SQLITE_DB)
    sqlite.row_factory = sqlite3.Row
    scur = sqlite.cursor()

    # Connect to Neon (Destination)
    try:
        pg = psycopg2.connect(NEON_URL)
        pcur = pg.cursor()
    except Exception as e:
        print(f"Neon Connection Error: {e}")
        return

    # Get all table names in the source DB to check against REQUIRED_TABLES
    scur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    source_tables = [row[0] for row in scur.fetchall()]
    
    for target_table_name in REQUIRED_TABLES:
        source_table_name = target_table_name # Table names match in new_app.db
        
        if source_table_name not in source_tables:
            print(f"\n[WARNING] Source table '{source_table_name}' not found. Skipping.")
            continue

        print(f"\nProcessing table: {target_table_name}")

        # 1. Drop Target in Neon
        pcur.execute(f'DROP TABLE IF EXISTS "{target_table_name}" CASCADE')
        pg.commit()

        # 2. Analyze and Create Table in Neon
        scur.execute(f"PRAGMA table_info(`{source_table_name}`)")
        cols = scur.fetchall()

        pk_columns = [col[1] for col in cols if col[5] > 0]
        is_composite_pk = len(pk_columns) > 1

        col_defs = []
        for col in cols:
            name, type_ = col[1], col[2].upper()
            notnull, is_pk = col[3], col[5] > 0

            # Map Types
            pg_type = "SERIAL PRIMARY KEY" if is_pk and not is_composite_pk and "INT" in type_ else \
                      "INTEGER" if "INT" in type_ else \
                      "TEXT" if "TEXT" in type_ or "VARCHAR" in type_ or "CHAR" in type_ else \
                      "DOUBLE PRECISION" if "REAL" in type_ or "FLOAT" in type_ else \
                      "BOOLEAN" if "BOOL" in type_ else \
                      "TIMESTAMP" if "DATE" in type_ or "TIME" in type_ else "TEXT"
            
            col_def = f'"{name}" {pg_type}'
            if notnull and not is_pk:
                col_def += " NOT NULL"
            col_defs.append(col_def)

        if is_composite_pk:
            quoted_pks = [f'"{c}"' for c in pk_columns]
            col_defs.append(f"PRIMARY KEY ({', '.join(quoted_pks)})")

        create_sql = f'CREATE TABLE "{target_table_name}" ({", ".join(col_defs)})'
        try:
            pcur.execute(create_sql)
            pg.commit()
        except Exception as e:
            print(f"   Error creating table: {e}")
            pg.rollback()
            continue

        # 3. Copy Data
        scur.execute(f'SELECT * FROM "{source_table_name}"')
        rows = scur.fetchall()
        
        if rows:
            columns = rows[0].keys()
            safe_cols = ', '.join([f'"{c}"' for c in columns])
            placeholders = ', '.join(['%s'] * len(columns))
            insert_sql = f'INSERT INTO "{target_table_name}" ({safe_cols}) VALUES ({placeholders})'

            # Convert rows for PostgreSQL, handling Boolean (0/1) types
            data = []
            for row in rows:
                mapped_row = []
                for i, col in enumerate(row):
                    # Check for common boolean columns and convert 0/1 to False/True
                    if columns[i] in ['is_active', 'is_read'] and col in (0, 1):
                        mapped_row.append(True if col == 1 else False)
                    else:
                        mapped_row.append(col)
                data.append(tuple(mapped_row))

            try:
                pcur.executemany(insert_sql, data)
                pg.commit()
                print(f"   -> Successfully copied {len(rows)} rows to Neon!")
            except Exception as e:
                print(f"   CRITICAL INSERTION ERROR: {e}")
                pg.rollback()
                continue

            # 4. Reset Sequence (FIXED LOGIC)
            if not is_composite_pk and pk_columns:
                pk_col = pk_columns[0]
                # Only reset if the primary key column is determined to be an INTEGER/SERIAL type
                pk_col_type = next((c[2].upper() for c in cols if c[1] == pk_col), '')
                
                if "INT" in pk_col_type:
                    try:
                        pcur.execute(f"""
                            SELECT setval(
                                pg_get_serial_sequence('"{target_table_name}"', '{pk_col}'), 
                                COALESCE((SELECT MAX("{pk_col}") FROM "{target_table_name}"), 1),
                                TRUE
                            );
                        """)
                        pg.commit()
                        print("   -> Sequence reset (IDs synced)")
                    except Exception:
                        pg.rollback()
        else:
            print("   -> Table is empty")

    # Cleanup
    scur.close()
    sqlite.close()
    pcur.close()
    pg.close()
    print("\n--- FINAL MIGRATION ATTEMPT COMPLETE! ---")

if __name__ == '__main__':
    migrate()