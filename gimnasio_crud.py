import psycopg2
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import sys  
import os   
import time  # <-- Asegúrate de importar time

# --- FORZAR HORA DE MÉXICO CENTRAL ---
os.environ['TZ'] = 'America/Mexico_City'
time.tzset()

# --- CONFIGURACIÓN DE LA BASE DE DATOS ---
# La URL de conexión se obtiene directamente de las variables de entorno de Render
DATABASE_URL = os.environ.get("DATABASE_URL")

def crear_conexion():
    """Crea una conexión a la base de datos PostgreSQL en Supabase."""
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Error al conectar a la base de datos: {e}", file=sys.stderr)
        return None

def crear_tablas(conn):
    """Crea todas las tablas (clientes, ingresos, inventario, deudores) si no existen."""
    try:
        cursor = conn.cursor()

        # Tabla Clientes
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id SERIAL PRIMARY KEY,
            nombre TEXT UNIQUE NOT NULL,
            tipo_pago TEXT NOT NULL,
            fecha_inicio TEXT NOT NULL,
            fecha_vencimiento TEXT NOT NULL
        );
        """)

        # Tabla Ingresos
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS ingresos_diarios (
            id SERIAL PRIMARY KEY,
            fecha TEXT NOT NULL,
            concepto TEXT NOT NULL,
            monto REAL NOT NULL,
            es_gasto BOOLEAN NOT NULL DEFAULT FALSE
        );
        """)

        # Tabla Inventario
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS inventario (
            producto TEXT PRIMARY KEY NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0
        );
        """)

        # Tabla Deudores
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS deudores (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            concepto TEXT NOT NULL,
            monto_deuda REAL NOT NULL,
            fecha_creacion TEXT NOT NULL,
            UNIQUE(nombre, concepto)
        );
        """)

        conn.commit()

        # Inicializar inventario
        productos = ["Agua", "Amper", "Barra", "Cafe", "Proteina", "Preentreno", "Creatina"]
        for producto in productos:
            cursor.execute(
                "INSERT INTO inventario (producto, stock) VALUES (%s, 0) ON CONFLICT (producto) DO NOTHING",
                (producto,)
            )
        conn.commit()
        cursor.close()

    except Exception as e:
        print(f"Error al crear tablas: {e}", file=sys.stderr)

def inicializar_bd():
    """Conecta a la BD y asegura que todas las tablas existan."""
    conn = crear_conexion()
    if conn:
        crear_tablas(conn)
        conn.close()

# --- FUNCIONES DE MANEJO DE FECHA ---
def calcular_vencimiento(fecha_base_str, meses=0, semanas=0):
    """Calcula la nueva fecha de vencimiento a partir de una fecha base."""
    try:
        fecha_base = datetime.strptime(fecha_base_str, '%Y-%m-%d')
        nueva_fecha = fecha_base + relativedelta(months=meses) + timedelta(days=semanas * 7)
        return nueva_fecha.strftime('%Y-%m-%d')
    except ValueError:
        return None

# --- FUNCIONES CRUD Y LÓGICA DE VENCIMIENTO ---
def obtener_vencimiento_actual(nombre):
    """Busca la fecha de vencimiento actual de un cliente por su nombre."""
    conn = crear_conexion()
    if conn is None: return None
    cursor = conn.cursor()
    cursor.execute("SELECT fecha_vencimiento FROM clientes WHERE nombre = %s", (nombre,))
    resultado = cursor.fetchone()
    cursor.close()
    conn.close()
    return resultado[0] if resultado else None

