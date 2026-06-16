from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv

from models import get_db, crear_tablas, Usuario
from agents.vibe_agent import VibeAgent
from agents.recommender_agent import RecommenderAgent
from agents.librarian_agent import LibrarianAgent
from agents.supervisor_agent import SupervisorAgent

load_dotenv()
crear_tablas()

app = FastAPI(title="Novelia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTH ---
SECRET_KEY = os.getenv("SECRET_KEY", "novelia_secret")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


# --- MODELOS PYDANTIC ---
class UsuarioRegistro(BaseModel):
    username: str
    email: str
    password: str

class LibroData(BaseModel):
    id: str
    titulo: str
    autor: str
    genero: Optional[str] = ""
    descripcion: Optional[str] = ""
    portada_url: Optional[str] = ""
    tags: Optional[str] = ""

class AgregarBiblioteca(BaseModel):
    libro: LibroData
    estado: str

class ActualizarProgreso(BaseModel):
    libro_id: str
    progreso: int

class EscribirResena(BaseModel):
    libro_id: str
    calificacion: float
    texto: Optional[str] = ""

class VibeTexto(BaseModel):
    texto: str

class VibeCancion(BaseModel):
    nombre: str
    artista: Optional[str] = ""

class VibeVideo(BaseModel):
    url: str

class ChatMensaje(BaseModel):
    mensaje: str
    historial: Optional[List[dict]] = []

class ChatLibros(BaseModel):
    mensaje: str
    historial: list = []

class RecuperarPassword(BaseModel):
    identificador: str
    nueva_password: str


# --- HELPERS ---
def crear_token(data: dict):
    datos = data.copy()
    datos["exp"] = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(datos, SECRET_KEY, algorithm=ALGORITHM)

def obtener_usuario_actual(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=401, detail="Token requerido")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        usuario = db.query(Usuario).filter(Usuario.username == username).first()
        if not usuario:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return usuario
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")


# --- AUTH ---
@app.post("/registro")
def registro(datos: UsuarioRegistro, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.username == datos.username).first():
        raise HTTPException(status_code=400, detail="Username ya existe")
    usuario = Usuario(
        username=datos.username,
        email=datos.email,
        password_hash=pwd_context.hash(datos.password)
    )
    db.add(usuario)
    db.commit()
    return {"mensaje": "Usuario registrado exitosamente"}

@app.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(
        (Usuario.username == form.username) | (Usuario.email == form.username)
    ).first()
    if not usuario or not pwd_context.verify(form.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token = crear_token({"sub": usuario.username})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/recuperar-password")
def recuperar_password(datos: RecuperarPassword, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(
        (Usuario.username == datos.identificador) | (Usuario.email == datos.identificador)
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.password_hash = pwd_context.hash(datos.nueva_password)
    db.commit()
    return {"mensaje": "Contraseña actualizada correctamente"}


# --- VIBE ---
@app.post("/vibe/texto")
def vibe_texto(datos: VibeTexto, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = VibeAgent()
        vibe_data = agente.detectar_desde_texto(datos.texto)
        supervisor = SupervisorAgent(db)
        supervisor.guardar_sesion_vibe(usuario.id, "texto", datos.texto, vibe_data)
        recommender = RecommenderAgent(db)
        resultado = recommender.recomendar(usuario.id, vibe_data)
        explicacion = supervisor.explicar_recomendacion(usuario.id, vibe_data, resultado["libros"], resultado["inferencias"])
        return {"vibe": vibe_data, "recomendaciones": resultado, "explicacion": explicacion}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vibe/imagen")
async def vibe_imagen(imagen: UploadFile = File(...), usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        contenido = await imagen.read()
        agente = VibeAgent()
        vibe_data = agente.detectar_desde_imagen(contenido)
        supervisor = SupervisorAgent(db)
        supervisor.guardar_sesion_vibe(usuario.id, "imagen", imagen.filename, vibe_data)
        recommender = RecommenderAgent(db)
        resultado = recommender.recomendar(usuario.id, vibe_data)
        explicacion = supervisor.explicar_recomendacion(usuario.id, vibe_data, resultado["libros"], resultado["inferencias"])
        return {"vibe": vibe_data, "recomendaciones": resultado, "explicacion": explicacion}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vibe/cancion")
def vibe_cancion(datos: VibeCancion, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = VibeAgent()
        vibe_data = agente.detectar_desde_cancion(datos.nombre, datos.artista)
        supervisor = SupervisorAgent(db)
        supervisor.guardar_sesion_vibe(usuario.id, "cancion", f"{datos.nombre} - {datos.artista}", vibe_data)
        recommender = RecommenderAgent(db)
        resultado = recommender.recomendar(usuario.id, vibe_data)
        explicacion = supervisor.explicar_recomendacion(usuario.id, vibe_data, resultado["libros"], resultado["inferencias"])
        return {"vibe": vibe_data, "recomendaciones": resultado, "explicacion": explicacion}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vibe/video")
def vibe_video(datos: VibeVideo, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = VibeAgent()
        vibe_data = agente.detectar_desde_video(datos.url)
        supervisor = SupervisorAgent(db)
        supervisor.guardar_sesion_vibe(usuario.id, "video", datos.url, vibe_data)
        recommender = RecommenderAgent(db)
        resultado = recommender.recomendar(usuario.id, vibe_data)
        explicacion = supervisor.explicar_recomendacion(usuario.id, vibe_data, resultado["libros"], resultado["inferencias"])
        return {"vibe": vibe_data, "recomendaciones": resultado, "explicacion": explicacion}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- CHAT LITERARIO IA (Agente 1) ---
@app.post("/chat")
def chat_literario(datos: ChatMensaje, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = LibrarianAgent(db)
        resultado = agente.chat_literario(datos.mensaje, usuario.id, datos.historial or [])
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Chat legacy (compatibilidad)
@app.post("/chat/libros")
def chat_libros(datos: ChatLibros, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        supervisor = SupervisorAgent(db)
        return supervisor.responder_chat_libros(
            usuario.id,
            datos.mensaje,
            historial=datos.historial
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- RECOMENDACIÓN POR PERFIL (Agente 2) ---
@app.get("/recomendar/perfil")
def recomendar_perfil(usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        recommender = RecommenderAgent(db)
        return recommender.recomendar_por_perfil(usuario.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- SUPERVISOR — REPORTE IA (Agente 3) ---
@app.get("/supervisor/reporte")
def reporte_supervisor(usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        supervisor = SupervisorAgent(db)
        return supervisor.generar_reporte_usuario(usuario.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- BIBLIOTECA ---
@app.get("/biblioteca")
def obtener_biblioteca(usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = LibrarianAgent(db)
        return agente.obtener_biblioteca(usuario.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/biblioteca")
def agregar_biblioteca_v2(datos: AgregarBiblioteca, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = LibrarianAgent(db)
        return agente.agregar_a_biblioteca(usuario.id, datos.libro.dict(), datos.estado)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/biblioteca/agregar")
def agregar_biblioteca(datos: AgregarBiblioteca, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = LibrarianAgent(db)
        return agente.agregar_a_biblioteca(usuario.id, datos.libro.dict(), datos.estado)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/biblioteca/{libro_id}")
def actualizar_biblioteca(libro_id: str, datos: AgregarBiblioteca, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = LibrarianAgent(db)
        return agente.agregar_a_biblioteca(usuario.id, datos.libro.dict(), datos.estado)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/biblioteca/progreso")
def actualizar_progreso(datos: ActualizarProgreso, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = LibrarianAgent(db)
        return agente.actualizar_progreso(usuario.id, datos.libro_id, datos.progreso)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- RESEÑAS ---
@app.get("/resenas")
def obtener_resenas_usuario(usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    from models import Reseña, Libro
    reseñas = db.query(Reseña).filter(Reseña.usuario_id == usuario.id).order_by(Reseña.fecha.desc()).all()
    resultado = []
    for r in reseñas:
        libro = db.query(Libro).filter(Libro.id == r.libro_id).first()
        resultado.append({
            "id": r.id,
            "libro_id": r.libro_id,
            "titulo_libro": libro.titulo if libro else "Libro desconocido",
            "autor_libro": libro.autor if libro else "",
            "portada_url": libro.portada_url if libro else "",
            "calificacion": r.calificacion,
            "texto": r.texto,
            "sentimiento": r.sentimiento,
            "tags_auto": r.tags_auto.split(",") if r.tags_auto else [],
            "fecha": r.fecha.isoformat() if r.fecha else "",
        })
    return resultado

@app.get("/resenas/{libro_id}")
def obtener_resenas(libro_id: str, db: Session = Depends(get_db)):
    try:
        agente = LibrarianAgent(db)
        return agente.obtener_resenas_libro(libro_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/resenas")
def escribir_resena(datos: EscribirResena, usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        agente = LibrarianAgent(db)
        return agente.escribir_reseña(usuario.id, datos.libro_id, datos.calificacion, datos.texto or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- ESTADÍSTICAS ---
@app.get("/estadisticas")
def estadisticas(usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        supervisor = SupervisorAgent(db)
        return supervisor.resumen_usuario(usuario.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/perfil/resumen")
def resumen_perfil(usuario=Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    try:
        supervisor = SupervisorAgent(db)
        return supervisor.resumen_usuario(usuario.id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- LIBROS POPULARES ---
@app.get("/libros/populares")
def libros_populares(db: Session = Depends(get_db)):
    try:
        from models import Libro
        libros = db.query(Libro).filter(Libro.total_reseñas > 0).order_by(
            Libro.rating_promedio.desc()
        ).limit(10).all()
        if not libros:
            # Fallback: retorna libros populares conocidos
            return [
                {"titulo": "Fourth Wing", "autor": "Rebecca Yarros", "genero": "romantasy"},
                {"titulo": "The Seven Husbands of Evelyn Hugo", "autor": "Taylor Jenkins Reid", "genero": "literary fiction"},
                {"titulo": "Happy Place", "autor": "Emily Henry", "genero": "contemporary romance"},
            ]
        return [
            {"id": l.id, "titulo": l.titulo, "autor": l.autor, "genero": l.genero,
             "portada_url": l.portada_url, "rating_promedio": l.rating_promedio,
             "total_reseñas": l.total_reseñas}
            for l in libros
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def root():
    return {"mensaje": "Novelia API funcionando", "version": "2.0"}
