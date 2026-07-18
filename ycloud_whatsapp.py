"""
Integración con YCloud (proveedor de WhatsApp Business API).

Dos usos:
1. Recordatorio proactivo: un día antes de que venza la membresía de un
   cliente, se le manda una plantilla aprobada por Meta (obligatorio para
   mensajes que el negocio inicia, no puede ser texto libre).
2. Auto-respuesta a mensajes entrantes: si alguien le escribe al número de
   WhatsApp del gym, se responde automáticamente con su fecha de vencimiento
   (si ya es cliente) o información general (precios, horario, dirección)
   si nunca ha ido. Esto sí puede ser texto libre porque va dentro de las
   24 horas de una conversación que el cliente inició.

Todas las credenciales se leen de variables de entorno — nunca deben
escribirse aquí ni subirse al repositorio.
"""
import os
import sys
import requests

import gimnasio_crud as db

YCLOUD_API_KEY = os.environ.get("YCLOUD_API_KEY")
YCLOUD_WHATSAPP_FROM = os.environ.get("YCLOUD_WHATSAPP_FROM")  # número verificado del gym, ej: "5217711234567"
YCLOUD_TEMPLATE_VENCIMIENTO = os.environ.get("YCLOUD_TEMPLATE_VENCIMIENTO", "recordatorio_vencimiento")
YCLOUD_TEMPLATE_IDIOMA = os.environ.get("YCLOUD_TEMPLATE_IDIOMA", "es_MX")
CRON_SECRET = os.environ.get("CRON_SECRET")

GYM_NOMBRE = os.environ.get("GYM_NOMBRE", "Maximus Gym")
GYM_DIRECCION = os.environ.get(
    "GYM_DIRECCION",
    "C. Plan de Ayala 8, 8va Demarcación, 42700 Mixquiahuala, Hgo."
)
GYM_HORARIO = os.environ.get(
    "GYM_HORARIO",
    "Lunes a viernes de 5:00am a 10:00pm, sábado de 5:00am a 3:30pm y domingo de 7:00am a 2:30pm."
)
GYM_LATITUD = float(os.environ.get("GYM_LATITUD", "20.2288107"))
GYM_LONGITUD = float(os.environ.get("GYM_LONGITUD", "-99.2067304"))

YCLOUD_API_URL = "https://api.ycloud.com/v2/whatsapp/messages"


def _configurado():
    if not YCLOUD_API_KEY or not YCLOUD_WHATSAPP_FROM:
        print("YCloud no está configurado (falta YCLOUD_API_KEY o YCLOUD_WHATSAPP_FROM).", file=sys.stderr)
        return False
    return True


def _headers():
    return {"Content-Type": "application/json", "X-API-Key": YCLOUD_API_KEY}


def _post_mensaje(payload):
    """POST genérico a la API de mensajes de YCloud. Devuelve (exito, detalle)."""
    if not _configurado():
        return False, "YCloud no configurado"
    try:
        resp = requests.post(YCLOUD_API_URL, headers=_headers(), json=payload, timeout=15)
        if resp.status_code >= 200 and resp.status_code < 300:
            return True, resp.json()
        print(f"YCloud respondió {resp.status_code}: {resp.text}", file=sys.stderr)
        return False, resp.text
    except requests.RequestException as e:
        print(f"Error de red al llamar a YCloud: {e}", file=sys.stderr)
        return False, str(e)


def enviar_recordatorio_vencimiento(nombre, telefono, fecha_vencimiento):
    """
    Manda la plantilla aprobada de 'tu membresía vence mañana'.
    IMPORTANTE: el nombre de la plantilla y sus variables deben coincidir
    EXACTO con lo que se registró y aprobó en el panel de YCloud/Meta.
    Si cambias el texto de la plantilla ahí, ajusta también el número y
    orden de 'parameters' aquí abajo.
    """
    payload = {
        "from": YCLOUD_WHATSAPP_FROM,
        "to": f"52{db.normalizar_telefono(telefono)}",
        "type": "template",
        "template": {
            "name": YCLOUD_TEMPLATE_VENCIMIENTO,
            "language": {"code": YCLOUD_TEMPLATE_IDIOMA},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": nombre},
                        {"type": "text", "text": fecha_vencimiento},
                    ],
                }
            ],
        },
    }
    return _post_mensaje(payload)


def enviar_texto(telefono, texto):
    """Respuesta de texto libre, solo válida dentro de las 24h de una
    conversación iniciada por el cliente (no sirve para mensajes proactivos)."""
    payload = {
        "from": YCLOUD_WHATSAPP_FROM,
        "to": f"52{db.normalizar_telefono(telefono)}",
        "type": "text",
        "text": {"body": texto},
    }
    return _post_mensaje(payload)


def enviar_ubicacion(telefono):
    """Manda el pin de ubicación del gym (mapa nativo de WhatsApp), no solo
    la dirección en texto. Igual que enviar_texto, solo válido dentro de
    las 24h de una conversación que el cliente inició."""
    payload = {
        "from": YCLOUD_WHATSAPP_FROM,
        "to": f"52{db.normalizar_telefono(telefono)}",
        "type": "location",
        "location": {
            "latitude": GYM_LATITUD,
            "longitude": GYM_LONGITUD,
            "name": GYM_NOMBRE,
            "address": GYM_DIRECCION,
        },
    }
    return _post_mensaje(payload)


