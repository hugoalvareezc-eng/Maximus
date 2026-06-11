import sqlite3
import psycopg2
import sys

# Pega aquí exactamente la misma URL de Supabase que usaste (con la contraseña nueva)
DATABASE_URL = "postgresql://postgres:Minions2017hugo0@db.itfpekrncoligixkuobb.supabase.co:5432/postgres"

def migrar():
    print("Conectando a las bases de datos...")
    
    # 1. Conexión a tu archivo local
    try:
        sqlite_conn = sqlite3.connect("gimnasio.db")
        sqlite_cursor = sqlite_conn.cursor()
    except Exception as e:
        print(f"Error abriendo gimnasio.db local: {e}")
        return

    # 2. Conexión a la nube (Supabase)
    try:
        pg_conn = psycopg2.connect(DATABASE_URL)
        pg_cursor = pg_conn.cursor()
    except Exception as e:
        print(f"Error conectando a Supabase: {e}")
        return

    try:
        # --- CREAR TABLAS PRIMERO ---
        print("Construyendo la estructura de la base de datos en Supabase...")
        pg_cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id SERIAL PRIMARY KEY,
            nombre TEXT UNIQUE NOT NULL,
            tipo_pago TEXT NOT NULL,
            fecha_inicio TEXT NOT NULL,
            fecha_vencimiento TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ingresos_diarios (
            id SERIAL PRIMARY KEY,
            fecha TEXT NOT NULL,
            concepto TEXT NOT NULL,
            monto REAL NOT NULL,
            es_gasto BOOLEAN NOT NULL DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS inventario (
            producto TEXT PRIMARY KEY NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS deudores (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            concepto TEXT NOT NULL,
            monto_deuda REAL NOT NULL,
            fecha_creacion TEXT NOT NULL,
            UNIQUE(nombre, concepto)
        );
        """)
        pg_conn.commit()

        # --- MIGRAR CLIENTES ---
        print("Subiendo clientes...")
        sqlite_cursor.execute("SELECT nombre, tipo_pago, fecha_inicio, fecha_vencimiento FROM clientes")
        for c in sqlite_cursor.fetchall():
            pg_cursor.execute(
                "INSERT INTO clientes (nombre, tipo_pago, fecha_inicio, fecha_vencimiento) VALUES (%s, %s, %s, %s) ON CONFLICT (nombre) DO NOTHING",
                (c[0], c[1], c[2], c[3])
            )

        # --- MIGRAR INVENTARIO ---
        print("Actualizando inventario...")
        sqlite_cursor.execute("SELECT producto, stock FROM inventario")
        # Asegurarnos de que los productos existan primero
        productos = ["Agua", "Amper", "Barra", "Cafe", "Proteina", "Preentreno", "Creatina"]
        for prod in productos:
            pg_cursor.execute("INSERT INTO inventario (producto, stock) VALUES (%s, 0) ON CONFLICT (producto) DO NOTHING", (prod,))
            
        for i in sqlite_cursor.fetchall():
            pg_cursor.execute(
                "UPDATE inventario SET stock = %s WHERE producto = %s",
                (i[1], i[0])
            )

        # --- MIGRAR INGRESOS Y GASTOS (HISTORIAL) ---
        print("Subiendo el historial de caja...")
        sqlite_cursor.execute("SELECT fecha, concepto, monto, es_gasto FROM ingresos_diarios")
        for ing in sqlite_cursor.fetchall():
            es_gasto = bool(ing[3]) 
            pg_cursor.execute(
                "INSERT INTO ingresos_diarios (fecha, concepto, monto, es_gasto) VALUES (%s, %s, %s, %s)",
                (ing[0], ing[1], ing[2], es_gasto)
            )

        # --- MIGRAR DEUDORES ---
        print("Subiendo lista de deudores...")
        sqlite_cursor.execute("SELECT nombre, concepto, monto_deuda, fecha_creacion FROM deudores")
        for d in sqlite_cursor.fetchall():
            pg_cursor.execute(
                "INSERT INTO deudores (nombre, concepto, monto_deuda, fecha_creacion) VALUES (%s, %s, %s, %s) ON CONFLICT (nombre, concepto) DO NOTHING",
                (d[0], d[1], d[2], d[3])
            )

        pg_conn.commit()
        print("\n✅ ¡MIGRACIÓN COMPLETADA CON ÉXITO! Tus datos ya están en la nube.")

    except Exception as e:
        print(f"\n❌ Error durante la migración: {e}")
        pg_conn.rollback()
    finally:
        sqlite_conn.close()
        pg_conn.close()

if __name__ == "__main__":
    migrar()