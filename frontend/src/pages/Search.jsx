import { useState } from 'react';
import axios from 'axios';
import {
  HiMagnifyingGlass, HiSparkles, HiHeart, HiBookOpen, HiMoon,
  HiSun, HiCloud, HiMap, HiFire, HiCheck, HiXMark,
} from 'react-icons/hi2';
import API from '../config';

const vibes = [
  { label: 'Cozy', icon: <HiSparkles size={16} />, valor: 'cozy' },
  { label: 'Nostálgica', icon: <HiCloud size={16} />, valor: 'melancolico' },
  { label: 'Misteriosa', icon: <HiMoon size={16} />, valor: 'misterioso' },
  { label: 'Romántica', icon: <HiHeart size={16} />, valor: 'romantico' },
  { label: 'Aventurera', icon: <HiMap size={16} />, valor: 'aventurero' },
  { label: 'Oscura', icon: <HiFire size={16} />, valor: 'oscuro' },
  { label: 'Esperanzadora', icon: <HiSun size={16} />, valor: 'esperanzador' },
];

const generos = [
  { label: 'Fantasía', valor: 'fantasy romantasy', icon: <HiSparkles size={14} /> },
  { label: 'Romance', valor: 'romance dark romance', icon: <HiHeart size={14} /> },
  { label: 'Ficción', valor: 'literary fiction contemporary', icon: <HiBookOpen size={14} /> },
  { label: 'Misterio', valor: 'mystery thriller', icon: <HiMoon size={14} /> },
  { label: 'Terror', valor: 'horror dark', icon: <HiFire size={14} /> },
  { label: 'Sci-Fi', valor: 'science fiction', icon: <HiMap size={14} /> },
];

