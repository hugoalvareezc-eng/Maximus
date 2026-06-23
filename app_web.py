import sys
import os
from flask import Flask, render_template, request, jsonify, redirect, url_for
import gimnasio_crud as db
from datetime import datetime, timedelta
import locale

# --- Configuración Inicial ---
try:
    # Configurar locale para fechas en español
    locale.setlocale(locale.LC_TIME, 'es_ES.UTF-8')
except locale.Error:
    try:
        locale.setlocale(locale.LC_TIME, 'Spanish_Spain.1252')
    except locale.Error:
        try:
            locale.setlocale(locale.LC_TIME, 'es')
        except locale.Error:
             print("Advertencia: No se pudo configurar el idioma español para fechas.", file=sys.stderr)

# Inicializa la base de datos (crea tablas si no existen)
db.inicializar_bd()

# --- Constantes Globales de la Aplicación ---
PRECIOS = {
    "Mes Normal": 420.0,
    "Mes Estudiante": 370.0,
    "Semana": 200.0,
    "Visita": 50.0,
    "Agua": 15.0,
    "Amper": 25.0,
    "Barra": 25.0,
    "Cafe" : 20.0,
    "Proteina" : 25.0,
    "Preentreno" : 25.0,
    "Creatina" : 20.0
    # NOTA: Si agregas más productos, añádelos aquí
    # "Gatorade": 20.0
}

# Contraseña para el historial de ingresos
PASSWORD_HISTORIAL = "maximus123" # <-- Cambia esto por la contraseña que quieras

# Lista de productos que afectan el inventario (para validaciones)
PRODUCTOS_INVENTARIO = ["Agua", "Amper", "Barra", "Cafe", "Proteina", "Creatina", "Preentreno"] # Añade "Gatorade" aquí si lo agregas

TIEMPO = {
    "Mes Normal": {"meses": 1, "semanas": 0},
    "Mes Estudiante": {"meses": 1, "semanas": 0},
    "Semana": {"meses": 0, "semanas": 1},
    "Anualidad": {"meses": 12, "semanas": 0},
    "Semestre": {"meses": 6, "semanas": 0},
}

app = Flask(__name__)
# Evitar caché del navegador para mostrar siempre datos frescos
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# --- Rutas de las Páginas (HTML) ---

@app.route('/')
def index():
    """Página principal: Registro y Cierre Diario."""
    hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
    ingresos, gastos = db.obtener_resumen_diario(hoy_str)
    resumen = {
        "ingresos": ingresos,
        "gastos": gastos,
        "neto": ingresos - gastos
    }
    inventario = db.obtener_inventario()
    return render_template('index.html',
                           resumen=resumen,
                           inventario=inventario,
                           precios=PRECIOS)

@app.route('/vencidos')
def vencidos():
    """Página de Clientes Vencidos."""
    hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
    lista_vencidos = db.obtener_vencidos(hoy_str)
    return render_template('vencidos.html', vencidos=lista_vencidos, precios=PRECIOS, tiempo=TIEMPO)

@app.route('/agenda')
def agenda():
    """Página de Próximos Vencimientos."""
    hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
    lista_proximos = db.obtener_proximos_vencimientos(hoy_str)
    agenda_agrupada = {}
    for nombre, fecha_venc_str in lista_proximos:
        try:
            fecha_dt = datetime.strptime(fecha_venc_str, '%Y-%m-%d')
            # Usar nombre del mes localizado
            mes_key = fecha_dt.strftime('%B de %Y').capitalize()
        except ValueError:
            # Si la fecha está mal formateada, usarla directamente
             mes_key = f"Fecha inválida ({fecha_venc_str})"

        if mes_key not in agenda_agrupada:
            agenda_agrupada[mes_key] = []
        agenda_agrupada[mes_key].append({"nombre": nombre, "fecha": fecha_venc_str})
    return render_template('agenda.html', agenda_agrupada=agenda_agrupada)

@app.route('/inventario')
def inventario():
    """Página de Gestión de Inventario."""
    stock = db.obtener_inventario()
    return render_template('inventario.html', inventario=stock)

@app.route('/deudores')
def deudores():
    """Página de Cuentas por Cobrar."""
    lista_deudores = db.obtener_deudores()
    return render_template('deudores.html', deudores=lista_deudores)

