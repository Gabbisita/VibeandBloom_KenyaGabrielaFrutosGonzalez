# Novelia

Aplicación web para lectoras construida con tres agentes de IA que personalizan la experiencia literaria. El sistema detecta vibes emocionales, recomienda libros según el perfil lector y explica en lenguaje natural por qué toma cada decisión.

---

## Descripción

Novelia es una plataforma literaria inteligente donde:

- Un **chatbot literario** (Novelia) conversa como una amiga bookworm, conoce todas las tendencias de BookTok 2020-2026 y responde en lenguaje natural usando Gemini API con historial de conversación
- Un **recomendador por perfil** analiza el historial real de lectura de cada usuaria y aplica reglas de inferencia explícitas para sugerir libros personalizados
- Un **supervisor** genera un análisis narrativo del perfil lector: tipo de lectora, géneros del alma, insight y predicción del mes
- Las **reseñas** se enriquecen automáticamente con sentimiento y tags generados por IA

---

## Arquitectura de Agentes IA

### Agente 1 — Librarian Agent (`librarian_agent.py`)

- **Función**: `chat_literario(mensaje, usuario_id, historial)`
- **Motor**: Gemini 2.0 Flash con system prompt como Novelia (bibliotecaria virtual)
- **Contexto**: Recibe historial completo de conversación para mantener coherencia
- **Detección de intención**: recomendacion / autor / escritura / tendencias / tropes / saga
- **Extracción de libros**: detecta títulos mencionados en la respuesta para mostrarlos como chips clicables
- **Análisis de reseñas**: extrae sentimiento (positivo/negativo/mixto) y hasta 3 tags automáticos

### Agente 2 — Recommender Agent (`recommender_agent.py`)

- **Función**: `recomendar_por_perfil(usuario_id)`
- **Reglas de inferencia explícitas**:
  - `IF libros_leidos > 20 THEN priorizar libros menos mainstream`
  - `IF calificacion_promedio >= 4.5 THEN priorizar libros muy bien valorados`
  - `IF genero_favorito == "romance" AND libros_leidos > 5 THEN sugerir dark romance y romantasy`
  - `IF racha_activa >= 7 THEN incluir libro largo o saga`
  - `IF calificacion_promedio < 3.5 AND libros_leidos > 3 THEN ampliar géneros`
- **Salida**: 5 libros con título, autor, descripción, género, `por_que` (razón personalizada) y `vibe_tags`
- **Portadas**: Open Library Covers API con fallback SVG

### Agente 3 — Supervisor Agent (`supervisor_agent.py`)

- **Función**: `generar_reporte_usuario(usuario_id)`
- **Motor**: Gemini 2.0 Flash
- **Genera**:
  - `tipo_lectora`: frase creativa que describe a la lectora
  - `generos_alma`: top 3 géneros con explicación
  - `insight`: observación sorprendente sobre sus hábitos
  - `prediccion`: libro o género que va a amar este mes
  - `inferencias`: las reglas aplicadas en lenguaje amigable (explicabilidad)
- **Fallbacks heurísticos**: si Gemini no responde, genera el reporte con lógica local

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11 + FastAPI |
| Base de datos | SQLite con SQLAlchemy ORM |
| IA | Google Gemini API (`gemini-2.0-flash`, `gemini-2.0-flash-lite`) |
| Portadas | Open Library Covers API |
| Frontend | React 19 + React Router |
| Iconos | react-icons/hi2 (HeroIcons v2) |
| Tipografía | Playfair Display (títulos) + Inter (cuerpo) |
| Auth | JWT con python-jose |

---

## Instalación

### Requisitos

- Python 3.10+
- Node.js 18+
- Google Gemini API Key (gratis en [Google AI Studio](https://aistudio.google.com/))

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edita .env y agrega tu GEMINI_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

La app corre en `http://localhost:3000` y el backend en `http://localhost:8000`.

---

## Variables de entorno

Crea `backend/.env` basado en `backend/.env.example`:

```env
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
SECRET_KEY=una_clave_secreta_larga_y_aleatoria
DATABASE_URL=sqlite:///./novelia.db
```

### Obtener Gemini API Key

1. Ve a [https://aistudio.google.com/](https://aistudio.google.com/)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Get API Key"
4. Crea una nueva API key y cópiala en el `.env`

---

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/registro` | Registrar nueva usuaria |
| POST | `/login` | Iniciar sesión (devuelve JWT) |
| POST | `/chat` | Chat literario con historial (Agente 1) |
| GET | `/recomendar/perfil` | Recomendaciones personalizadas (Agente 2) |
| GET | `/supervisor/reporte` | Análisis narrativo del perfil (Agente 3) |
| POST | `/vibe/texto` | Detectar vibe desde texto |
| POST | `/vibe/cancion` | Detectar vibe desde canción |
| POST | `/vibe/imagen` | Detectar vibe desde imagen |
| GET | `/biblioteca` | Libros del usuario por estado |
| POST | `/biblioteca/agregar` | Agregar libro a biblioteca |
| POST | `/biblioteca/progreso` | Actualizar progreso de lectura |
| GET | `/resenas/{libro_id}` | Reseñas de un libro |
| POST | `/resenas` | Publicar reseña (con análisis IA) |
| GET | `/perfil/resumen` | Estadísticas completas del usuario |
| GET | `/estadisticas` | Alias de perfil/resumen |

---

## Inferencias implementadas

El sistema aplica reglas de inferencia en dos agentes:

**Recomendador por Vibe:**
- Mapea el vibe detectado (melancolico, romantico, misterioso, cozy, aventurero, oscuro, esperanzador) a géneros literarios
- Penaliza libros ya leídos para no repetir recomendaciones
- Prioriza libros menos conocidos para lectoras expertas (>20 libros)

**Recomendador por Perfil:**
- Analiza géneros favoritos de la biblioteca personal
- Ajusta recomendaciones según calificación promedio
- Sugiere subgéneros según experiencia acumulada en romance
- Incluye sagas o libros largos cuando la racha es alta

**Supervisor:**
- Clasifica el nivel lector (Inicial / Intermedio / Avanzado / Experto)
- Genera el "tipo de lectora" con razonamiento narrativo
- Explica cada inferencia en lenguaje natural para cumplir con la explicabilidad del sistema experto

---

## Diseño

- Paleta oscura café: `#1C1714` (fondo), `#C9A882` (acento cálido), `#5C4033` (profundo)
- Tipografía: Playfair Display para títulos, Inter para cuerpo
- Animaciones: fade-in al montar páginas, scale en modales, hover en tarjetas
- Responsive: sidebar en desktop (1280px+), bottom nav en móvil (375px)
- Sin emojis: solo iconos SVG de HeroIcons v2 (`react-icons/hi2`)
