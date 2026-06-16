import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  HiMusicalNote, HiVideoCamera, HiPhoto, HiSparkles,
  HiPaperAirplane, HiBookOpen, HiCheck, HiXMark,
} from 'react-icons/hi2';
import API from '../config';

const Home = () => {
  // Vibe
  const [vibeTexto, setVibeTexto] = useState('');
  const [cancion, setCancion] = useState({ nombre: '', artista: '' });
  const [videoUrl, setVideoUrl] = useState('');
  const [imagen, setImagen] = useState(null);
  const [modo, setModo] = useState('texto');
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);

  // Biblioteca
  const [mensajeGuardado, setMensajeGuardado] = useState('');
  const [libroSeleccionado, setLibroSeleccionado] = useState(null);
  const [estadosGuardados, setEstadosGuardados] = useState({});

  // Chat
  const [chatMensajes, setChatMensajes] = useState([
    { role: 'assistant', text: 'Hola, soy Novelia. Puedo recomendarte libros, hablar de tendencias BookTok, dark romance, romantasy o cualquier tema literario. ¿Por dónde empezamos?' }
  ]);
  const [chatTexto, setChatTexto] = useState('');
  const [chatCargando, setChatCargando] = useState(false);
  const [chatRecomendaciones, setChatRecomendaciones] = useState([]);
  const chatBottomRef = useRef(null);

  // Recomendaciones por perfil
  const [recosPerfil, setRecosPerfil] = useState(null);
  const [recosPerfilCargando, setRecosPerfilCargando] = useState(false);

  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const headers = { Authorization: `Bearer ${token}` };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargarRecosPerfil(); }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMensajes, chatCargando]);

  const cargarRecosPerfil = async () => {
    setRecosPerfilCargando(true);
    try {
      const res = await axios.get(`${API}/recomendar/perfil`, { headers });
      setRecosPerfil(res.data);
    } catch (e) {
      console.error(e);
    }
    setRecosPerfilCargando(false);
  };

  const detectarVibe = async () => {
    setCargando(true);
    setResultado(null);
    try {
      let res;
      if (modo === 'texto') {
        res = await axios.post(`${API}/vibe/texto`, { texto: vibeTexto }, { headers });
      } else if (modo === 'cancion') {
        res = await axios.post(`${API}/vibe/cancion`, cancion, { headers });
      } else if (modo === 'video') {
        res = await axios.post(`${API}/vibe/video`, { url: videoUrl }, { headers });
      } else if (modo === 'imagen') {
        const formData = new FormData();
        formData.append('imagen', imagen);
        res = await axios.post(`${API}/vibe/imagen`, formData, { headers });
      }
      setResultado(res.data);
    } catch (e) {
      console.error(e);
    }
    setCargando(false);
  };

  const agregarBiblioteca = async (libro, estado) => {
    try {
      await axios.post(`${API}/biblioteca/agregar`, { libro, estado }, { headers });
      setMensajeGuardado(`"${libro.titulo}" agregado como ${estado.replace('_', ' ')}`);
      setEstadosGuardados(prev => ({ ...prev, [libro.id]: estado }));
      setLibroSeleccionado(null);
      setTimeout(() => setMensajeGuardado(''), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const cargarEstadosBiblioteca = async () => {};

  const enviarChat = async () => {
    if (!chatTexto.trim() || chatCargando) return;
    const mensajeUsuario = chatTexto.trim();

    const nuevosMensajes = [...chatMensajes, { role: 'user', text: mensajeUsuario }];
    setChatMensajes(nuevosMensajes);
    setChatTexto('');
    setChatCargando(true);
    setChatRecomendaciones([]);

    try {
      const historialParaBackend = nuevosMensajes.slice(0, -1).map(m => ({
        role: m.role,
        content: m.text
      }));

      const res = await axios.post(
        `${API}/chat/libros`,
        {
          mensaje: mensajeUsuario,
          historial: historialParaBackend
        },
        { headers }
      );

      const respuesta = res.data?.respuesta || 'No obtuve respuesta, intenta de nuevo.';
      setChatMensajes(prev => [...prev, { role: 'assistant', text: respuesta }]);
      if (res.data?.recomendaciones?.length > 0) {
        setChatRecomendaciones(res.data.recomendaciones);
      }
      if (res.data?.accion_biblioteca) {
        await cargarEstadosBiblioteca();
      }
    } catch (e) {
      console.error('Error en chat:', e);
      setChatMensajes(prev => [
        ...prev,
        { role: 'assistant', text: 'No pude conectarme. Verifica que el servidor esté corriendo en localhost:8000.' }
      ]);
    }
    setChatCargando(false);
  };

  const modos = [
    { key: 'texto', icon: <HiSparkles size={18} />, label: 'Vibe' },
    { key: 'cancion', icon: <HiMusicalNote size={18} />, label: 'Canción' },
    { key: 'video', icon: <HiVideoCamera size={18} />, label: 'Video' },
    { key: 'imagen', icon: <HiPhoto size={18} />, label: 'Imagen' },
  ];

  return (
    <div className="page-enter" style={{ padding: '28px 20px 100px', maxWidth: '640px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', fontFamily: "'Playfair Display', serif", color: 'var(--text-primary)' }}>
          Hola, {username}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Descubre tu próxima lectura
        </p>
      </div>

      {/* Mensaje de confirmación */}
      {mensajeGuardado && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--accent-deep)',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
          color: 'var(--accent-warm)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'fadeIn 0.2s ease',
        }}>
          <HiCheck size={16} /> {mensajeGuardado}
        </div>
      )}

      {/* CHAT LITERARIO */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: '16px',
        padding: '20px', marginBottom: '20px',
        border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>
          Asistente literario
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
          Pregúntame sobre libros, autores, tropes, sagas o tendencias BookTok
        </p>

        {/* Burbujas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px', maxHeight: '320px', overflowY: 'auto' }}>
          {chatMensajes.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              background: msg.role === 'user' ? 'var(--accent-deep)' : 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              padding: '10px 14px',
              fontSize: '13px',
              lineHeight: '1.55',
              animation: 'fadeIn 0.2s ease',
            }}>
              {msg.text}
            </div>
          ))}

          {chatCargando && (
            <div style={{
              alignSelf: 'flex-start', background: 'var(--bg-secondary)',
              borderRadius: '20px 20px 20px 4px', padding: '10px 16px',
              color: 'var(--text-muted)', fontSize: '13px', display: 'flex', gap: '4px', alignItems: 'center',
            }}>
              <span style={{ display: 'inline-block', animation: 'pulse 0.6s infinite alternate' }}>.</span>
              <span style={{ display: 'inline-block', animation: 'pulse 0.6s 0.2s infinite alternate' }}>.</span>
              <span style={{ display: 'inline-block', animation: 'pulse 0.6s 0.4s infinite alternate' }}>.</span>
              <style>{`@keyframes pulse { from { opacity: 0.3; } to { opacity: 1; } }`}</style>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Chips de libros mencionados */}
        {chatRecomendaciones.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {chatRecomendaciones.map(libro => (
              <button key={libro.id} onClick={() => setLibroSeleccionado(libro)} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--accent-deep)',
                borderRadius: '20px', padding: '5px 12px',
                color: 'var(--accent-warm)', fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <HiBookOpen size={12} />
                {libro.titulo}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            value={chatTexto}
            onChange={e => setChatTexto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enviarChat()}
            placeholder="Ej: recomiéndame algo tipo dark romance con enemies to lovers..."
            style={{
              flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
              borderRadius: '20px', padding: '11px 16px', color: 'var(--text-primary)',
              fontSize: '13px', outline: 'none',
            }}
          />
          <button onClick={enviarChat} disabled={chatCargando || !chatTexto.trim()} style={{
            background: chatCargando ? 'var(--accent-deep)' : 'var(--accent-warm)',
            color: 'var(--bg-primary)',
            border: 'none', borderRadius: '20px', padding: '11px 16px',
            cursor: chatCargando ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
          }}>
            <HiPaperAirplane size={16} />
          </button>
        </div>
      </div>

      {/* RECOMENDACIONES POR PERFIL */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: '600' }}>
            Recomendado para ti
          </h2>
          <button onClick={cargarRecosPerfil} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '12px', cursor: 'pointer',
          }}>
            Actualizar
          </button>
        </div>

        {recosPerfilCargando && (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{
                minWidth: '140px', background: 'var(--bg-card)', borderRadius: '12px',
                height: '200px', flexShrink: 0, border: '1px solid var(--border-subtle)',
                opacity: 0.5,
              }} />
            ))}
          </div>
        )}

        {recosPerfil && !recosPerfilCargando && (
          <>
            {recosPerfil.inferencias_aplicadas?.length > 0 && (
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: '12px',
                padding: '12px 16px', marginBottom: '14px',
                border: '1px solid var(--border-subtle)',
              }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                  Reglas aplicadas
                </p>
                {recosPerfil.inferencias_aplicadas.map((inf, i) => (
                  <p key={i} style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.5', marginBottom: '3px' }}>
                    — {inf}
                  </p>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
              {recosPerfil.libros?.map(libro => (
                <div key={libro.id} onClick={() => setLibroSeleccionado(libro)}
                  style={{
                    minWidth: '150px', maxWidth: '150px', cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <img
                      src={libro.portada_url || `https://covers.openlibrary.org/b/title/${encodeURIComponent(libro.titulo)}-M.jpg`}
                      alt={libro.titulo}
                      onError={e => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                      style={{ width: '150px', height: '210px', borderRadius: '10px', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      width: '150px', height: '210px', borderRadius: '10px',
                      background: 'var(--bg-card)', display: 'none',
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: '8px',
                      color: 'var(--accent-warm)', border: '1px solid var(--border-subtle)',
                    }}>
                      <HiBookOpen size={32} />
                      <span style={{ fontSize: '11px', textAlign: 'center', padding: '0 8px', color: 'var(--text-muted)' }}>
                        {libro.titulo}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: '600', lineHeight: '1.3', marginBottom: '3px' }}>
                    {libro.titulo}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '6px' }}>
                    {libro.autor}
                  </p>
                  {libro.vibe_tags?.slice(0, 2).map(tag => (
                    <span key={tag} style={{
                      display: 'inline-block',
                      background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                      padding: '2px 8px', borderRadius: '10px', fontSize: '10px', marginRight: '4px',
                    }}>{tag}</span>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* VIBE DETECTOR */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: '16px',
        padding: '20px', marginBottom: '20px',
        border: '1px solid var(--border-subtle)',
      }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>
          Detectar vibe
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {modos.map(m => (
            <button key={m.key} onClick={() => setModo(m.key)} style={{
              flex: 1, padding: '10px 6px', borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              background: modo === m.key ? 'var(--accent-deep)' : 'var(--bg-secondary)',
              color: modo === m.key ? 'var(--accent-warm)' : 'var(--text-muted)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '600',
              transition: 'all 0.2s',
            }}>
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {modo === 'texto' && (
          <textarea
            placeholder="Describe el ambiente que buscas... Ej: algo melancólico pero esperanzador"
            value={vibeTexto}
            onChange={e => setVibeTexto(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'none', width: '100%' }}
          />
        )}
        {modo === 'cancion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input placeholder="Nombre de la canción" value={cancion.nombre}
              onChange={e => setCancion({ ...cancion, nombre: e.target.value })} style={inputStyle} />
            <input placeholder="Artista (opcional)" value={cancion.artista}
              onChange={e => setCancion({ ...cancion, artista: e.target.value })} style={inputStyle} />
          </div>
        )}
        {modo === 'video' && (
          <input placeholder="URL de YouTube" value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)} style={inputStyle} />
        )}
        {modo === 'imagen' && (
          <div>
            <input type="file" accept="image/*"
              onChange={e => setImagen(e.target.files[0])}
              style={{ color: 'var(--text-primary)', marginBottom: '8px', width: '100%', fontSize: '13px' }} />
            {imagen && (
              <img src={URL.createObjectURL(imagen)} alt="preview"
                style={{ width: '100%', borderRadius: '12px', maxHeight: '160px', objectFit: 'cover' }} />
            )}
          </div>
        )}

        <button onClick={detectarVibe} disabled={cargando} style={{
          background: cargando ? 'var(--accent-deep)' : 'var(--accent-warm)',
          color: 'var(--bg-primary)', border: 'none', borderRadius: '12px', padding: '13px',
          fontSize: '14px', fontWeight: '600', cursor: cargando ? 'not-allowed' : 'pointer',
          width: '100%', marginTop: '14px', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <HiSparkles size={16} />
          {cargando ? 'Analizando vibe...' : 'Obtener recomendaciones'}
        </button>
      </div>

      {/* RESULTADOS VIBE */}
      {resultado && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            padding: '20px', marginBottom: '16px', border: '1px solid var(--border-subtle)',
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
              Vibe detectado
            </p>
            <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-warm)', textTransform: 'capitalize', fontFamily: "'Playfair Display', serif", marginBottom: '10px' }}>
              {resultado.vibe?.vibe}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {resultado.vibe?.tags?.map(tag => (
                <span key={tag} style={{
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '11px',
                }}>{tag}</span>
              ))}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic', lineHeight: '1.5' }}>
              {resultado.explicacion?.explicacion}
            </p>
          </div>

          {resultado.recomendaciones?.inferencias?.length > 0 && (
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: '12px',
              padding: '14px 16px', marginBottom: '16px', border: '1px solid var(--border-subtle)',
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                Razonamiento del sistema
              </p>
              {resultado.recomendaciones.inferencias.map((inf, i) => (
                <p key={i} style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '5px', lineHeight: '1.5' }}>
                  — {inf}
                </p>
              ))}
            </div>
          )}

          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', fontWeight: '600', marginBottom: '14px' }}>
            Recomendaciones
          </h3>

          {resultado.recomendaciones?.libros?.map(libro => (
            <div key={libro.id} onClick={() => setLibroSeleccionado(libro)} style={{
              background: 'var(--bg-card)', borderRadius: '14px',
              padding: '14px', marginBottom: '12px',
              display: 'flex', gap: '14px', cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--accent-deep)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              {libro.portada_url ? (
                <img src={libro.portada_url} alt={libro.titulo}
                  style={{ width: '72px', height: '104px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: '72px', height: '104px', borderRadius: '8px',
                  background: 'var(--bg-secondary)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-deep)',
                }}>
                  <HiBookOpen size={28} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '3px', lineHeight: '1.3' }}>{libro.titulo}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>{libro.autor}</p>
                {estadosGuardados[libro.id] && (
                  <p style={{ color: 'var(--accent-warm)', fontSize: '11px', marginBottom: '6px' }}>
                    {estadosGuardados[libro.id].replace('_', ' ')}
                  </p>
                )}
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px', lineHeight: '1.5' }}>
                  {libro.descripcion?.slice(0, 90)}{libro.descripcion?.length > 90 ? '...' : ''}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={e => { e.stopPropagation(); agregarBiblioteca(libro, 'quiero_leer'); }}
                    style={btnEstado(estadosGuardados[libro.id] === 'quiero_leer')}>
                    Quiero leer
                  </button>
                  <button onClick={e => { e.stopPropagation(); agregarBiblioteca(libro, 'leyendo'); }}
                    style={btnEstado(estadosGuardados[libro.id] === 'leyendo')}>
                    Leyendo
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DETALLE LIBRO — centrado */}
      {libroSeleccionado && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        }} onClick={() => setLibroSeleccionado(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '20px',
            padding: '28px', width: '100%', maxWidth: '480px',
            maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            animation: 'fadeInScale 0.25s ease',
            position: 'relative',
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLibroSeleccionado(null)} style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'var(--bg-secondary)', border: 'none',
              borderRadius: '50%', width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}>
              <HiXMark size={16} />
            </button>
            <div style={{ paddingRight: '44px', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px' }}>Detalles del libro</h3>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              {libroSeleccionado.portada_url ? (
                <img src={libroSeleccionado.portada_url} alt={libroSeleccionado.titulo}
                  style={{ width: '90px', height: '128px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: '90px', height: '128px', borderRadius: '10px',
                  background: 'var(--bg-card)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-deep)',
                }}>
                  <HiBookOpen size={36} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: '700', fontSize: '17px', marginBottom: '4px' }}>
                  {libroSeleccionado.titulo}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '10px' }}>
                  {libroSeleccionado.autor}
                </p>
                {libroSeleccionado.genero && (
                  <span style={{
                    background: 'var(--bg-card)', color: 'var(--accent-warm)',
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
                    border: '1px solid var(--accent-deep)',
                  }}>{libroSeleccionado.genero}</span>
                )}
                {/* Tags vibe */}
                {libroSeleccionado.vibe_tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {libroSeleccionado.vibe_tags.map(tag => (
                      <span key={tag} style={{
                        background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                        padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
                      }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {libroSeleccionado.por_que && (
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: '10px',
                padding: '12px 14px', marginBottom: '14px',
                borderLeft: '3px solid var(--accent-deep)',
              }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic', lineHeight: '1.5' }}>
                  {libroSeleccionado.por_que}
                </p>
              </div>
            )}

            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
              {libroSeleccionado.descripcion || 'Sin descripción disponible.'}
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => agregarBiblioteca(libroSeleccionado, 'quiero_leer')}
                style={btnEstado(estadosGuardados[libroSeleccionado.id] === 'quiero_leer')}>
                Quiero leer
              </button>
              <button onClick={() => agregarBiblioteca(libroSeleccionado, 'leyendo')}
                style={btnEstado(estadosGuardados[libroSeleccionado.id] === 'leyendo')}>
                Leyendo
              </button>
              <button onClick={() => agregarBiblioteca(libroSeleccionado, 'leido')}
                style={btnEstado(estadosGuardados[libroSeleccionado.id] === 'leido')}>
                Leído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const inputStyle = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
  borderRadius: '12px', padding: '12px 14px',
  color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '100%',
};

const btnEstado = (activo) => ({
  flex: 1,
  background: activo ? 'var(--accent-warm)' : 'var(--bg-secondary)',
  color: activo ? 'var(--bg-primary)' : 'var(--text-secondary)',
  border: activo ? 'none' : '1px solid var(--border-subtle)',
  borderRadius: '12px', padding: '11px',
  fontSize: '12px', cursor: 'pointer', fontWeight: activo ? '700' : '500',
  transition: 'all 0.2s',
});

export default Home;
