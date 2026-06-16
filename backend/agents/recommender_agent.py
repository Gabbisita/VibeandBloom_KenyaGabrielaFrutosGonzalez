import json
import os
import re
import requests
from dotenv import load_dotenv

try:
    from google import genai
except Exception:
    genai = None

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if genai and GEMINI_API_KEY else None


class RecommenderAgent:
    def __init__(self, db):
        self.db = db
        self.open_library_url = "https://openlibrary.org/search.json"

    # ------------------------------------------------------------------
    # REGLAS DE INFERENCIA — Vibe
    # ------------------------------------------------------------------

    def aplicar_reglas(self, usuario_id: int, vibe_data: dict) -> dict:
        from models import Biblioteca, Reseña

        inferencias = []
        generos = vibe_data.get("generos", [])
        tags = vibe_data.get("tags", [])

        libros_leidos = self.db.query(Biblioteca).filter(
            Biblioteca.usuario_id == usuario_id,
            Biblioteca.estado == "leido"
        ).count()

        if libros_leidos > 20:
            inferencias.append("Usuario experto: más de 20 libros leídos, se priorizan libros menos conocidos")

        vibe = vibe_data.get("vibe", "")
        mapa_vibe = {
            "melancolico": ["drama", "literary fiction", "poetry"],
            "romantico": ["romance", "love story", "contemporary romance"],
            "misterioso": ["thriller", "mystery", "suspense"],
            "cozy": ["contemporary fiction", "cozy mystery", "slice of life"],
            "aventurero": ["fantasy", "adventure", "science fiction"],
            "oscuro": ["dark romance", "horror", "psychological thriller"],
            "esperanzador": ["coming of age", "inspirational", "literary fiction"],
        }
        if vibe in mapa_vibe:
            generos = mapa_vibe[vibe]
            inferencias.append(f"Vibe '{vibe}' detectado: géneros recomendados son {', '.join(generos)}")

        reseñas = self.db.query(Reseña).filter(Reseña.usuario_id == usuario_id).all()
        if reseñas:
            promedio = sum(r.calificacion for r in reseñas) / len(reseñas)
            if promedio >= 4.5:
                inferencias.append("Lector exigente: calificación promedio >= 4.5, se priorizan libros muy bien valorados")

        return {
            "generos_finales": generos,
            "tags": tags,
            "inferencias": inferencias,
        }

    # ------------------------------------------------------------------
    # RECOMENDACIÓN POR PERFIL (Nuevo — Agente 2)
    # ------------------------------------------------------------------

    def _construir_perfil_lector(self, usuario_id: int) -> dict:
        from models import Biblioteca, Reseña, ActividadLectura, SesionVibe, Libro
        from datetime import datetime

        biblioteca = self.db.query(Biblioteca).filter(Biblioteca.usuario_id == usuario_id).all()
        leidos = [b for b in biblioteca if b.estado == "leido"]
        leyendo = [b for b in biblioteca if b.estado == "leyendo"]
        quiero_leer = [b for b in biblioteca if b.estado == "quiero_leer"]
        reseñas = self.db.query(Reseña).filter(Reseña.usuario_id == usuario_id).all()

        # Géneros favoritos
        genero_conteo = {}
        for b in leidos:
            libro = self.db.query(Libro).filter(Libro.id == b.libro_id).first()
            if libro and libro.genero:
                for g in libro.genero.split(","):
                    g = g.strip().lower()
                    if g:
                        genero_conteo[g] = genero_conteo.get(g, 0) + 1
        generos_favoritos = sorted(genero_conteo, key=genero_conteo.get, reverse=True)[:3]

        # Calificación promedio
        rating_promedio = 0.0
        if reseñas:
            rating_promedio = sum(r.calificacion for r in reseñas) / len(reseñas)

        # Racha de lectura
        from datetime import date
        actividades = self.db.query(ActividadLectura).filter(
            ActividadLectura.usuario_id == usuario_id
        ).all()
        fechas = set()
        for a in actividades:
            fechas.add(a.fecha.date())
        for b in biblioteca:
            fechas.add(b.fecha_agregado.date())
        fechas_ord = sorted(fechas, reverse=True)
        racha = 0
        if fechas_ord:
            racha = 1
            f_actual = fechas_ord[0]
            for f in fechas_ord[1:]:
                if (f_actual - f).days == 1:
                    racha += 1
                    f_actual = f
                else:
                    break

        # Vibes
        sesiones = self.db.query(SesionVibe).filter(SesionVibe.usuario_id == usuario_id).all()
        vibe_conteo = {}
        for s in sesiones:
            if s.vibe_detectado:
                vibe_conteo[s.vibe_detectado] = vibe_conteo.get(s.vibe_detectado, 0) + 1
        vibe_favorito = max(vibe_conteo, key=vibe_conteo.get) if vibe_conteo else None

        return {
            "libros_leidos": len(leidos),
            "leyendo_ahora": len(leyendo),
            "quiero_leer": len(quiero_leer),
            "generos_favoritos": generos_favoritos,
            "rating_promedio": round(rating_promedio, 2),
            "total_reseñas": len(reseñas),
            "racha_activa": racha,
            "vibe_favorito": vibe_favorito,
        }

    def _aplicar_inferencias_perfil(self, perfil: dict) -> list:
        inferencias = []
        n = perfil["libros_leidos"]
        rating = perfil["rating_promedio"]
        generos = perfil["generos_favoritos"]
        racha = perfil["racha_activa"]

        if n > 20:
            inferencias.append("Lectora experta (>20 libros): se priorizan títulos menos mainstream")
        elif n > 5:
            inferencias.append("Lectora activa (5-20 libros): se mezclan títulos populares con descubrimientos")
        else:
            inferencias.append("Lectora nueva (<5 libros): se priorizan títulos de alta popularidad en BookTok")

        if rating >= 4.5:
            inferencias.append("Calificación promedio >= 4.5: se priorizan libros muy bien valorados por la comunidad")

        if "romance" in generos and n > 5:
            inferencias.append("Lectora de romance con experiencia: se sugieren subgéneros dark romance y romantasy")

        if racha >= 7:
            inferencias.append("Racha activa >= 7 días: se incluye al menos un libro largo o inicio de saga")

        if rating < 3.5 and n > 3:
            inferencias.append("Calificación promedio baja: posiblemente los géneros leídos no son los ideales, se amplía la búsqueda")

        return inferencias

    def _texto_perfil(self, perfil: dict, inferencias: list) -> str:
        generos_str = ", ".join(perfil["generos_favoritos"]) if perfil["generos_favoritos"] else "variados"
        vibe = perfil.get("vibe_favorito") or "sin datos de vibe"
        return (
            f"Lectora con {perfil['libros_leidos']} libros leídos. "
            f"Géneros preferidos: {generos_str}. "
            f"Calificación promedio: {perfil['rating_promedio']}/5. "
            f"Racha activa de {perfil['racha_activa']} días. "
            f"Ha escrito {perfil['total_reseñas']} reseñas. "
            f"Vibe favorito detectado: {vibe}. "
            f"Inferencias aplicadas: {'; '.join(inferencias)}."
        )

    def recomendar_por_perfil(self, usuario_id: int) -> dict:
        perfil = self._construir_perfil_lector(usuario_id)
        inferencias = self._aplicar_inferencias_perfil(perfil)
        perfil_texto = self._texto_perfil(perfil, inferencias)

        if not client:
            libros = self._fallback_libros_perfil(perfil, inferencias)
            return {
                "libros": libros,
                "perfil_lector": perfil_texto,
                "inferencias_aplicadas": inferencias
            }

        prompt = f"""Eres un experto en literatura y tendencias BookTok. Analiza este perfil de lectora y recomienda exactamente 5 libros personalizados.

Perfil:
{perfil_texto}

Responde SOLO con este JSON exacto (sin texto extra, sin markdown):
[
  {{
    "titulo": "Título del libro",
    "autor": "Nombre Autor",
    "descripcion": "Sinopsis breve de 2 oraciones que capture el vibe del libro.",
    "genero": "género principal",
    "por_que": "Razón específica por la que esta lectora va a amar este libro, en 1 oración.",
    "vibe_tags": ["tag1", "tag2", "tag3"]
  }}
]

Los libros deben ser publicados después de 2010, conocidos en BookTok/Goodreads, y variados entre sí. Responde en español."""

        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            text = re.sub(r"```json|```", "", response.text).strip()
            libros_raw = json.loads(text)
            libros = []
            for i, libro in enumerate(libros_raw[:5]):
                titulo = libro.get("titulo", "")
                autor = libro.get("autor", "")
                libros.append({
                    "id": f"perfil_{i}_{titulo.replace(' ', '_')[:20]}",
                    "titulo": titulo,
                    "autor": autor,
                    "descripcion": libro.get("descripcion", ""),
                    "genero": libro.get("genero", ""),
                    "por_que": libro.get("por_que", ""),
                    "vibe_tags": libro.get("vibe_tags", []),
                    "portada_url": self.buscar_portada(titulo, autor),
                })
        except Exception:
            libros = self._fallback_libros_perfil(perfil, inferencias)

        return {
            "libros": libros,
            "perfil_lector": perfil_texto,
            "inferencias_aplicadas": inferencias
        }

    def _fallback_libros_perfil(self, perfil: dict, inferencias: list) -> list:
        base = [
            {"titulo": "Fourth Wing", "autor": "Rebecca Yarros", "descripcion": "Fantasía épica con romance intenso y una academia de jinetes de dragones. Mezcla de romantasy con tensión constante.", "genero": "romantasy", "por_que": "Es el libro del año en BookTok y tiene todo el vibe romantasy que las lectoras activas adoran.", "vibe_tags": ["romantasy", "academia", "enemies to lovers"]},
            {"titulo": "The Seven Husbands of Evelyn Hugo", "autor": "Taylor Jenkins Reid", "descripcion": "Drama histórico sobre una actriz legendaria y los secretos de su vida. Narración adictiva con giros inesperados.", "genero": "literary fiction", "por_que": "Combina drama, romance y personajes complejos que generan conversación en toda la comunidad lectora.", "vibe_tags": ["drama", "personajes complejos", "secretos"]},
            {"titulo": "Happy Place", "autor": "Emily Henry", "descripcion": "Romance contemporáneo entre dos exnovios que deben fingir que siguen juntos durante unas vacaciones.", "genero": "contemporary romance", "por_que": "Emily Henry es la reina del romance inteligente en BookTok con diálogos perfectos.", "vibe_tags": ["segunda oportunidad", "humor", "slow burn"]},
            {"titulo": "A Good Girl's Guide to Murder", "autor": "Holly Jackson", "descripcion": "Una joven reinvestiga un crimen cerrado en su pueblo y descubre verdades peligrosas.", "genero": "thriller", "por_que": "Ritmo adictivo y misterio bien construido, perfecto para lectoras que quieren algo diferente al romance.", "vibe_tags": ["misterio", "thriller", "investigación"]},
            {"titulo": "Twisted Love", "autor": "Ana Huang", "descripcion": "Dark romance entre una chica optimista y el mejor amigo de su hermano, frío y calculador.", "genero": "dark romance", "por_que": "Dark romance adictivo con tensión sexual constante, uno de los más virales en BookTok.", "vibe_tags": ["dark romance", "forbidden love", "intenso"]},
        ]
        libros = []
        for i, libro in enumerate(base):
            libros.append({
                "id": f"fallback_perfil_{i}",
                "titulo": libro["titulo"],
                "autor": libro["autor"],
                "descripcion": libro["descripcion"],
                "genero": libro["genero"],
                "por_que": libro["por_que"],
                "vibe_tags": libro["vibe_tags"],
                "portada_url": self.buscar_portada(libro["titulo"], libro["autor"]),
            })
        return libros

    # ------------------------------------------------------------------
    # RECOMENDACIÓN POR VIBE (existente)
    # ------------------------------------------------------------------

    def obtener_libros_con_gemini(self, generos: list, tags: list) -> list:
        if not client:
            return self._fallback_libros(generos, tags)

        import random
        seed_palabras = [
            "populares en BookTok", "recientes y aclamadas", "joyas ocultas",
            "virales en Goodreads 2024", "publicadas después de 2020", "imprescindibles del género"
        ]
        seed = random.choice(seed_palabras)

        prompt = f"""Recomienda 6 libros {seed} de los géneros: {', '.join(generos[:3])}.
Mood/tags: {', '.join(tags[:4])}.
Varía los libros, no siempre los mismos. Responde SOLO con JSON válido, sin texto extra ni backticks:
[
  {{"titulo": "Título exacto", "autor": "Nombre Autor", "descripcion": "Sinopsis de 2 oraciones.", "genero": "género", "vibe_tags": ["tag1", "tag2"], "por_que": "Por qué encaja con el mood pedido"}},
  ...6 libros total
]"""

        try:
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            text = re.sub(r"```json|```", "", response.text).strip()
            libros_raw = json.loads(text)
            libros = []
            for i, libro in enumerate(libros_raw[:6]):
                titulo = libro.get("titulo", "")
                autor = libro.get("autor", "")
                portada = self.buscar_portada(titulo, autor)
                libros.append({
                    "id": f"gemini_{i}_{titulo.replace(' ', '_')[:20]}",
                    "titulo": titulo,
                    "autor": autor,
                    "descripcion": libro.get("descripcion", ""),
                    "portada_url": portada,
                    "genero": libro.get("genero", generos[0] if generos else ""),
                    "tags": ", ".join(libro.get("vibe_tags", tags[:2])),
                    "vibe_tags": libro.get("vibe_tags", []),
                    "por_que": libro.get("por_que", "")
                })
            if libros:
                return libros
        except Exception as e:
            print(f"Gemini recomendador error: {e}")

        return self._fallback_libros(generos, tags)

    def buscar_portada(self, titulo: str, autor: str) -> str:
        try:
            params = {"q": f"{titulo} {autor}", "limit": 1, "fields": "cover_i"}
            response = requests.get(self.open_library_url, params=params, timeout=20)
            data = response.json()
            docs = data.get("docs", [])
            if docs and docs[0].get("cover_i"):
                cover_id = docs[0]["cover_i"]
                return f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"
        except Exception:
            pass
        return f"https://covers.openlibrary.org/b/title/{titulo.replace(' ', '+')}-M.jpg"

    def _fallback_libros(self, generos: list, tags: list) -> list:
        import random
        base = [
            {"titulo": "Fourth Wing", "autor": "Rebecca Yarros", "genero": "romantasy", "vibe_tags": ["romantasy", "academia", "enemies to lovers"]},
            {"titulo": "Iron Flame", "autor": "Rebecca Yarros", "genero": "romantasy", "vibe_tags": ["romantasy", "saga", "intenso"]},
            {"titulo": "Powerless", "autor": "Lauren Roberts", "genero": "fantasy", "vibe_tags": ["fantasy", "viralBookTok", "enemies to lovers"]},
            {"titulo": "From Blood and Ash", "autor": "Jennifer L. Armentrout", "genero": "fantasy romance", "vibe_tags": ["fantasy", "romance", "forbidden love"]},
            {"titulo": "A Court of Thorns and Roses", "autor": "Sarah J. Maas", "genero": "fantasy", "vibe_tags": ["romantasy", "clásico", "fae"]},
            {"titulo": "Twisted Love", "autor": "Ana Huang", "genero": "dark romance", "vibe_tags": ["dark romance", "forbidden love", "intenso"]},
            {"titulo": "Haunting Adeline", "autor": "H.D. Carlton", "genero": "dark romance", "vibe_tags": ["dark romance", "oscuro", "perturbador"]},
            {"titulo": "Ugly Love", "autor": "Colleen Hoover", "genero": "romance", "vibe_tags": ["romance", "emocional", "slow burn"]},
            {"titulo": "It Ends With Us", "autor": "Colleen Hoover", "genero": "romance", "vibe_tags": ["romance", "drama", "emocional"]},
            {"titulo": "Verity", "autor": "Colleen Hoover", "genero": "thriller", "vibe_tags": ["thriller", "giro final", "oscuro"]},
            {"titulo": "The Silent Patient", "autor": "Alex Michaelides", "genero": "thriller", "vibe_tags": ["thriller", "misterio", "psicológico"]},
            {"titulo": "Book Lovers", "autor": "Emily Henry", "genero": "romance", "vibe_tags": ["romance", "humor", "libros"]},
            {"titulo": "Happy Place", "autor": "Emily Henry", "genero": "romance", "vibe_tags": ["romance", "segunda oportunidad", "humor"]},
            {"titulo": "People We Meet on Vacation", "autor": "Emily Henry", "genero": "romance", "vibe_tags": ["romance", "viajes", "amigos"]},
            {"titulo": "Beach Read", "autor": "Emily Henry", "genero": "romance", "vibe_tags": ["romance", "verano", "escritores"]},
            {"titulo": "The Seven Husbands of Evelyn Hugo", "autor": "Taylor Jenkins Reid", "genero": "literary fiction", "vibe_tags": ["drama", "Hollywood", "secretos"]},
            {"titulo": "Daisy Jones and The Six", "autor": "Taylor Jenkins Reid", "genero": "literary fiction", "vibe_tags": ["música", "drama", "años 70"]},
            {"titulo": "Tomorrow and Tomorrow and Tomorrow", "autor": "Gabrielle Zevin", "genero": "literary fiction", "vibe_tags": ["videojuegos", "amistad", "profundo"]},
            {"titulo": "Babel", "autor": "R.F. Kuang", "genero": "historical fantasy", "vibe_tags": ["dark academia", "magia", "histórico"]},
            {"titulo": "The Atlas Six", "autor": "Olivie Blake", "genero": "dark fantasy", "vibe_tags": ["dark academia", "magia", "moralmente gris"]},
            {"titulo": "A Good Girl's Guide to Murder", "autor": "Holly Jackson", "genero": "mystery", "vibe_tags": ["misterio", "investigación", "juvenil"]},
            {"titulo": "The House in the Cerulean Sea", "autor": "TJ Klune", "genero": "cozy fantasy", "vibe_tags": ["cozy", "mágico", "esperanzador"]},
            {"titulo": "Lessons in Chemistry", "autor": "Bonnie Garmus", "genero": "literary fiction", "vibe_tags": ["feminismo", "humor", "inspirador"]},
            {"titulo": "The Midnight Library", "autor": "Matt Haig", "genero": "contemporary fiction", "vibe_tags": ["esperanzador", "reflexivo", "second chances"]},
            {"titulo": "Normal People", "autor": "Sally Rooney", "genero": "literary fiction", "vibe_tags": ["romance", "literario", "relaciones"]},
            {"titulo": "The Love Hypothesis", "autor": "Ali Hazelwood", "genero": "romance", "vibe_tags": ["romance", "academia", "stem"]},
            {"titulo": "Icebreaker", "autor": "Hannah Grace", "genero": "romance", "vibe_tags": ["romance", "deportes", "enemies to lovers"]},
            {"titulo": "The Spanish Love Deception", "autor": "Elena Armas", "genero": "romance", "vibe_tags": ["romance", "fake dating", "humor"]},
            {"titulo": "The Cruel Prince", "autor": "Holly Black", "genero": "fantasy", "vibe_tags": ["fae", "dark", "enemies to lovers"]},
            {"titulo": "Kingdom of the Wicked", "autor": "Kerri Maniscalco", "genero": "historical fantasy", "vibe_tags": ["histórico", "misterio", "sicilia"]},
        ]
        random.shuffle(base)
        libros = []
        for i, libro in enumerate(base[:6]):
            portada = self.buscar_portada(libro["titulo"], libro["autor"])
            libros.append({
                "id": f"fallback_{i}_{libro['titulo'].replace(' ', '_')[:15]}",
                "titulo": libro["titulo"],
                "autor": libro["autor"],
                "descripcion": f"Recomendado para el género {libro['genero']}.",
                "portada_url": portada,
                "genero": libro["genero"],
                "tags": ", ".join(tags[:2]) if tags else libro["genero"],
                "vibe_tags": libro.get("vibe_tags", []),
                "por_que": "Tendencia actual en comunidades lectoras."
            })
        return libros

    def recomendar(self, usuario_id: int, vibe_data: dict) -> dict:
        from models import Biblioteca

        reglas = self.aplicar_reglas(usuario_id, vibe_data)
        libros = self.obtener_libros_con_gemini(reglas["generos_finales"], reglas["tags"])

        ids_biblioteca = [
            b.libro_id for b in self.db.query(Biblioteca).filter(
                Biblioteca.usuario_id == usuario_id
            ).all()
        ]
        libros_filtrados = [libro for libro in libros if libro["id"] not in ids_biblioteca]

        return {
            "libros": libros_filtrados[:5],
            "inferencias": reglas["inferencias"],
            "generos_usados": reglas["generos_finales"],
        }