def registrar_pago_cliente(nombre, tipo_pago, monto_total_membresia, monto_pagado_hoy, meses=0, semanas=0):
    """
    Registra el pago (completo O abono) de una membresía.
    1. Activa su membresía (calcula nuevo vencimiento).
    2. Registra el 'monto_pagado_hoy' en la caja del día.
    3. Si hay un restante, lo añade a la tabla 'deudores'.
    """
    conn = crear_conexion()
    if conn is None: return False
    hoy_dt = (datetime.utcnow() - timedelta(hours=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    hoy_str = hoy_dt.strftime('%Y-%m-%d')
    vencimiento_existente_str = obtener_vencimiento_actual(nombre)
    
    # Lógica de fecha de inicio de membresía
    fecha_base_calculo = hoy_str # Por defecto, la membresía corre desde HOY
    if vencimiento_existente_str:
        vencimiento_existente_dt = datetime.strptime(vencimiento_existente_str, '%Y-%m-%d')
        if vencimiento_existente_dt > hoy_dt: # Si paga por adelantado
            fecha_base_calculo = vencimiento_existente_dt.strftime('%Y-%m-%d')
    
    nueva_fecha_vencimiento = calcular_vencimiento(fecha_base_calculo, meses=meses, semanas=semanas)

    try:
        cursor = conn.cursor()
        # 1. Registrar el INGRESO (solo lo que pagó hoy)
        registrar_ingreso(hoy_str, f"Pago de {nombre} ({tipo_pago})", monto_pagado_hoy, conn=conn)
        
        # 2. Actualizar o Insertar Cliente (con la nueva fecha de vencimiento)
        if vencimiento_existente_str:
            cursor.execute("UPDATE clientes SET tipo_pago = %s, fecha_vencimiento = %s WHERE nombre = %s", (tipo_pago, nueva_fecha_vencimiento, nombre))
        else:
             cursor.execute("INSERT INTO clientes (nombre, tipo_pago, fecha_inicio, fecha_vencimiento) VALUES (%s, %s, %s, %s)", (nombre, tipo_pago, hoy_str, nueva_fecha_vencimiento))

        # 3. Manejar la DEUDA (si pagó menos del total)
        monto_restante = monto_total_membresia - monto_pagado_hoy
        if monto_restante > 0.001: # Usar tolerancia para flotantes
            concepto_deuda = f"Resta {tipo_pago}"
            agregar_deuda(nombre, concepto_deuda, monto_restante, conn=conn)
            
        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al registrar pago: {e}", file=sys.stderr)
        conn.rollback()
        return False
    finally:
        conn.close()

# --- FUNCIONES INGRESOS/GASTOS ---
def registrar_ingreso(fecha, concepto, monto, conn=None):
    """Registra ingresos y actualiza el stock si es un producto."""
    close_conn = False
    if conn is None:
        conn = crear_conexion()
        close_conn = True
    if conn is None: return False
    
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO ingresos_diarios (fecha, concepto, monto, es_gasto) VALUES (%s, %s, %s, FALSE)", (fecha, concepto, monto))
        
        # Lógica de Inventario
        productos_inventario = ["Agua", "Amper", "Barra", "Cafe", "Proteina", "Preentreno", "Creatina"]
        
        # Evitar descontar stock si el concepto es un pago/abono que incluye el nombre del producto
        is_payment_concept = "Pago de" in concepto or "Abono de" in concepto or "Resta" in concepto
        
        if concepto in productos_inventario and not is_payment_concept:
            # Descontar stock solo si es una venta directa del producto (usando GREATEST en lugar de MAX)
            cursor.execute("UPDATE inventario SET stock = GREATEST(0, stock - 1) WHERE producto = %s", (concepto,))
            
        if close_conn: conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al registrar ingreso: {e}", file=sys.stderr)
        if close_conn: conn.rollback()
        return False
    finally:
        if close_conn and conn: conn.close()

def registrar_gasto(fecha, concepto, monto):
    """Registra gastos."""
    conn = crear_conexion()
    if conn is None: return False
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO ingresos_diarios (fecha, concepto, monto, es_gasto) VALUES (%s, %s, %s, TRUE)", (fecha, concepto, monto))
        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al registrar gasto: {e}", file=sys.stderr)
        return False
    finally:
        conn.close()

# --- FUNCIONES DE CONSULTA (Vencidos, Agenda) ---
def obtener_vencidos(fecha_actual):
    conn = crear_conexion()
    if conn is None: return []
    cursor = conn.cursor()
    cursor.execute("SELECT nombre, fecha_vencimiento FROM clientes WHERE fecha_vencimiento <= %s ORDER BY fecha_vencimiento ASC", (fecha_actual,))
    vencidos = cursor.fetchall()
    cursor.close()
    conn.close()
    return vencidos
    
def obtener_proximos_vencimientos(fecha_actual):
    conn = crear_conexion()
    if conn is None: return []
    cursor = conn.cursor()
    cursor.execute("SELECT nombre, fecha_vencimiento FROM clientes WHERE fecha_vencimiento > %s ORDER BY fecha_vencimiento ASC", (fecha_actual,))
    proximos = cursor.fetchall()
    cursor.close()
    conn.close()
    return proximos
    
def eliminar_cliente(nombre):
    conn = crear_conexion()
    if conn is None: return False
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM clientes WHERE nombre = %s", (nombre,))
        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al eliminar cliente: {e}", file=sys.stderr)
        return False
    finally:
        conn.close()

def obtener_resumen_diario(fecha):
    conn = crear_conexion()
    if conn is None: return 0.0, 0.0
    cursor = conn.cursor()
    cursor.execute("SELECT SUM(monto) FROM ingresos_diarios WHERE fecha = %s AND es_gasto = FALSE", (fecha,))
    total_ingresos = cursor.fetchone()[0] or 0.0
    cursor.execute("SELECT SUM(monto) FROM ingresos_diarios WHERE fecha = %s AND es_gasto = TRUE", (fecha,))
    total_gastos = cursor.fetchone()[0] or 0.0
    cursor.close()
    conn.close()
    return total_ingresos, total_gastos

def actualizar_vencimiento_manual(nombre, fecha_vencimiento_str):
    """Inserta o actualiza un cliente con una fecha de vencimiento específica."""
    conn = crear_conexion()
    if conn is None: return False
    hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
    nombre_limpio = nombre.strip().title()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM clientes WHERE nombre = %s", (nombre_limpio,))
        cliente_id = cursor.fetchone()
        if cliente_id:
            cursor.execute("UPDATE clientes SET fecha_vencimiento = %s WHERE id = %s", (fecha_vencimiento_str, cliente_id[0]))
        else:
             cursor.execute("INSERT INTO clientes (nombre, tipo_pago, fecha_inicio, fecha_vencimiento) VALUES (%s, 'Manual', %s, %s)", (nombre_limpio, hoy_str, fecha_vencimiento_str))
        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al actualizar vencimiento manualmente: {e}", file=sys.stderr)
        return False
    finally:
        conn.close()

# --- FUNCIONES DE INVENTARIO ---
def obtener_inventario():
    conn = crear_conexion()
    if conn is None: return {}
    cursor = conn.cursor()
    cursor.execute("SELECT producto, stock FROM inventario")
    inventario = dict(cursor.fetchall())
    cursor.close()
    conn.close()
    return inventario

def resetear_registros_diarios(fecha):
    """
    Modificado: Ya NO borramos los datos. 
    Solo devolvemos True para que el historial pueda guardar todo para siempre.
    """
    return True

def actualizar_stock(producto, cantidad_cambio):
    conn = crear_conexion()
    if conn is None: return False
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE inventario SET stock = GREATEST(0, stock + %s) WHERE producto = %s", (cantidad_cambio, producto))
        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al actualizar stock: {e}", file=sys.stderr)
        return False
    finally:
        conn.close()

# --- FUNCIONES PARA DEUDORES ---
def obtener_deudores():
    """Devuelve una lista de deudores y sus deudas agrupadas."""
    conn = crear_conexion()
    if conn is None: return []
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, concepto, monto_deuda FROM deudores WHERE monto_deuda > 0.001 ORDER BY nombre, id")
    deudas_raw = cursor.fetchall()
    cursor.close()
    conn.close()
    deudores_agrupados = {}
    for id_deuda, nombre, concepto, monto in deudas_raw:
        nombre_key = nombre.strip().title()
        if nombre_key not in deudores_agrupados:
            deudores_agrupados[nombre_key] = {"nombre": nombre_key, "deudas": [], "total_deuda": 0.0}
        deudores_agrupados[nombre_key]["deudas"].append({"id": id_deuda, "concepto": concepto, "monto": monto})
        deudores_agrupados[nombre_key]["total_deuda"] += monto
    return list(deudores_agrupados.values())

def agregar_deuda(nombre, concepto, monto, conn=None):
    """Añade una nueva deuda o actualiza una existente (suma el monto)."""
    close_conn = False
    if conn is None:
        conn = crear_conexion()
        close_conn = True
    if conn is None: return False
    hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
    nombre_limpio = nombre.strip().title()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, monto_deuda FROM deudores WHERE nombre = %s AND concepto = %s", (nombre_limpio, concepto))
        deuda_existente = cursor.fetchone()
        if deuda_existente:
            id_deuda, monto_actual = deuda_existente
            nuevo_monto = monto_actual + monto
            cursor.execute("UPDATE deudores SET monto_deuda = %s WHERE id = %s", (nuevo_monto, id_deuda))
        else:
            cursor.execute("INSERT INTO deudores (nombre, concepto, monto_deuda, fecha_creacion) VALUES (%s, %s, %s, %s)", (nombre_limpio, concepto, monto, hoy_str))
        if close_conn: conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al agregar deuda: {e}", file=sys.stderr)
        if close_conn: conn.rollback()
        return False
    finally:
        if close_conn and conn: conn.close()

def pagar_deuda(deuda_id, monto_abono, registrar_en_caja=True):
    """
    Registra un abono a una deuda específica.
    registrar_en_caja: Si es False, solo baja la deuda pero no suma al ingreso diario.
    """
    conn = crear_conexion()
    if conn is None: return False
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT nombre, concepto, monto_deuda FROM deudores WHERE id = %s", (deuda_id,))
        deuda_info = cursor.fetchone()
        if not deuda_info: return False
        nombre, concepto, monto_actual = deuda_info
        
        # Corregir monto si se intenta pagar más de lo debido
        monto_abono_real = min(monto_abono, monto_actual)
        if monto_abono_real <= 0: return False # No pagar 0 o negativo

        hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
        
        exito_ingreso = True
        if registrar_en_caja:
            concepto_ingreso = f"Abono de {nombre} ({concepto})"
            if not registrar_ingreso(hoy_str, concepto_ingreso, monto_abono_real, conn=conn):
                exito_ingreso = False
        
        if not exito_ingreso:
            conn.rollback()
            return False

        nuevo_monto_deuda = monto_actual - monto_abono_real
        if nuevo_monto_deuda < 0.001: # Usar tolerancia para flotantes
            cursor.execute("DELETE FROM deudores WHERE id = %s", (deuda_id,))
        else:
            cursor.execute("UPDATE deudores SET monto_deuda = %s WHERE id = %s", (nuevo_monto_deuda, deuda_id))
        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al pagar deuda: {e}", file=sys.stderr)
        conn.rollback()
        return False
    finally:
        conn.close()

def pagar_deuda_total(nombre, monto_pagado_total, registrar_en_caja=True):
    """
    Aplica un pago al total de las deudas de un cliente.
    registrar_en_caja: Si es False, reduce la deuda pero no genera ingreso.
    """
    conn = crear_conexion()
    if conn is None: return False
    nombre_limpio = nombre.strip().title()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, concepto, monto_deuda FROM deudores WHERE nombre = %s AND monto_deuda > 0.001 ORDER BY id",
            (nombre_limpio,)
        )
        deudas_pendientes = cursor.fetchall()
        if not deudas_pendientes: return False # No hay deudas
        
        total_adeudado = sum(d[2] for d in deudas_pendientes)
        monto_pagado_real = min(monto_pagado_total, total_adeudado)
        if monto_pagado_real <= 0: return False # No pagar 0 o negativo

        hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
        
        if registrar_en_caja:
            concepto_ingreso = f"Pago/Abono Deuda Total de {nombre_limpio}"
            if not registrar_ingreso(hoy_str, concepto_ingreso, monto_pagado_real, conn=conn):
                conn.rollback() 
                return False

        monto_restante_pago = monto_pagado_real
        for deuda_id, concepto, monto_deuda_actual in deudas_pendientes:
            if monto_restante_pago < 0.001: break 
                
            pago_a_esta_deuda = min(monto_deuda_actual, monto_restante_pago)
            nuevo_monto_esta_deuda = monto_deuda_actual - pago_a_esta_deuda
            
            if nuevo_monto_esta_deuda < 0.001:
                cursor.execute("DELETE FROM deudores WHERE id = %s", (deuda_id,))
            else:
                cursor.execute("UPDATE deudores SET monto_deuda = %s WHERE id = %s", (nuevo_monto_esta_deuda, deuda_id))
            
            monto_restante_pago -= pago_a_esta_deuda 

        conn.commit()
        cursor.close()
        return True
    except Exception as e:
        print(f"Error al pagar deuda total: {e}", file=sys.stderr)
        conn.rollback()
        return False
    finally:
        conn.close()

def obtener_historial(fecha_inicio, fecha_fin):
    """Obtiene los ingresos y gastos en un rango de fechas."""
    conn = crear_conexion()
    if conn is None: return [], 0.0, 0.0
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT fecha, concepto, monto, es_gasto 
            FROM ingresos_diarios 
            WHERE fecha >= %s AND fecha <= %s 
            ORDER BY fecha DESC, id DESC
        """, (fecha_inicio, fecha_fin))
        registros = cursor.fetchall()
        
        # Calcular totales (comparación booleana explícita)
        total_ingresos = sum(r[2] for r in registros if r[3] == False)
        total_gastos = sum(r[2] for r in registros if r[3] == True)
        
        cursor.close()
        return registros, total_ingresos, total_gastos
    except Exception as e:
        print(f"Error al obtener historial: {e}", file=sys.stderr)
        return [], 0.0, 0.0
    finally:
        conn.close()