def enviar_recordatorios_de_manana(fecha_manana_str):
    """
    Recorre a todos los clientes cuya fecha_vencimiento es fecha_manana_str
    y les manda el recordatorio. Pensado para llamarse una vez al día desde
    un cron. Devuelve un resumen para poder revisar qué falló.
    """
    clientes = db.obtener_clientes_que_vencen(fecha_manana_str)
    resultados = {"enviados": [], "fallidos": []}
    for nombre, telefono, fecha_venc in clientes:
        exito, detalle = enviar_recordatorio_vencimiento(nombre, telefono, fecha_venc)
        if exito:
            resultados["enviados"].append(nombre)
        else:
            resultados["fallidos"].append({"nombre": nombre, "error": detalle})
    return resultados


# --- Lógica de auto-respuesta a mensajes entrantes ---

def _contiene_alguna(texto, palabras):
    texto = texto.lower()
    return any(p in texto for p in palabras)


def _info_general():
    return (
        f"Somos {GYM_NOMBRE} 💪\n\n"
        f"📍 Dirección: {GYM_DIRECCION} (te mando la ubicación abajo)\n"
        f"🕒 Horario: {GYM_HORARIO}\n\n"
        "💳 Precios:\n"
        "- Mes Normal: $420\n"
        "- Mes Estudiante: $370\n"
        "- Semana: $200\n"
        "- Visita: $50\n\n"
        "¡Te esperamos!"
    )


def construir_respuesta(telefono, texto_recibido):
    """
    Decide qué contestar según quién escribe y qué pregunta.
    - Si el número ya es cliente: puede preguntar por su vencimiento,
      precios, horario o dirección; si no se detecta nada en particular,
      se le manda su fecha de vencimiento (lo más probable que quiera saber).
    - Si el número no está registrado (nunca ha ido): se le manda la
      información general del gym.
    Devuelve {"texto": str, "ubicacion": bool} — 'ubicacion' indica si,
    además del texto, hay que mandar el pin del mapa.
    """
    cliente = db.buscar_cliente_por_telefono(telefono)
    texto_recibido = texto_recibido or ""

    quiere_vencimiento = _contiene_alguna(texto_recibido, ["venc", "cuando", "cuándo", "mi mes", "membres"])
    quiere_precio = _contiene_alguna(texto_recibido, ["precio", "costo", "cuanto cuesta", "cuánto cuesta", "mensualidad"])
    quiere_horario = _contiene_alguna(texto_recibido, ["horario", "hora abren", "hora cierran", "abierto"])
    quiere_direccion = _contiene_alguna(texto_recibido, ["direccion", "dirección", "ubicacion", "ubicación", "donde", "dónde"])

    if not cliente:
        # Nunca ha ido: siempre se le manda la info general (con ubicación), sin importar qué haya escrito.
        return {"texto": _info_general(), "ubicacion": True}

    partes = []
    if quiere_precio:
        partes.append(
            "💳 Precios:\n- Mes Normal: $420\n- Mes Estudiante: $370\n- Semana: $200\n- Visita: $50"
        )
    if quiere_horario:
        partes.append(f"🕒 Horario: {GYM_HORARIO}")
    if quiere_direccion:
        partes.append(f"📍 Dirección: {GYM_DIRECCION} (te mando la ubicación abajo)")
    if quiere_vencimiento or not partes:
        partes.append(f"Hola {cliente['nombre']}, tu membresía vence el {cliente['fecha_vencimiento']}.")

    return {"texto": "\n\n".join(partes), "ubicacion": quiere_direccion}


def procesar_webhook(payload):
    """
    Punto de entrada del webhook de YCloud. El formato exacto puede variar
    según cómo YCloud entregue el evento; se intenta primero la forma
    documentada (evento 'whatsapp.inbound_message.received' con el mensaje
    en 'whatsappInboundMessage') y se cae a variantes más planas si no
    coincide. Si no logra identificar remitente/texto, registra el payload
    crudo para poder ajustarlo con un ejemplo real.
    """
    mensaje = payload.get("whatsappInboundMessage") or payload

    telefono = mensaje.get("from") or mensaje.get("from_") or payload.get("from")
    texto = None
    if isinstance(mensaje.get("text"), dict):
        texto = mensaje["text"].get("body")
    elif isinstance(mensaje.get("text"), str):
        texto = mensaje.get("text")

    if not telefono:
        print(f"Webhook de YCloud sin remitente reconocible, payload crudo: {payload}", file=sys.stderr)
        return {"exito": False, "error": "No se reconoció el remitente en el payload"}

    respuesta = construir_respuesta(telefono, texto)
    resultado = enviar_texto(telefono, respuesta["texto"])
    if respuesta["ubicacion"]:
        enviar_ubicacion(telefono)
    return resultado
