import json
import re
from datetime import datetime
from models import ActividadLectura, Biblioteca, Libro, Reseña

try:
    from google import genai
except Exception:
    genai = None

import os
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if genai and GEMINI_API_KEY else None

SYSTEM_PROMPT_NOVELIA = (
    "Eres Novelia, una bibliotecaria virtual apasionada por los libros. "
    "Hablas como una amiga cercana, cálida y emocionante. Conoces todas las tendencias de "
    "BookTok, Bookstagram y Goodreads. Puedes recomendar libros, hablar de autores, explicar "
    "géneros, dar consejos para empezar a escribir, analizar narrativas, comparar sagas, hablar "
    "de tropes románticos, dark romance, romantasy, booktok trends 2023-2026, y cualquier tema "
    "literario. Siempre que recomiendes un libro, dices el título, autor y una frase que describe "
    "el vibe, y das la opción de agregarlo a biblioteca. No uses emojis. Responde siempre en español."
)


class LibrarianAgent:
    def __init__(self, db):
        self.db = db

    # ------------------------------------------------------------------
    # CHAT LITERARIO IA
    # ------------------------------------------------------------------

    def _detectar_intencion_chat(self, mensaje: str) -> str:
        texto = mensaje.lower()
        reglas = [
            ("recomendacion", ["recomienda", "sugiere", "booktok", "qué leo", "que leo", "similar a", "parecido a", "quiero leer", "que leer"]),
            ("autor", ["autor", "escritor", "quién escribió", "quien escribio", "libros de"]),
            ("escritura", ["escribir", "consejo de escritura", "cómo escribir", "como escribir", "mi novela"]),
            ("tendencias", ["booktok", "bookstagram", "goodreads", "tendencia", "trend", "viral"]),
            ("tropes", ["trope", "enemies to lovers", "slow burn", "dark romance", "romantasy", "segunda oportunidad"]),
            ("saga", ["saga", "serie", "trilogía", "trilogia", "continuación", "siguiente libro"]),
            ("reseña", ["reseña", "review", "opinas", "calificación"]),
        ]
        for intencion, palabras in reglas:
            if any(p in texto for p in palabras):
                return intencion
        return "conversacion"

    def _extraer_libros_mencionados(self, texto: str) -> list:
        """Extrae libros del formato 'Título' de Autor que aparecen en la respuesta."""
        libros = []
        # Busca patrones como "Titulo" de Autor o **Titulo** de Autor
        patrones = [
            r'"([^"]{3,60})"\s+de\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)',
            r'\*\*([^*]{3,60})\*\*\s+de\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)',
        ]
        vistos = set()
        for patron in patrones:
            for match in re.finditer(patron, texto):
                titulo = match.group(1).strip()
                autor = match.group(2).strip()
                clave = titulo.lower()
                if clave not in vistos and len(titulo) > 2:
                    vistos.add(clave)
                    titulo_enc = titulo.replace(" ", "_")
                    libros.append({
                        "id": f"chat_{titulo_enc[:30]}",
                        "titulo": titulo,
                        "autor": autor,
                        "portada_url": f"https://covers.openlibrary.org/b/title/{titulo.replace(' ', '+')}-M.jpg",
                    })
        return libros[:5]

    def _fallback_inteligente(self, mensaje: str, libros_leidos: int) -> str:
        """Fallback variado según el contenido del mensaje, sin depender de Gemini."""
        m = mensaje.lower()
        if any(w in m for w in ["dark romance", "romance oscuro"]):
            return '"Twisted Love" de Ana Huang tiene esa tensión perfecta entre enemigos que define el dark romance. Si quieres algo más intenso, "Haunting Adeline" de H.D. Carlton es el siguiente nivel.'
        if any(w in m for w in ["romantasy", "fantasía romántica", "fantasia romantica"]):
            return '"Fourth Wing" de Rebecca Yarros es el más viral de BookTok ahora mismo, y "A Court of Thorns and Roses" de Sarah J. Maas es el clásico que inició el género. Ambas son lectura obligatoria.'
        if any(w in m for w in ["booktok", "tendencia", "viral", "trend"]):
            return 'En BookTok 2025 dominan el romantasy y el dark romance. "Iron Flame", "Powerless" de Lauren Roberts y "From Blood and Ash" están en todas las listas ahora mismo.'
        if any(w in m for w in ["escribir", "novela propia", "cómo escribo", "como escribo"]):
            return 'Para empezar a escribir, lo más importante es leer mucho en el género que quieres escribir. Empieza con un personaje que te apasione y deja que la historia fluya desde ahí.'
        if any(w in m for w in ["misterio", "thriller", "suspenso"]):
            return '"Verity" de Colleen Hoover es el thriller que nadie puede soltar, y "The Silent Patient" de Alex Michaelides tiene uno de los mejores giros finales del género.'
        if any(w in m for w in ["cozy", "tranquilo", "ligero", "cómodo"]):
            return '"The House in the Cerulean Sea" de TJ Klune es el cozy fantasy perfecto, lleno de calidez y personajes adorables. También "Beach Read" de Emily Henry para algo contemporáneo y ligero.'
        if any(w in m for w in ["recomiend", "sugiere", "qué leer", "que leer", "siguiente"]):
            if libros_leidos > 10:
                return 'Con tu experiencia como lectora, te recomiendo explorar "Babel" de R.F. Kuang o "The Atlas Six" de Olivie Blake, dos libros que están marcando el género del dark academia.'
            return 'Para empezar fuerte: "Fourth Wing" de Rebecca Yarros o "It Ends With Us" de Colleen Hoover. Ambas están en todas las conversaciones de BookTok ahora mismo.'
        if any(w in m for w in ["trope", "enemies", "slow burn", "fake dating", "segunda oportunidad"]):
            return 'Para enemies to lovers, "Twisted Love" de Ana Huang es perfecto. Para slow burn, "The Love Hypothesis" de Ali Hazelwood. Y para second chance, "People We Meet on Vacation" de Emily Henry.'
        return 'Cuéntame más sobre qué tipo de libros te gustan o qué emoción buscas, y te encuentro la lectura perfecta para ti.'

    def chat_literario(self, mensaje: str, usuario_id: int, historial: list) -> dict:
        intencion = self._detectar_intencion_chat(mensaje)
        libros_mencionados = []

        # Contexto del usuario desde BD para personalizar el system prompt
        libros_leidos = self.db.query(Biblioteca).filter(
            Biblioteca.usuario_id == usuario_id,
            Biblioteca.estado == "leido"
        ).count()
        reseñas_usuario = self.db.query(Reseña).filter(Reseña.usuario_id == usuario_id).all()
        calificacion_promedio = round(
            sum(r.calificacion for r in reseñas_usuario) / len(reseñas_usuario), 1
        ) if reseñas_usuario else 0

        system_prompt = (
            "Eres Novelia, una bibliotecaria virtual apasionada por los libros. "
            "Hablas como una amiga cercana, cálida y emocionante. Conoces todas las tendencias de "
            "BookTok, Bookstagram y Goodreads 2024-2026. Puedes recomendar libros, hablar de autores, "
            "explicar géneros, dar consejos para empezar a escribir, analizar narrativas, comparar sagas, "
            "hablar de tropes románticos, dark romance, romantasy, booktok trends y cualquier tema literario. "
            "Siempre que recomiendes un libro, escribe el título entre comillas, autor y una frase que describe el vibe. "
            "Responde en español. Sin emojis. Máximo 4 oraciones por respuesta. Sé directa y emocionante. "
            f"Datos de esta lectora: {libros_leidos} libros leídos, calificación promedio {calificacion_promedio}/5."
        )

        if not client:
            respuesta = self._fallback_inteligente(mensaje, libros_leidos)
            return {"respuesta": respuesta, "intencion": intencion, "libros_mencionados": []}

        # Construir historial para la API (últimos 6 mensajes para no exceder tokens)
        contents = []
        for msg in historial[-6:]:
            role = "model" if msg.get("role") == "assistant" else "user"
            texto = msg.get("text") or msg.get("content", "")
            contents.append({
                "role": role,
                "parts": [{"text": texto}]
            })
        contents.append({"role": "user", "parts": [{"text": mensaje}]})

        try:
            from google.genai import types
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=600,
                )
            )
            respuesta = response.text.strip()
            libros_mencionados = self._extraer_libros_mencionados(respuesta)
        except Exception:
            respuesta = self._fallback_inteligente(mensaje, libros_leidos)

        self._registrar_actividad(usuario_id, "chat", mensaje[:250], 1)
        return {
            "respuesta": respuesta,
            "intencion": intencion,
            "libros_mencionados": libros_mencionados
        }

    # ------------------------------------------------------------------
    # BIBLIOTECA
    # ------------------------------------------------------------------

    def guardar_libro(self, libro_data: dict) -> Libro:
        libro = self.db.query(Libro).filter(Libro.id == libro_data["id"]).first()
        if not libro:
            libro = Libro(
                id=libro_data["id"],
                titulo=libro_data["titulo"],
                autor=libro_data["autor"],
                genero=libro_data.get("genero", ""),
                descripcion=libro_data.get("descripcion", ""),
                portada_url=libro_data.get("portada_url", ""),
                tags=libro_data.get("tags", "")
            )
            self.db.add(libro)
            self.db.commit()
        return libro

    def _registrar_actividad(self, usuario_id: int, tipo: str, detalle: str, puntos: int = 1):
        actividad = ActividadLectura(
            usuario_id=usuario_id,
            tipo=tipo,
            detalle=detalle,
            puntos=puntos,
            fecha=datetime.utcnow()
        )
        self.db.add(actividad)
        self.db.commit()

    def agregar_a_biblioteca(self, usuario_id: int, libro_data: dict, estado: str) -> dict:
        self.guardar_libro(libro_data)

        existente = self.db.query(Biblioteca).filter(
            Biblioteca.usuario_id == usuario_id,
            Biblioteca.libro_id == libro_data["id"]
        ).first()

        if existente:
            existente.estado = estado
            existente.fecha_actualizado = datetime.utcnow()
            self.db.commit()
            accion = "actualizado"
        else:
            entrada = Biblioteca(
                usuario_id=usuario_id,
                libro_id=libro_data["id"],
                estado=estado,
                progreso=0,
                fecha_agregado=datetime.utcnow(),
                fecha_actualizado=datetime.utcnow()
            )
            self.db.add(entrada)
            self.db.commit()
            accion = "agregado"

        sugerencia = None
        if estado == "leido":
            sugerencia = "Terminaste este libro. Puedes dejar una reseña para afinar tus recomendaciones."

        self._registrar_actividad(usuario_id, "biblioteca", f"{libro_data['titulo']} marcado como {estado}", 2)
        return {
            "mensaje": f"Libro '{libro_data['titulo']}' {accion} como '{estado}'",
            "accion": accion,
            "sugerencia": sugerencia
        }

    def actualizar_progreso(self, usuario_id: int, libro_id: str, progreso: int) -> dict:
        entrada = self.db.query(Biblioteca).filter(
            Biblioteca.usuario_id == usuario_id,
            Biblioteca.libro_id == libro_id
        ).first()

        if not entrada:
            return {"error": "Libro no encontrado en tu biblioteca"}

        entrada.progreso = progreso
        entrada.fecha_actualizado = datetime.utcnow()

        inferencia = None
        if progreso >= 80 and entrada.estado == "leyendo":
            inferencia = "Estás casi terminando, pronto te recomendaremos libros similares"

        if progreso == 100:
            entrada.estado = "leido"
            inferencia = "Libro completado. Marcado como leído automáticamente"

        self.db.commit()
        self._registrar_actividad(usuario_id, "progreso", f"Progreso de {libro_id} actualizado a {progreso}%", 1)
        return {
            "mensaje": f"Progreso actualizado a {progreso}%",
            "inferencia": inferencia
        }

    # ------------------------------------------------------------------
    # RESEÑAS CON ANÁLISIS IA
    # ------------------------------------------------------------------

    def _analizar_resena_con_ia(self, texto: str, calificacion: float) -> dict:
        """Extrae sentimiento y tags automáticos con Gemini."""
        if not client or len(texto) < 50:
            return {"sentimiento": None, "tags_auto": None}

        prompt = f"""Analiza esta reseña de libro (calificación: {calificacion}/5):
"{texto}"

Responde SOLO con este JSON exacto, sin texto extra:
{{"sentimiento": "positivo|negativo|mixto", "tags": ["tag1", "tag2", "tag3"]}}

Los tags deben describir la experiencia lectora (ej: "lectura rápida", "personajes memorables", "final sorprendente"). Máximo 3 tags de 2-3 palabras cada uno."""

        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=prompt
            )
            text = re.sub(r"```json|```", "", response.text).strip()
            data = json.loads(text)
            return {
                "sentimiento": data.get("sentimiento"),
                "tags_auto": ",".join(data.get("tags", []))
            }
        except Exception:
            return {"sentimiento": None, "tags_auto": None}

    def escribir_reseña(self, usuario_id: int, libro_id: str, calificacion: float, texto: str) -> dict:
        existente = self.db.query(Reseña).filter(
            Reseña.usuario_id == usuario_id,
            Reseña.libro_id == libro_id
        ).first()

        analisis = self._analizar_resena_con_ia(texto, calificacion)

        if existente:
            existente.calificacion = calificacion
            existente.texto = texto
            existente.fecha = datetime.utcnow()
            if analisis["sentimiento"]:
                existente.sentimiento = analisis["sentimiento"]
            if analisis["tags_auto"]:
                existente.tags_auto = analisis["tags_auto"]
            self.db.commit()
            accion = "actualizada"
        else:
            reseña = Reseña(
                usuario_id=usuario_id,
                libro_id=libro_id,
                calificacion=calificacion,
                texto=texto,
                sentimiento=analisis["sentimiento"],
                tags_auto=analisis["tags_auto"],
                fecha=datetime.utcnow()
            )
            self.db.add(reseña)
            self.db.commit()
            accion = "publicada"

        self._actualizar_rating(libro_id)

        # Respuesta emotiva de la IA
        prompt_respuesta = f"""Un lector escribió esta reseña con {calificacion} estrellas: "{texto[:300]}"
Responde con UN mensaje corto (máximo 2 oraciones) celebrando su reseña y animándolo a seguir leyendo. Sé cálido. Sin emojis."""

        if client:
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash-lite",
                    contents=prompt_respuesta
                )
                respuesta_ia = response.text.strip()
            except Exception:
                respuesta_ia = "Tu reseña quedó registrada y aporta mucho contexto a tu perfil lector."
        else:
            respuesta_ia = "Tu reseña quedó registrada y aporta mucho contexto a tu perfil lector."

        self._registrar_actividad(usuario_id, "reseña", f"Reseña publicada para {libro_id}", 2)
        return {
            "mensaje": f"Reseña {accion} exitosamente",
            "respuesta_ia": respuesta_ia,
            "sentimiento": analisis["sentimiento"],
            "tags_auto": analisis["tags_auto"].split(",") if analisis["tags_auto"] else []
        }

    def obtener_resenas_libro(self, libro_id: str) -> list:
        from models import Usuario
        reseñas = self.db.query(Reseña).filter(Reseña.libro_id == libro_id).all()
        resultado = []
        for r in reseñas:
            usuario = self.db.query(Usuario).filter(Usuario.id == r.usuario_id).first()
            resultado.append({
                "id": r.id,
                "username": usuario.username if usuario else "Anónimo",
                "calificacion": r.calificacion,
                "texto": r.texto,
                "sentimiento": r.sentimiento,
                "tags_auto": r.tags_auto.split(",") if r.tags_auto else [],
                "fecha": r.fecha.isoformat()
            })
        return resultado

    def _actualizar_rating(self, libro_id: str):
        reseñas = self.db.query(Reseña).filter(Reseña.libro_id == libro_id).all()
        if reseñas:
            libro = self.db.query(Libro).filter(Libro.id == libro_id).first()
            if libro:
                libro.rating_promedio = sum(r.calificacion for r in reseñas) / len(reseñas)
                libro.total_reseñas = len(reseñas)
                self.db.commit()

    def obtener_biblioteca(self, usuario_id: int) -> dict:
        entradas = self.db.query(Biblioteca).filter(
            Biblioteca.usuario_id == usuario_id
        ).all()

        leyendo, quiero_leer, leidos = [], [], []

        for entrada in entradas:
            libro = self.db.query(Libro).filter(Libro.id == entrada.libro_id).first()
            if not libro:
                continue
            datos = {
                "id": libro.id,
                "titulo": libro.titulo,
                "autor": libro.autor,
                "portada_url": libro.portada_url,
                "genero": libro.genero,
                "progreso": entrada.progreso,
                "fecha_agregado": entrada.fecha_agregado.isoformat()
            }
            if entrada.estado == "leyendo":
                leyendo.append(datos)
            elif entrada.estado == "quiero_leer":
                quiero_leer.append(datos)
            elif entrada.estado == "leido":
                leidos.append(datos)

        return {
            "leyendo": leyendo,
            "quiero_leer": quiero_leer,
            "leidos": leidos
        }