@app.route('/historial')
def historial():
    """Página protegida de Historial de Ingresos."""
    return render_template('historial.html')

# --- API (Endpoints para JavaScript) ---

@app.route('/api/registrar_ingreso', methods=['POST'])
def api_registrar_ingreso():
    """API para registrar un ingreso (membresía, producto o abono)."""
    try:
        data = request.json
        tipo_ingreso = data.get('tipo')

        # --- CASO 1: Es una membresía ---
        if tipo_ingreso in TIEMPO or tipo_ingreso == "Otro (Meses)":
            nombre = data.get('nombre')
            monto_pagado_hoy = float(data.get('monto_pagado'))
            if not nombre or not nombre.strip():
                return jsonify({"exito": False, "error": "El nombre es obligatorio."}), 400
            nombre_limpio = nombre.strip().title()

            monto_total = 0.0
            tiempo_config = {}

            if tipo_ingreso in ["Anualidad", "Semestre"]:
                monto_total = float(data.get('monto_total', monto_pagado_hoy))
                tiempo_config = TIEMPO[tipo_ingreso]
            elif tipo_ingreso == "Otro (Meses)":
                 monto_total = float(data.get('monto_total', monto_pagado_hoy))
                 meses_otro = int(data.get('meses', 0))
                 if meses_otro <= 0: return jsonify({"exito": False, "error": "Número de meses inválido para 'Otro'."}), 400
                 tiempo_config = {"meses": meses_otro, "semanas": 0}
                 # Actualizar tipo_ingreso para que se guarde bien en BD
                 tipo_ingreso = f"Otro ({meses_otro} Meses)"
            else: # Membresías estándar
                monto_total = float(PRECIOS.get(tipo_ingreso, 0))
                tiempo_config = TIEMPO.get(tipo_ingreso)
                if not tiempo_config or monto_total <= 0:
                     return jsonify({"exito": False, "error": "Tipo de membresía estándar no válido."}), 400

            if monto_pagado_hoy > monto_total + 0.001: # Tolerancia flotante
                return jsonify({"exito": False, "error": f"El pago (${monto_pagado_hoy:.2f}) no puede ser mayor al costo total (${monto_total:.2f})."}), 400

            if db.registrar_pago_cliente(nombre_limpio, tipo_ingreso, monto_total, monto_pagado_hoy, tiempo_config["meses"], tiempo_config["semanas"]):
                mensaje = f"Pago de ${monto_pagado_hoy:.2f} registrado para {nombre_limpio}."
                if monto_total - monto_pagado_hoy > 0.001:
                    mensaje += f" Se añadió una deuda por ${monto_total - monto_pagado_hoy:.2f}."
                return jsonify({"exito": True, "mensaje": mensaje})
            else:
                return jsonify({"exito": False, "error": "Error al registrar pago de cliente en BD."}), 500

        # --- CASO 2: Es un producto o visita ---
        else:
            monto = float(PRECIOS.get(tipo_ingreso, 0))
            if monto <= 0:
                 return jsonify({"exito": False, "error": "Tipo de ingreso no reconocido o precio cero."}), 400

            hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
            if tipo_ingreso in PRODUCTOS_INVENTARIO:
                inventario = db.obtener_inventario()
                if inventario.get(tipo_ingreso, 0) < 1:
                    return jsonify({"exito": False, "error": f"No hay {tipo_ingreso} en stock."}), 400

            # Registrar el ingreso (esto ya descuenta stock si es producto)
            if db.registrar_ingreso(hoy_str, tipo_ingreso, monto):
                return jsonify({"exito": True, "mensaje": f"Venta de {tipo_ingreso} registrada."})
            else:
                return jsonify({"exito": False, "error": "Error al registrar ingreso en BD."}), 500

    except ValueError:
        return jsonify({"exito": False, "error": "Monto o cantidad inválida. Use solo números."}), 400
    except Exception as e:
        print(f"Error en /api/registrar_ingreso: {e}", file=sys.stderr)
        return jsonify({"exito": False, "error": f"Error interno del servidor: {e}"}), 500

