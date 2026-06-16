from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./novelia.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True)
    password_hash = Column(String)
    fecha_registro = Column(DateTime, default=datetime.utcnow)
    foto_perfil = Column(String, nullable=True)
    biblioteca = relationship("Biblioteca", back_populates="usuario")
    reseñas = relationship("Reseña", back_populates="usuario")
    actividades = relationship("ActividadLectura", back_populates="usuario")


class Libro(Base):
    __tablename__ = "libros"
    id = Column(String, primary_key=True)
    titulo = Column(String)
    autor = Column(String)
    genero = Column(String)
    descripcion = Column(Text)
    portada_url = Column(String)
    rating_promedio = Column(Float, default=0.0)
    total_reseñas = Column(Integer, default=0)
    tags = Column(String)


class Biblioteca(Base):
    __tablename__ = "biblioteca"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    libro_id = Column(String, ForeignKey("libros.id"))
    estado = Column(String)  # "leyendo", "quiero_leer", "leido"
    progreso = Column(Integer, default=0)
    fecha_agregado = Column(DateTime, default=datetime.utcnow)
    fecha_actualizado = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    usuario = relationship("Usuario", back_populates="biblioteca")


class Reseña(Base):
    __tablename__ = "reseñas"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    libro_id = Column(String, ForeignKey("libros.id"))
    calificacion = Column(Float)
    texto = Column(Text)
    sentimiento = Column(String, nullable=True)   # positivo / negativo / mixto
    tags_auto = Column(String, nullable=True)     # "tag1,tag2,tag3"
    fecha = Column(DateTime, default=datetime.utcnow)
    usuario = relationship("Usuario", back_populates="reseñas")


class SesionVibe(Base):
    __tablename__ = "sesiones_vibe"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    tipo_entrada = Column(String)
    entrada_raw = Column(Text)
    vibe_detectado = Column(String)
    tags_generados = Column(String)
    fecha = Column(DateTime, default=datetime.utcnow)


class ActividadLectura(Base):
    __tablename__ = "actividades_lectura"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    tipo = Column(String)
    detalle = Column(Text)
    puntos = Column(Integer, default=1)
    fecha = Column(DateTime, default=datetime.utcnow)
    usuario = relationship("Usuario", back_populates="actividades")


class RetosLectura(Base):
    __tablename__ = "retos_lectura"
    id = Column(Integer, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    objetivo_anual = Column(Integer, default=12)
    libros_completados = Column(Integer, default=0)
    año = Column(Integer, default=datetime.utcnow().year)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrar_columnas():
    """Agrega columnas nuevas a tablas existentes sin destruir datos."""
    from sqlalchemy import text
    migraciones = [
        "ALTER TABLE reseñas ADD COLUMN sentimiento VARCHAR",
        "ALTER TABLE reseñas ADD COLUMN tags_auto VARCHAR",
        "ALTER TABLE biblioteca ADD COLUMN fecha_actualizado DATETIME",
        "ALTER TABLE usuarios ADD COLUMN foto_perfil VARCHAR",
    ]
    with engine.connect() as conn:
        for sql in migraciones:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # columna ya existe


def crear_tablas():
    Base.metadata.create_all(bind=engine)
    _migrar_columnas()
