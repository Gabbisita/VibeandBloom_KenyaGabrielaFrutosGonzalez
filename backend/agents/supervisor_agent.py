import json
import re
import os
from datetime import date, datetime
from dotenv import load_dotenv
from models import ActividadLectura, Biblioteca, Reseña, SesionVibe

try:
    from google import genai
except Exception:
    genai = None

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if genai and GEMINI_API_KEY else None


class SupervisorAgent:
    def __init__(self, db):
        self.db = db

    # ------------------------------------------------------------------
    # DETECCIÓN DE INTENCIÓN
    # ------------------------------------------------------------------

    def _detectar_intencion(self, mensaje: str) -> str:
        texto = mensaje.lower()
        reglas = [
            ("recomendacion", ["recomienda", "sugiere", "booktok", "qué leo", "que leo", "similar a", "parecido a"]),
            ("perfil", ["racha", "perfil", "estadísticas", "estadisticas", "nivel", "reto", "progreso"]),
            ("explicacion", ["por qué", "porque", "explica", "explicación", "regla", "inferencia"]),
            ("biblioteca", ["agrega", "añade", "marcar", "quiero leer", "leyendo", "leído", "leido"]),
            ("reseña", ["reseña", "review", "opinas", "calificación", "calificacion"]),
        ]
        for intencion, palabras in reglas:
            if any(palabra in texto for palabra in palabras):
                return intencion
        return "conversacion"

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

    def _dias_actividad(self, usuario_id: int):
        fechas = []
        for actividad in self.db.query(ActividadLectura).filter(ActividadLectura.usuario_id == usuario_id).all():
            fechas.append(actividad.fecha.date())
        for biblioteca in self.db.query(Biblioteca).filter(Biblioteca.usuario_id == usuario_id).all():
            fechas.append(biblioteca.fecha_agregado.date())
        for resena in self.db.query(Reseña).filter(Reseña.usuario_id == usuario_id).all():
            fechas.append(resena.fecha.date())
        for sesion in self.db.query(SesionVibe).filter(SesionVibe.usuario_id == usuario_id).all():
            fechas.append(sesion.fecha.date())
        return sorted(set(fechas))

    def _racha_desde_fechas(self, fechas: list) -> int:
        if not fechas:
            return 0
        fechas_ordenadas = sorted(set(fechas), reverse=True)
        racha = 1
        fecha_actual = fechas_ordenadas[0]
        for fecha in fechas_ordenadas[1:]:
            if (fecha_actual - fecha).days == 1:
                racha += 1
                fecha_actual = fecha
            elif (fecha_actual - fecha).days > 1:
                break
        return racha

    # ------------------------------------------------------------------
    # REPORTE DE USUARIO — Agente Supervisor IA
    # ------------------------------------------------------------------

    def generar_reporte_usuario(self, usuario_id: int) -> dict:
        """Genera análisis narrativo del perfil lector usando Gemini."""
        resumen = self.resumen_usuario(usuario_id)
        stats = resumen["estadisticas"]

        perfil_texto = (
            f"Libros leídos: {stats['libros_leidos']}. "
            f"Leyendo ahora: {stats['leyendo_ahora']}. "
            f"Lista de deseos: {stats['quiero_leer']} libros. "
            f"Calificación promedio: {stats['rating_promedio']}/5. "
            f"Racha de lectura activa: {stats['racha_lectura']} días. "
            f"Total reseñas escritas: {stats['total_reseñas']}. "
            f"Nivel lector: {resumen['nivel_lector']}. "
            f"Vibe favorito: {resumen['vibe_favorito']}. "
            f"Inferencias del sistema: {'; '.join(resumen['inferencias_perfil'])}."
        )

        fallback = {
            "tipo_lectora": self._tipo_lectora_heuristico(stats, resumen["nivel_lector"]),
            "generos_alma": self._generos_alma_heuristicos(resumen["vibe_favorito"]),
            "insight": self._insight_heuristico(stats),
            "prediccion": self._prediccion_heuristica(resumen["vibe_favorito"], stats),
            "inferencias": resumen["inferencias_perfil"],
        }

        if not client:
            return fallback

        prompt = f"""Analiza este perfil de lectora y genera un reporte creativo y personalizado.

Perfil:
{perfil_texto}

Responde SOLO con este JSON exacto (sin texto extra):
{{
  "tipo_lectora": "Su tipo de lectora en una frase creativa (ej: La devoradora de sagas de madrugada)",
  "generos_alma": [
    {{"genero": "nombre del género", "explicacion": "Por qué este género define a esta lectora en 1 oración"}},
    {{"genero": "nombre del género", "explicacion": "..."}},
    {{"genero": "nombre del género", "explicacion": "..."}}
  ],
  "insight": "Un insight sorprendente sobre sus hábitos de lectura en 1-2 oraciones",
  "prediccion": "Qué libro o género va a amar este mes, con una razón específica",
  "inferencias": ["inferencia 1 explicada en lenguaje amigable", "inferencia 2", "inferencia 3"]
}}

Tono: como una amiga que te conoce bien. Sin emojis. En español."""

        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            text = re.sub(r"```json|```", "", response.text).strip()
            data = json.loads(text)
            return {
                "tipo_lectora": data.get("tipo_lectora", fallback["tipo_lectora"]),
                "generos_alma": data.get("generos_alma", fallback["generos_alma"]),
                "insight": data.get("insight", fallback["insight"]),
                "prediccion": data.get("prediccion", fallback["prediccion"]),
                "inferencias": data.get("inferencias", fallback["inferencias"]),
            }
        except Exception:
            return fallback

    def _tipo_lectora_heuristico(self, stats: dict, nivel: str) -> str:
        racha = stats.get("racha_lectura", 0)
        leidos = stats.get("libros_leidos", 0)
        if racha >= 14:
            return "La lectora imparable que no puede soltar el libro"
        if leidos > 20:
            return "La devoradora de bibliotecas que ya lo ha leído todo"
        if leidos > 10:
            return "La lectora apasionada que siempre tiene libro en mano"
        if stats.get("quiero_leer", 0) > 10:
            return "La acumuladora de TBR con listas interminables"
        return "La lectora en crecimiento que está descubriendo su voz literaria"

    def _generos_alma_heuristicos(self, vibe: str) -> list:
        mapa = {
            "romantico": [
                {"genero": "Romance contemporáneo", "explicacion": "Tu tendencia romántica define cada elección literaria"},
                {"genero": "Romantasy", "explicacion": "La magia y el amor son tu combinación perfecta"},
                {"genero": "Dark Romance", "explicacion": "Te atraen las historias con tensión intensa y personajes complejos"},
            ],
            "oscuro": [
                {"genero": "Dark Romance", "explicacion": "Tus vibes oscuros muestran que disfrutas la intensidad emocional"},
                {"genero": "Thriller psicológico", "explicacion": "El suspenso y la tensión son tu ambiente favorito"},
                {"genero": "Horror literario", "explicacion": "No te asusta lo oscuro, al contrario, te fascina"},
            ],
            "aventurero": [
                {"genero": "Fantasy épico", "explicacion": "Los mundos de fantasía son tu escapatoria favorita"},
                {"genero": "Romantasy", "explicacion": "Aventura y romance son la combinación que más disfrutas"},
                {"genero": "Ciencia Ficción", "explicacion": "Las posibilidades infinitas del futuro te emocionan"},
            ],
        }
        return mapa.get(vibe, [
            {"genero": "Contemporary Fiction", "explicacion": "Las historias cercanas y reales resuenan contigo"},
            {"genero": "Romance", "explicacion": "El amor en todas sus formas siempre te engancha"},
            {"genero": "Literary Fiction", "explicacion": "Valoras la escritura profunda y los personajes bien construidos"},
        ])

    def _insight_heuristico(self, stats: dict) -> str:
        racha = stats.get("racha_lectura", 0)
        reseñas = stats.get("total_reseñas", 0)
        if racha >= 7 and reseñas > 3:
            return "Eres una lectora reflexiva: no solo lees, procesas y compartes tu experiencia. Eso hace que tus recomendaciones sean más precisas cada vez."
        if stats.get("quiero_leer", 0) > 10:
            return "Tu lista de deseos refleja una curiosidad literaria enorme. Cada libro que agregas te dice algo sobre lo que buscas emocionalmente en ese momento."
        return "Tu patrón de lectura muestra consistencia: las lectoras constantes desarrollan un gusto más definido con el tiempo."

    def _prediccion_heuristica(self, vibe: str, stats: dict) -> str:
        mapa = {
            "romantico": "Vas a amar un romance de segunda oportunidad este mes: el vibe emocional que buscas últimamente pide exactamente eso.",
            "oscuro": "Un dark romance con un protagonista moralmente gris te va a tener leyendo de madrugada esta semana.",
            "aventurero": "Una fantasía épica con mapa propio y sistema de magia único va a ser tu próxima obsesión.",
            "misterioso": "Un thriller con narradora no confiable te va a mantener despierta queriendo descubrir la verdad.",
            "melancolico": "Una novela literaria con prosa poética y final ambiguo va a tocar exactamente las emociones que buscas ahora.",
            "cozy": "Un cozy mystery con un café de fondo y una protagonista entrañable es perfectamente lo que necesitas.",
            "esperanzador": "Una historia de crecimiento personal con final esperanzador y protagonista que lo supera todo va a ser tu lectura favorita del mes.",
        }
        return mapa.get(vibe, "Un libro que ya tienes en tu lista de deseos pero has postergado: este mes es el momento de leerlo.")

    # ------------------------------------------------------------------
    # RESUMEN Y EXPLICACIÓN (existente)
    # ------------------------------------------------------------------

    def explicar_recomendacion(self, usuario_id: int, vibe_data: dict, libros: list, inferencias: list) -> dict:
        libros_texto = "\n".join([
            f"- {l['titulo']} de {l['autor']} (género: {l['genero']})"
            for l in libros[:5]
        ])
        inferencias_texto = "\n".join([f"• {i}" for i in inferencias])
        prompt = f"""Eres el supervisor de un sistema de recomendación de libros llamado Novelia.
El usuario tiene un vibe: {vibe_data.get('vibe', 'desconocido')}
Tags detectados: {', '.join(vibe_data.get('tags', []))}
Se aplicaron estas inferencias:
{inferencias_texto}
Se recomendaron estos libros:
{libros_texto}
Genera un resumen explicando por qué se detectó ese vibe, por qué se recomendaron esos libros y qué reglas se aplicaron.
Sé amigable, claro y usa máximo 4 oraciones. Habla directamente al usuario (usa "tú"). Sin emojis."""

        if client:
            try:
                response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
                explicacion = response.text.strip()
            except Exception:
                explicacion = f"Detecté el vibe {vibe_data.get('vibe', 'desconocido')} y prioricé libros acordes con tus señales y hábitos."
        else:
            explicacion = f"Detecté el vibe {vibe_data.get('vibe', 'desconocido')} y prioricé libros acordes con tus señales y hábitos."

        return {
            "vibe_detectado": vibe_data.get("vibe"),
            "tags": vibe_data.get("tags", []),
            "inferencias": inferencias,
            "explicacion": explicacion,
            "total_recomendaciones": len(libros)
        }

    def resumen_usuario(self, usuario_id: int) -> dict:
        from models import Libro
        biblioteca = self.db.query(Biblioteca).filter(Biblioteca.usuario_id == usuario_id).all()
        reseñas = self.db.query(Reseña).filter(Reseña.usuario_id == usuario_id).all()
        actividades = self.db.query(ActividadLectura).filter(ActividadLectura.usuario_id == usuario_id).all()
        leidos = [b for b in biblioteca if b.estado == "leido"]
        leyendo = [b for b in biblioteca if b.estado == "leyendo"]
        quiero_leer = [b for b in biblioteca if b.estado == "quiero_leer"]

        # Géneros favoritos desde libros leídos
        genero_conteo = {}
        for b in leidos:
            libro = self.db.query(Libro).filter(Libro.id == b.libro_id).first()
            if libro and libro.genero:
                g = libro.genero.split(",")[0].strip()
                if g:
                    genero_conteo[g] = genero_conteo.get(g, 0) + 1
        generos_favoritos = [
            {"genero": g, "cantidad": c}
            for g, c in sorted(genero_conteo.items(), key=lambda x: x[1], reverse=True)[:5]
        ]

        rating_promedio = 0
        if reseñas:
            rating_promedio = sum(r.calificacion for r in reseñas) / len(reseñas)

        inferencias_perfil = []
        if len(leidos) > 20:
            inferencias_perfil.append("Lectora experta: más de 20 libros leídos")
        elif len(leidos) > 5:
            inferencias_perfil.append("Lectora activa: entre 5 y 20 libros leídos")
        else:
            inferencias_perfil.append("Lectora nueva: menos de 5 libros leídos")
        if rating_promedio >= 4.5:
            inferencias_perfil.append("Lectora exigente: calificación promedio alta")
        elif rating_promedio >= 3.0 and reseñas:
            inferencias_perfil.append("Lectora moderada: calificación promedio normal")
        if len(quiero_leer) > 10:
            inferencias_perfil.append("Lista de deseos grande: más de 10 libros pendientes")

        sesiones = self.db.query(SesionVibe).filter(SesionVibe.usuario_id == usuario_id).all()
        vibes_conteo = {}
        for s in sesiones:
            v = s.vibe_detectado
            vibes_conteo[v] = vibes_conteo.get(v, 0) + 1
        vibe_favorito = max(vibes_conteo, key=vibes_conteo.get) if vibes_conteo else "sin datos"

        dias_actividad = self._dias_actividad(usuario_id)
        racha_lectura = self._racha_desde_fechas(dias_actividad)
        actividad_30_dias = len([d for d in dias_actividad if (datetime.utcnow().date() - d).days <= 30])
        actividad_7_dias = len([d for d in dias_actividad if (datetime.utcnow().date() - d).days <= 7])

        if len(leidos) >= 20:
            nivel_lector = "Experto"
        elif len(leidos) >= 10:
            nivel_lector = "Avanzado"
        elif len(leidos) >= 5:
            nivel_lector = "Intermedio"
        else:
            nivel_lector = "Inicial"

        retos = [
            {"titulo": "Racha de 7 días", "descripcion": "Mantén actividad lectora durante una semana seguida.", "progreso": min(100, round((racha_lectura / 7) * 100))},
            {"titulo": "5 libros completados", "descripcion": "Alcanza cinco libros terminados para desbloquear el nivel lector.", "progreso": min(100, round((len(leidos) / 5) * 100))},
            {"titulo": "3 reseñas útiles", "descripcion": "Escribe tres reseñas con criterio para afinar tus recomendaciones.", "progreso": min(100, round((len(reseñas) / 3) * 100))},
        ]

        if not dias_actividad:
            inferencias_perfil.append("Sin actividad suficiente para calcular racha de lectura")

        return {
            "estadisticas": {
                "libros_leidos": len(leidos),
                "leyendo_ahora": len(leyendo),
                "quiero_leer": len(quiero_leer),
                "total_reseñas": len(reseñas),
                "rating_promedio": round(rating_promedio, 1),
                "racha_lectura": racha_lectura,
                "dias_activos_30": actividad_30_dias,
                "progreso_semanal": min(100, round((actividad_7_dias / 7) * 100)),
                "actividad_total": len(actividades)
            },
            "nivel_lector": nivel_lector,
            "vibe_favorito": vibe_favorito,
            "inferencias_perfil": inferencias_perfil,
            "generos_favoritos": generos_favoritos,
            "retos": retos,
            "ultima_actividad": dias_actividad[-1].isoformat() if dias_actividad else None,
            "actividad_reciente": [
                {"tipo": a.tipo, "detalle": a.detalle, "fecha": a.fecha.isoformat()}
                for a in sorted(actividades, key=lambda item: item.fecha, reverse=True)[:5]
            ]
        }

    def guardar_sesion_vibe(self, usuario_id: int, tipo: str, entrada: str, vibe_data: dict):
        sesion = SesionVibe(
            usuario_id=usuario_id,
            tipo_entrada=tipo,
            entrada_raw=entrada,
            vibe_detectado=vibe_data.get("vibe", ""),
            tags_generados=",".join(vibe_data.get("tags", []))
        )
        self.db.add(sesion)
        self.db.commit()
        self._registrar_actividad(usuario_id, "vibe", f"Analizó entrada de tipo {tipo}", 1)

    def _extraer_termino_recomendacion(self, mensaje: str) -> str:
        """Extrae el término de búsqueda principal de un mensaje de recomendación."""
        m = mensaje.lower()
        for termino in ["dark romance", "romantasy", "enemies to lovers", "slow burn",
                        "fantasy", "thriller", "misterio", "romance", "cozy", "horror",
                        "sci-fi", "ciencia ficción", "booktok", "dark academia"]:
            if termino in m:
                return termino
        return mensaje[:60] if len(mensaje) > 60 else mensaje

    def responder_chat_libros(self, usuario_id: int, mensaje: str, historial: list = None) -> dict:
        """
        Chatbot literario con historial multi-turno.
        historial = [{"role": "user"|"assistant", "content": str}, ...]
        """
        from models import Biblioteca, Reseña

        resumen = self.resumen_usuario(usuario_id)
        libros_leidos = resumen["estadisticas"]["libros_leidos"]
        racha = resumen["estadisticas"]["racha_lectura"]
        vibe = resumen.get("vibe_favorito", "sin vibe registrado")

        reseñas_obj = self.db.query(Reseña).filter(Reseña.usuario_id == usuario_id).all()
        calificacion_promedio = round(
            sum(r.calificacion for r in reseñas_obj) / len(reseñas_obj), 1
        ) if reseñas_obj else 0.0

        system_prompt = f"""Eres Novelia, una bibliotecaria virtual apasionada por los libros.
Hablas como una amiga cercana, cálida y emocionante que conoce TODAS las tendencias de BookTok, Bookstagram y Goodreads 2024-2025.
Sabes de dark romance, romantasy, enemies to lovers, slow burn, fake dating, second chance, BookTok trends, autores indie, sagas, tropes y cualquier tema literario.
Cuando recomiendes un libro siempre incluyes: título entre comillas, autor y una frase del vibe.
Responde siempre en español. Sin emojis. Máximo 4 oraciones por respuesta. Sé directa, entusiasta y específica.
Datos de esta lectora: {libros_leidos} libros leídos, calificación promedio {calificacion_promedio}, racha de {racha} días, vibe favorito: {vibe}."""

        contenidos = []
        if historial:
            for msg in historial[-8:]:
                role = "user" if msg.get("role") == "user" else "model"
                content = msg.get("content", "")
                if content.strip():
                    contenidos.append({"role": role, "parts": [{"text": content}]})

        contenidos.append({"role": "user", "parts": [{"text": mensaje}]})

        libros_encontrados = []
        intencion = self._detectar_intencion(mensaje)

        if intencion == "recomendacion":
            try:
                from agents.recommender_agent import RecommenderAgent
                termino = self._extraer_termino_recomendacion(mensaje)
                recommender = RecommenderAgent(self.db)
                libros_encontrados = recommender.obtener_libros_con_gemini([], [termino])[:4]
                if not libros_encontrados:
                    libros_encontrados = recommender._fallback_libros([], [termino])[:4]
                if libros_encontrados:
                    lista_libros = ", ".join(
                        f'"{l["titulo"]}" de {l["autor"]}' for l in libros_encontrados[:4]
                    )
                    contenidos[-1]["parts"][0]["text"] += f"\n\n[Libros disponibles que puedes mencionar: {lista_libros}]"
            except Exception:
                libros_encontrados = []

        if client:
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=contenidos,
                    config={"system_instruction": system_prompt}
                )
                respuesta = response.text.strip()
            except Exception as e:
                print(f"[CHAT ERROR] Tipo: {type(e).__name__}, Mensaje: {str(e)}")
                respuesta = self._fallback_chat_inteligente(mensaje, libros_leidos, racha, vibe)
        else:
            respuesta = self._fallback_chat_inteligente(mensaje, libros_leidos, racha, vibe)

        self._registrar_actividad(usuario_id, "chat", mensaje[:250], 1)
        return {
            "respuesta": respuesta,
            "intencion": intencion,
            "recomendaciones": libros_encontrados,
            "resumen": resumen
        }

    def _fallback_chat_inteligente(self, mensaje: str, libros_leidos: int, racha: int, vibe: str) -> str:
        """Fallback con 12 ramas distintas según la intención del mensaje."""
        m = mensaje.lower()
        if any(w in m for w in ["dark romance", "romance oscuro", "darkromance"]):
            return '"Twisted Love" de Ana Huang y "Haunting Adeline" de H.D. Carlton son mis favoritas del género. Si quieres algo más reciente, "Powerless" de Lauren Roberts tiene esa tensión perfecta.'
        if any(w in m for w in ["romantasy", "fantasía romántica", "fantasy romance"]):
            return '"Fourth Wing" de Rebecca Yarros es el que domina BookTok ahora mismo. "A Court of Thorns and Roses" de Sarah J. Maas es el clásico del género que toda amante del romantasy debe leer.'
        if any(w in m for w in ["enemies to lovers", "enemies", "rivales"]):
            return 'El trope de enemies to lovers es irresistible. "The Cruel Prince" de Holly Black y "From Blood and Ash" de Jennifer Armentrout lo tienen en su forma más adictiva.'
        if any(w in m for w in ["slow burn", "tensión", "tension"]):
            return '"Book Lovers" de Emily Henry tiene uno de los slow burns más bien escritos del romance contemporáneo. "People We Meet on Vacation" también es perfecta si buscas esa tensión sostenida.'
        if any(w in m for w in ["booktok", "tendencia", "tendencias", "viral", "trend"]):
            return 'En BookTok ahora dominan el romantasy y el dark romance. "Iron Flame", "Powerless" y "From Blood and Ash" están en todas las listas. El trope más buscado este año es enemies to lovers con magia.'
        if any(w in m for w in ["misterio", "thriller", "suspense", "crimen"]):
            return '"The Silent Patient" de Alex Michaelides y "Verity" de Colleen Hoover son los más recomendados en thrillers. Si quieres algo más oscuro, "The Atlas Six" de Olivie Blake tiene esa mezcla perfecta.'
        if any(w in m for w in ["cozy", "comfort", "ligero", "tranquilo"]):
            return '"The House in the Cerulean Sea" de TJ Klune es el libro cozy por excelencia. "Beach Read" de Emily Henry también es perfecta para esos momentos donde solo quieres sentirte bien.'
        if any(w in m for w in ["autor", "autora", "quien escribe", "quien es"]):
            return 'Para dark romance: Ana Huang, H.D. Carlton y Penelope Douglas. Para romantasy: Rebecca Yarros, Sarah J. Maas y Jennifer Armentrout. Para romance contemporáneo: Emily Henry y Colleen Hoover.'
        if any(w in m for w in ["escribir", "redactar", "novela propia", "como escribo", "escribo"]):
            return 'Para empezar a escribir, lo más importante es leer mucho en el género que quieres crear. Define a tu protagonista antes que la trama, y escribe aunque sea 100 palabras al día. La constancia hace más que la inspiración.'
        if any(w in m for w in ["saga", "serie", "continuación", "orden de lectura"]):
            return 'Para sagas de romantasy te recomiendo empezar por "A Court of Thorns and Roses" de Maas (5 libros) o "From Blood and Ash" de Armentrout (4 libros). Ambas tienen mundos increíblemente construidos.'
        if any(w in m for w in ["recomienda", "recomiéndame", "sugiere", "qué leer", "siguiente"]):
            if libros_leidos > 10:
                return f'Con {libros_leidos} libros en tu historial eres una lectora con criterio. Te recomiendo explorar "Babel" de R.F. Kuang o "The Atlas Six" de Olivie Blake para algo más desafiante de lo habitual.'
            return '"It Ends With Us" de Colleen Hoover si quieres emocionarte de verdad, o "The Seven Husbands of Evelyn Hugo" de Taylor Jenkins Reid si buscas algo que te deje pensando días.'
        return 'Cuéntame más sobre qué tipo de emociones o géneros te llaman la atención y te encuentro la lectura perfecta.'