@app.route('/api/registrar_vencimiento_manual', methods=['POST'])
def api_registrar_vencimiento_manual():
    """API para el botón de la página 'Agenda'."""
    try:
        data = request.json
        nombre = data.get('nombre')
        fecha = data.get('fecha')
        # Validar formato de fecha YYYY-MM-DD
        datetime.strptime(fecha, '%Y-%m-%d')
    except (ValueError, TypeError):
        return jsonify({"exito": False, "error": "Nombre y fecha (formato AAAA-MM-DD) son obligatorios."}), 400

    if not nombre or not nombre.strip():
        return jsonify({"exito": False, "error": "El nombre no puede estar vacío."}), 400

    if db.actualizar_vencimiento_manual(nombre, fecha):
        return jsonify({"exito": True, "mensaje": f"Vencimiento de {nombre.strip().title()} actualizado a {fecha}."})
    else:
        return jsonify({"exito": False, "error": "Error al actualizar vencimiento en BD."}), 500

@app.route('/api/registrar_gasto', methods=['POST'])
def api_registrar_gasto():
    """API para registrar un gasto rápido."""
    try:
        data = request.json
        monto = float(data.get('monto'))
        concepto = data.get('concepto', 'Gasto Rápido/Varios').strip()
    except (ValueError, TypeError):
        return jsonify({"exito": False, "error": "Monto inválido. Use solo números."}), 400

    if monto <= 0:
        return jsonify({"exito": False, "error": "El monto debe ser positivo."}), 400
    if not concepto: concepto = "Gasto Rápido/Varios" # Asegurar un concepto

    hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
    if db.registrar_gasto(hoy_str, concepto, monto):
        return jsonify({"exito": True, "mensaje": "Gasto registrado."})
    else:
        return jsonify({"exito": False, "error": "Error al registrar gasto en BD."}), 500

@app.route('/api/cerrar_dia', methods=['POST'])
def api_cerrar_dia():
    """API para el cierre de día."""
    try:
        data = request.json
        gasto_adicional = float(data.get('gasto_adicional', 0))
    except (ValueError, TypeError):
         return jsonify({"exito": False, "error": "Monto de gasto adicional inválido. Use solo números."}), 400

    if gasto_adicional < 0:
         return jsonify({"exito": False, "error": "El gasto adicional no puede ser negativo."}), 400

    hoy_str = (datetime.utcnow() - timedelta(hours=6)).strftime('%Y-%m-%d')
    if gasto_adicional > 0:
        db.registrar_gasto(hoy_str, "Gasto Cierre de Día", gasto_adicional)

    ingresos, gastos = db.obtener_resumen_diario(hoy_str)
    neto = ingresos - gastos

    if db.resetear_registros_diarios(hoy_str):
        return jsonify({
            "exito": True,
            "mensaje": "Día cerrado y registros reseteados.",
            "resumen_final": {"ingresos": ingresos, "gastos": gastos, "neto": neto}
        })
    else:
        # Intentar devolver el resumen aunque falle el reseteo
        print(f"Error: No se pudieron resetear los registros del día {hoy_str}", file=sys.stderr)
        return jsonify({
            "exito": False,
            "error": "Error al resetear los registros del día (pero el resumen final se muestra).",
             "resumen_final": {"ingresos": ingresos, "gastos": gastos, "neto": neto}
        }), 500

@app.route('/api/eliminar_cliente', methods=['POST'])
def api_eliminar_cliente():
    """API para eliminar un cliente."""
    try:
        data = request.json
        nombre = data.get('nombre')
    except: return jsonify({"exito": False, "error": "Datos inválidos."}), 400

    if not nombre or not nombre.strip():
        return jsonify({"exito": False, "error": "Nombre no proporcionado."}), 400

    if db.eliminar_cliente(nombre.strip().title()):
        return jsonify({"exito": True, "mensaje": f"Cliente {nombre.strip().title()} eliminado."})
    else:
        return jsonify({"exito": False, "error": f"Error al eliminar a {nombre.strip().title()}."}), 500

