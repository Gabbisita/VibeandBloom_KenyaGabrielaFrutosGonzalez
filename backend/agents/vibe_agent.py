import os
from dotenv import load_dotenv
import base64
import re

try:
    from google import genai
except Exception:
    genai = None

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if genai and GEMINI_API_KEY else None

class VibeAgent:
    def _heuristica_local(self, texto: str) -> dict:
        normalizado = texto.lower()
        mapa = {
            "romantico": ["amor", "romance", "pareja", "novio", "novia", "crush", "booktok"],
            "misterioso": ["misterio", "secreto", "asesinato", "thriller", "investig", "enigma"],
            "cozy": ["cozy", "calma", "hogar", "taza", "café", "invierno", "suave"],
            "aventurero": ["viaje", "aventura", "dragon", "explorar", "escape", "mundo"],
            "oscuro": ["oscuro", "dark", "terror", "sombra", "gore", "tension"],
            "esperanzador": ["esperanza", "sanar", "crecer", "renacer", "futuro", "superar"],
            "melancolico": ["triste", "lluvia", "melancol", "nostalgia", "recuerdo", "dolor"]
        }
        conteo = {vibe: sum(1 for palabra in palabras if palabra in normalizado) for vibe, palabras in mapa.items()}
        vibe = max(conteo, key=conteo.get) if any(conteo.values()) else "cozy"
        tags = {
            "romantico": ["amor", "slow burn", "booktok", "tensión emocional", "dueto"],
            "misterioso": ["pistas", "secreto", "suspenso", "giro", "investigación"],
            "cozy": ["calmado", "hogareño", "lectura ligera", "comfort", "atmosférico"],
            "aventurero": ["viaje", "exploración", "ritmo", "descubrimiento", "épica"],
            "oscuro": ["tenso", "intenso", "gótico", "sombrío", "psicológico"],
            "esperanzador": ["crecimiento", "sanación", "optimismo", "cambio", "renacer"],
            "melancolico": ["nostalgia", "lluvia", "memoria", "sensibilidad", "catarsis"],
        }[vibe]
        generos = {
            "romantico": ["romance", "contemporary romance", "young adult"],
            "misterioso": ["thriller", "mystery", "suspense"],
            "cozy": ["cozy mystery", "contemporary fiction", "slice of life"],
            "aventurero": ["fantasy", "adventure", "science fiction"],
            "oscuro": ["horror", "psychological thriller", "dark romance"],
            "esperanzador": ["inspirational", "coming of age", "literary fiction"],
            "melancolico": ["literary fiction", "poetry", "drama"],
        }[vibe]
        return {
            "tipo": "local",
            "vibe": vibe,
            "tags": tags,
            "generos": generos,
            "explicacion": f"Detecté un tono {vibe} por las palabras y señales del texto, así que prioricé géneros y etiquetas coherentes con esa emoción."
        }

    def _analizar_localmente(self, contenido: str, tipo: str) -> dict:
        resultado = self._heuristica_local(contenido)
        resultado["tipo"] = tipo
        return resultado

    def _fallback_imagen(self) -> dict:
        return {
            "tipo": "imagen",
            "vibe": "cozy",
            "tags": ["visual", "atmósfera", "relajada", "sensación cálida", "interpretación local"],
            "generos": ["contemporary fiction", "cozy mystery", "slice of life"],
            "explicacion": "No fue posible usar el modelo visual en este momento, así que apliqué una inferencia local conservadora para no interrumpir tu recomendación."
        }

    def detectar_desde_texto(self, texto: str) -> dict:
        if not client:
            return self._analizar_localmente(texto, "texto")
        prompt = f"""
        Eres un experto en emociones y literatura. Analiza este texto y detecta el vibe emocional.
        Texto: "{texto}"

        Responde EXACTAMENTE en este formato:
        VIBE: [una palabra: melancolico/romantico/misterioso/cozy/aventurero/oscuro/esperanzador]
        TAGS: [5 palabras separadas por comas]
        GENEROS: [3 géneros literarios separados por comas]
        EXPLICACION: [una oración explicando por qué]
        """
        try:
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            parsed = self._parsear_respuesta(response.text, "texto")
            if parsed.get("vibe"):
                return parsed
        except Exception:
            pass
        return self._analizar_localmente(texto, "texto")

    def detectar_desde_imagen(self, imagen_bytes: bytes) -> dict:
        if not client:
            return self._fallback_imagen()
        imagen_base64 = base64.b64encode(imagen_bytes).decode("utf-8")
        prompt = """
        Analiza esta imagen y detecta el vibe emocional para recomendar libros.
        
        Responde EXACTAMENTE en este formato:
        VIBE: [una palabra: melancolico/romantico/misterioso/cozy/aventurero/oscuro/esperanzador]
        TAGS: [5 palabras separadas por comas]
        GENEROS: [3 géneros literarios separados por comas]
        EXPLICACION: [una oración explicando por qué]
        """
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[{
                    "parts": [
                        {"inline_data": {"mime_type": "image/jpeg", "data": imagen_base64}},
                        {"text": prompt}
                    ]
                }]
            )
            parsed = self._parsear_respuesta(response.text, "imagen")
            if parsed.get("vibe"):
                return parsed
        except Exception:
            pass
        return self._fallback_imagen()

    def detectar_desde_cancion(self, nombre_cancion: str, artista: str = "") -> dict:
        if not client:
            return self._analizar_localmente(f"{nombre_cancion} {artista}", "cancion")
        prompt = f"""
        Analiza la canción "{nombre_cancion}" {f"de {artista}" if artista else ""}.
        Basándote en el género musical, letra típica y mood de esta canción,
        detecta el vibe emocional para recomendar libros.
        
        Responde EXACTAMENTE en este formato:
        VIBE: [una palabra: melancolico/romantico/misterioso/cozy/aventurero/oscuro/esperanzador]
        TAGS: [5 palabras separadas por comas]
        GENEROS: [3 géneros literarios separados por comas]
        EXPLICACION: [una oración explicando por qué]
        """
        try:
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            parsed = self._parsear_respuesta(response.text, "cancion")
            if parsed.get("vibe"):
                return parsed
        except Exception:
            pass
        return self._analizar_localmente(f"{nombre_cancion} {artista}", "cancion")

    def detectar_desde_video(self, url_youtube: str) -> dict:
        # Extraer video ID de la URL
        video_id = None
        for patron in [r'v=([a-zA-Z0-9_-]{11})', r'youtu\.be/([a-zA-Z0-9_-]{11})']:
            m = re.search(patron, url_youtube)
            if m:
                video_id = m.group(1)
                break

        if not client:
            return self._analizar_localmente(url_youtube, "video")

        prompt = f"""Basándote en esta URL de YouTube: {url_youtube}
{"Video ID: " + video_id if video_id else ""}
Analiza el contexto probable del video y detecta el vibe emocional para recomendar libros.

Responde EXACTAMENTE en este formato:
VIBE: [una palabra: melancolico/romantico/misterioso/cozy/aventurero/oscuro/esperanzador]
TAGS: [5 palabras separadas por comas]
GENEROS: [3 géneros literarios separados por comas]
EXPLICACION: [una oración explicando por qué]"""
        try:
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            parsed = self._parsear_respuesta(response.text, "video")
            if parsed.get("vibe"):
                return parsed
        except Exception:
            pass
        return self._analizar_localmente(url_youtube, "video")

    def _parsear_respuesta(self, texto: str, tipo: str) -> dict:
        lineas = texto.strip().split("\n")
        resultado = {"tipo": tipo, "vibe": "", "tags": [], "generos": [], "explicacion": ""}
        for linea in lineas:
            if linea.startswith("VIBE:"):
                resultado["vibe"] = linea.replace("VIBE:", "").strip().lower()
            elif linea.startswith("TAGS:"):
                resultado["tags"] = [t.strip() for t in linea.replace("TAGS:", "").split(",")]
            elif linea.startswith("GENEROS:"):
                resultado["generos"] = [g.strip() for g in linea.replace("GENEROS:", "").split(",")]
            elif linea.startswith("EXPLICACION:"):
                resultado["explicacion"] = linea.replace("EXPLICACION:", "").strip()
        return resultado