const Search = () => {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState('');
  const [analisisVibe, setAnalisisVibe] = useState(null);
  const [libroSeleccionado, setLibroSeleccionado] = useState(null);
  const [vibeActivo, setVibeActivo] = useState(null);
  const [estadosGuardados, setEstadosGuardados] = useState({});

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const buscarConTexto = async (texto) => {
    setCargando(true);
    setResultados([]);
    setAnalisisVibe(null);
    try {
      const res = await axios.post(`${API}/vibe/texto`, { texto }, { headers });
      const libros = res.data?.recomendaciones?.libros || [];
      const vibeData = res.data?.vibe || {};
      setResultados(libros);
      setAnalisisVibe({
        vibe: vibeData.vibe || texto,
        tags: vibeData.tags || [],
        explicacion: res.data?.explicacion?.explicacion || '',
        inferencias: res.data?.recomendaciones?.inferencias || [],
        total: libros.length,
      });
    } catch (e) {
      console.error(e);
    }
    setCargando(false);
  };

  const buscarPorVibe = (vibe) => {
    setVibeActivo(vibe);
    buscarConTexto(vibe.valor);
  };

  const buscarPorGenero = (genero) => {
    setVibeActivo(null);
    buscarConTexto(genero.valor);
  };

  const buscarPorTexto = () => {
    if (!query.trim()) return;
    setVibeActivo(null);
    buscarConTexto(query);
  };

  const agregarBiblioteca = async (libro, estado) => {
    try {
      const res = await axios.post(`${API}/biblioteca/agregar`, { libro, estado }, { headers });
      const mensaje = res.data?.mensaje || `"${libro.titulo}" agregado`;
      setMensajeGuardado(res.data?.sugerencia ? `${mensaje}. ${res.data.sugerencia}` : mensaje);
      setEstadosGuardados(prev => ({ ...prev, [libro.id]: estado }));
      setLibroSeleccionado(null);
      setTimeout(() => setMensajeGuardado(''), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ padding: '24px 16px 100px', maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '20px', fontFamily: "'Playfair Display', serif" }}>
        Buscar
      </h2>

      {/* Buscador */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
        <input
          placeholder="Buscar por vibe, géneros, autores..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscarPorTexto()}
          style={{
            flex: 1, background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)', borderRadius: '14px',
            padding: '13px 16px', color: 'var(--text-primary)',
            fontSize: '14px', outline: 'none',
          }}
        />
        <button onClick={buscarPorTexto} style={{
          background: 'var(--accent-warm)', color: 'var(--bg-primary)',
          border: 'none', borderRadius: '14px', padding: '13px 18px',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}>
          <HiMagnifyingGlass size={18} />
        </button>
      </div>

      {!resultados.length && !cargando && (
        <>
          {/* Vibes */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontWeight: '600', fontSize: '15px', marginBottom: '14px', color: 'var(--text-primary)' }}>
              Explorar por vibe
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {vibes.map(v => (
                <button key={v.label} onClick={() => buscarPorVibe(v)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: vibeActivo?.label === v.label ? 'var(--accent-warm)' : 'var(--bg-card)',
                  color: vibeActivo?.label === v.label ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px', padding: '8px 14px',
                  fontSize: '13px', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Géneros */}
          <div>
            <p style={{ fontWeight: '600', fontSize: '15px', marginBottom: '14px', color: 'var(--text-primary)' }}>
              Explorar por género
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {generos.map(g => (
                <button key={g.label} onClick={() => buscarPorGenero(g)} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: '16px', padding: '16px 8px', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  transition: 'all 0.2s ease',
                }}>
                  <span style={{ color: 'var(--accent-warm)' }}>{g.icon}</span>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {cargando && (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <HiSparkles size={32} style={{ color: 'var(--accent-warm)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Buscando libros perfectos para ti...</p>
        </div>
      )}

      {mensajeGuardado && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--accent-deep)',
          borderRadius: '14px', padding: '12px', marginBottom: '16px',
          color: 'var(--accent-warm)', fontSize: '14px', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          animation: 'fadeIn 0.2s ease',
        }}>
          <HiCheck size={16} /> {mensajeGuardado}
        </div>
      )}

      {resultados.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ fontWeight: '600', fontSize: '15px' }}>
              {vibeActivo ? `Vibe: ${vibeActivo.label}` : 'Resultados'}
            </p>
            <button onClick={() => { setResultados([]); setVibeActivo(null); setAnalisisVibe(null); setQuery(''); }} style={{
              background: 'none', border: 'none', color: 'var(--accent-warm)',
              fontSize: '13px', cursor: 'pointer',
            }}>
              Volver
            </button>
          </div>

          {analisisVibe && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: '18px',
              padding: '16px', marginBottom: '16px',
              border: '1px solid var(--border-subtle)',
            }}>
              <p style={{ color: 'var(--accent-warm)', fontWeight: '600', fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HiSparkles size={14} /> Por qué estas recomendaciones
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '10px' }}>
                {analisisVibe.explicacion || 'El sistema detectó señales suficientes para ajustar géneros y priorizar libros afines.'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: analisisVibe.inferencias.length > 0 ? '10px' : 0 }}>
                {analisisVibe.tags.map(tag => (
                  <span key={tag} style={{
                    background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                    padding: '4px 10px', borderRadius: '999px', fontSize: '12px',
                  }}>{tag}</span>
                ))}
              </div>
              {analisisVibe.inferencias.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {analisisVibe.inferencias.map((inf, i) => (
                    <p key={i} style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                      — {inf}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {resultados.map(libro => (
            <div key={libro.id} onClick={() => setLibroSeleccionado(libro)} style={{
              background: 'var(--bg-card)', borderRadius: '18px',
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
                  style={{ width: '65px', height: '95px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: '65px', height: '95px', borderRadius: '8px',
                  background: 'var(--bg-secondary)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-deep)',
                }}>
                  <HiBookOpen size={24} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', lineHeight: '1.3' }}>{libro.titulo}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>{libro.autor}</p>
                {estadosGuardados[libro.id] && (
                  <p style={{ color: 'var(--accent-warm)', fontSize: '11px', marginBottom: '8px', fontWeight: '600' }}>
                    {estadosGuardados[libro.id].replace('_', ' ')}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={e => { e.stopPropagation(); agregarBiblioteca(libro, 'quiero_leer'); }} style={btnSmall}>
                    Quiero leer
                  </button>
                  <button onClick={e => { e.stopPropagation(); agregarBiblioteca(libro, 'leyendo'); }} style={btnSmall}>
                    Leyendo
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle — centrado, no bottom sheet */}
      {libroSeleccionado && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        }} onClick={() => setLibroSeleccionado(null)}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px', padding: '28px',
            width: '100%', maxWidth: '480px',
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

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', paddingRight: '40px' }}>
              {libroSeleccionado.portada_url ? (
                <img src={libroSeleccionado.portada_url} alt={libroSeleccionado.titulo}
                  style={{ width: '90px', height: '130px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: '90px', height: '130px', borderRadius: '12px',
                  background: 'var(--bg-secondary)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-deep)',
                }}>
                  <HiBookOpen size={32} />
                </div>
              )}
              <div>
                <p style={{ fontWeight: '700', fontSize: '16px', marginBottom: '6px', lineHeight: '1.3', fontFamily: "'Playfair Display', serif" }}>
                  {libroSeleccionado.titulo}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '10px' }}>
                  {libroSeleccionado.autor}
                </p>
                {libroSeleccionado.genero && (
                  <span style={{
                    background: 'var(--bg-secondary)', color: 'var(--accent-warm)',
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
                    border: '1px solid var(--accent-deep)',
                  }}>{libroSeleccionado.genero}</span>
                )}
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
              {libroSeleccionado.descripcion || 'Sin descripción disponible.'}
            </p>

            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Agregar a biblioteca
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => agregarBiblioteca(libroSeleccionado, 'quiero_leer')}
                style={estadoBoton(estadosGuardados[libroSeleccionado.id] === 'quiero_leer')}>
                Quiero leer
              </button>
              <button onClick={() => agregarBiblioteca(libroSeleccionado, 'leyendo')}
                style={estadoBoton(estadosGuardados[libroSeleccionado.id] === 'leyendo')}>
                Leyendo
              </button>
              <button onClick={() => agregarBiblioteca(libroSeleccionado, 'leido')}
                style={estadoBoton(estadosGuardados[libroSeleccionado.id] === 'leido')}>
                Leído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const btnSmall = {
  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-subtle)', borderRadius: '10px',
  padding: '6px 10px', fontSize: '12px', cursor: 'pointer',
};

const estadoBoton = (activo) => ({
  flex: 1,
  background: activo ? 'var(--accent-warm)' : 'var(--bg-secondary)',
  color: activo ? 'var(--bg-primary)' : 'var(--text-secondary)',
  border: activo ? 'none' : '1px solid var(--border-subtle)',
  borderRadius: '12px',
  padding: '11px',
  fontSize: '13px',
  cursor: 'pointer',
  fontWeight: activo ? '700' : '500',
  transition: 'all 0.2s ease',
});

export default Search;