@app.route('/api/ajustar_stock', methods=['POST'])
def api_ajustar_stock():
    """API para añadir o restar stock."""
    try:
        data = request.json
        producto = data.get('producto')
        cantidad = int(data.get('cantidad'))
    except (ValueError, TypeError):
         return jsonify({"exito": False, "error": "Cantidad inválida. Use solo números enteros."}), 400

    if not producto or producto not in PRODUCTOS_INVENTARIO:
        return jsonify({"exito": False, "error": "Producto no válido."}), 400
    if cantidad == 0:
        return jsonify({"exito": False, "error": "La cantidad no puede ser cero."}), 400

    if db.actualizar_stock(producto, cantidad):
        return jsonify({"exito": True, "mensaje": f"Stock de {producto} actualizado."})
    else:
        return jsonify({"exito": False, "error": "Error al actualizar stock en BD."}), 500

@app.route('/api/deudores/agregar', methods=['POST'])
def api_agregar_deuda():
    """API para añadir una deuda (Producto o Manual)."""
    try:
        data = request.json
        nombre = data.get('nombre')
        tipo_deuda = data.get('tipo_deuda')

        if not nombre or not nombre.strip():
            return jsonify({"exito": False, "error": "Nombre es obligatorio."}), 400
        nombre_limpio = nombre.strip().title()

        # --- CASO 1: Deuda de Producto ---
        if tipo_deuda == 'producto':
            producto = data.get('producto')
            cantidad = int(data.get('cantidad', 0))

            if not producto or producto not in PRODUCTOS_INVENTARIO:
                return jsonify({"exito": False, "error": "Producto no válido."}), 400
            if cantidad <= 0:
                return jsonify({"exito": False, "error": "Cantidad debe ser positiva."}), 400

            inventario = db.obtener_inventario()
            if inventario.get(producto, 0) < cantidad:
                return jsonify({"exito": False, "error": f"No hay suficiente stock. Quedan {inventario.get(producto, 0)}."}), 400

            precio_unitario = PRECIOS[producto]
            monto_a_agregar = precio_unitario * cantidad
            concepto_deuda = producto # Usar nombre del producto como concepto

            # Actualizar stock (RESTANDO)
            if not db.actualizar_stock(producto, -cantidad):
                 return jsonify({"exito": False, "error": "Error al actualizar el stock."}), 500

            # Agregar la deuda
            if db.agregar_deuda(nombre_limpio, concepto_deuda, monto_a_agregar):
                return jsonify({"exito": True, "mensaje": f"Deuda de ${monto_a_agregar:.2f} por {cantidad}x {producto} registrada para {nombre_limpio}. Stock actualizado."})
            else:
                # Intentar revertir el stock si falla el registro de deuda
                db.actualizar_stock(producto, cantidad)
                return jsonify({"exito": False, "error": "Error al agregar la deuda en BD (Stock revertido)."}), 500

        # --- CASO 2: Deuda Manual ---
        elif tipo_deuda == 'manual':
            concepto = data.get('concepto')
            monto = float(data.get('monto', 0))

            if not concepto or concepto.strip() == '' or monto <= 0:
                return jsonify({"exito": False, "error": "Concepto y monto positivo son obligatorios."}), 400

            if db.agregar_deuda(nombre_limpio, concepto.strip(), monto):
                return jsonify({"exito": True, "mensaje": f"Deuda de ${monto:.2f} registrada para {nombre_limpio}."})
            else:
                return jsonify({"exito": False, "error": "Error al agregar la deuda en BD."}), 500
        else:
            return jsonify({"exito": False, "error": "Tipo de deuda no reconocido."}), 400

    except ValueError:
        return jsonify({"exito": False, "error": "Monto o cantidad inválida. Use solo números."}), 400
    except Exception as e:
        print(f"Error en /api/deudores/agregar: {e}", file=sys.stderr)
        return jsonify({"exito": False, "error": f"Error interno del servidor: {e}"}), 500

@app.route('/api/deudores/pagar', methods=['POST'])
def api_pagar_deuda():
    """API para abonar o liquidar una deuda específica (individual)."""
    try:
        data = request.json
        deuda_id = int(data.get('deuda_id'))
        monto = float(data.get('monto'))
        # Leemos el nuevo parámetro (por defecto es True para mantener compatibilidad)
        registrar_caja = data.get('registrar_caja', True)
    except (ValueError, TypeError):
         return jsonify({"exito": False, "error": "Datos inválidos (ID de deuda/monto). Use solo números."}), 400

    if monto <= 0:
        return jsonify({"exito": False, "error": "El monto a pagar debe ser positivo."}), 400

    # Pasamos el parámetro a la función de la BD
    if db.pagar_deuda(deuda_id, monto, registrar_en_caja=registrar_caja):
        mensaje = "Abono registrado en caja." if registrar_caja else "Deuda reducida (SIN registro en caja)."
        return jsonify({"exito": True, "mensaje": mensaje})
    else:
        return jsonify({"exito": False, "error": "Error al procesar el pago de la deuda (verificar ID)."}), 500

