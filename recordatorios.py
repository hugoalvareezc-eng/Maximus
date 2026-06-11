import pg8000.dbapi
import pywhatkit as kit
import time
import random
from datetime import datetime, timedelta

# --- TUS DATOS DE SUPABASE ---
DB_USER = "postgres.itfpekrncoligixkuobb"
DB_PASS = "Minions2017hugo0"
DB_HOST = "aws-1-us-east-1.pooler.supabase.com"
DB_PORT = 6543
DB_NAME = "postgres"

def enviar_recordatorios_windows():
    print("Conectando a Supabase...")
    try:
        conn = pg8000.dbapi.connect(
            user=DB_USER,
            password=DB_PASS,
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME
        )
        cursor = conn.cursor()

        manana_dt = datetime.now() + timedelta(days=1)
        manana_str = manana_dt.strftime('%Y-%m-%d')

        cursor.execute("SELECT nombre, telefono FROM clientes WHERE fecha_vencimiento = %s AND telefono != ''", (manana_str,))
        clientes = cursor.fetchall()

        if not clientes:
            print("Nadie se vence mañana o faltan teléfonos registrados.")
            return

        print(f"Se encontraron {len(clientes)} clientes. Iniciando modo Anti-Ban...")

        # Listas para rotación de mensajes
        saludos = ["¡Hola", "¡Qué tal", "¡Excelente día", "¡Hola hola"]
        emojis = ["🏋️‍♂️", "💪", "🔥", "💯", "⚡️"]
        preguntas = [
            "¿Te esperamos hoy para tu rutina?",
            "¿Te guardamos tu lugar para este mes?",
            "¿A qué hora nos visitas hoy?",
            "¡Confírmanos si te vemos al rato para entrenar!"
        ]

        for nombre, telefono in clientes:
            if not telefono.startswith("+52"):
                telefono = "+52" + telefono.strip()

            saludo_random = random.choice(saludos)
            emoji_random = random.choice(emojis)
            pregunta_random = random.choice(preguntas)

            mensaje = f"{saludo_random} {nombre.title()}! {emoji_random} Te escribimos de Maximus Gym para recordarte que tu membresía vence el día de mañana ({manana_str}). {pregunta_random}"
            
            print(f"Enviando mensaje a {nombre}...")
            
            # pywhatkit abre Chrome, pega el texto, espera, envía y cierra la pestaña automáticamente
            tiempo_carga = random.randint(18, 22)
            kit.sendwhatmsg_instantly(
                phone_no=telefono,
                message=mensaje,
                wait_time=tiempo_carga,
                tab_close=True
            )
            
            tiempo_pausa = random.randint(1, 3)
            print(f"Descansando {tiempo_pausa} segundos antes del siguiente...\n")
            time.sleep(tiempo_pausa)

        print("¡Todos los recordatorios fueron enviados con éxito!")

    except Exception as e:
        print(f"Ocurrió un error: {e}")
    finally:
        if 'conn' in locals() and conn:
            cursor.close()
            conn.close()

if __name__ == "__main__":
    enviar_recordatorios_windows()