@app.route('/api/deudores/pagar_total', methods=['POST'])
def api_pagar_deuda_total():
    """API para aplicar un pago al total de deudas de un cliente."""
    try:
        data = request.json
        nombre = data.get('nombre')
        monto = float(data.get('monto'))
        # Leemos el nuevo parámetro
        registrar_caja = data.get('registrar_caja', True)
    except (ValueError, TypeError):
        return jsonify({"exito": False, "error": "Datos inválidos (nombre/monto)."}), 400

    if not nombre or not nombre.strip():
         return jsonify({"exito": False, "error": "Nombre es obligatorio."}), 400
    if monto <= 0:
        return jsonify({"exito": False, "error": "El monto a pagar debe ser positivo."}), 400

    # Pasamos el parámetro a la función de la BD
    if db.pagar_deuda_total(nombre.strip().title(), monto, registrar_en_caja=registrar_caja):
        mensaje = "Pago total registrado en caja." if registrar_caja else "Deuda total reducida (SIN registro en caja)."
        return jsonify({"exito": True, "mensaje": mensaje})
    else:
        return jsonify({"exito": False, "error": "Error al procesar el pago total (puede que no tenga deudas)."}), 500

@app.route('/api/obtener_historial', methods=['POST'])
def api_obtener_historial():
    try:
        data = request.json
        password = data.get('password')
        
        # Validación de contraseña
        if password != PASSWORD_HISTORIAL:
            return jsonify({"exito": False, "error": "Contraseña incorrecta."}), 401
        
        fecha_inicio = data.get('fecha_inicio')
        fecha_fin = data.get('fecha_fin')
        
        if not fecha_inicio or not fecha_fin:
            return jsonify({"exito": False, "error": "Faltan fechas."}), 400
            
        registros, t_ingresos, t_gastos = db.obtener_historial(fecha_inicio, fecha_fin)
        
        # Convertir a un formato que Javascript entienda
        regs_json = [{"fecha": r[0], "concepto": r[1], "monto": r[2], "es_gasto": bool(r[3])} for r in registros]
        
        return jsonify({
            "exito": True, 
            "registros": regs_json, 
            "total_ingresos": t_ingresos, 
            "total_gastos": t_gastos,
            "neto": t_ingresos - t_gastos
        })
    except Exception as e:
        return jsonify({"exito": False, "error": str(e)}), 500
        
@app.route('/api/verificar_password', methods=['POST'])
def api_verificar_password():
    """API solo para verificar la contraseña del administrador"""
    try:
        data = request.json
        password = data.get('password')
        
        # Comparamos con la misma contraseña del historial
        if password == PASSWORD_HISTORIAL:
            return jsonify({"exito": True})
        else:
            return jsonify({"exito": False, "error": "Contraseña incorrecta."}), 401
    except Exception as e:
        return jsonify({"exito": False, "error": str(e)}), 500

@app.route('/actualizar_cliente_agenda/<int:id>', methods=['POST'])
def actualizar_cliente_agenda(id):
    datos = request.get_json()
    nombre = datos.get('nombre')
    telefono = datos.get('telefono')
    fecha = datos.get('fecha_vencimiento')
    
    # Aquí va tu lógica de actualización en la BD (ejecutar UPDATE)
    # db.execute("UPDATE clientes SET nombre=?, telefono=?, fecha_vencimiento=? WHERE id=?", 
    #            (nombre, telefono, fecha, id))
    
    return jsonify({"success": True, "mensaje": "Actualizado correctamente"})
        
# --- Ejecutar la Aplicación ---
if __name__ == '__main__':
    # Cambiar debug=False para producción real
    # Usar host='0.0.0.0' para acceder desde otros dispositivos en la red local
    app.run(debug=True, host='0.0.0.0', port=5000)
