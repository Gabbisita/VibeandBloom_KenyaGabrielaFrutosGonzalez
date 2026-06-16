import { useState, useEffect } from 'react';
import axios from 'axios';
import { HiBookOpen, HiStar, HiPencil, HiCheck, HiXMark, HiArrowPath } from 'react-icons/hi2';
import API from '../config';

const StarRating = ({ value, onChange }) => {
  const [hover, setHover] = useState(null);
  const display = hover !== null ? hover : value;

  const handleClick = (starVal, half) => {
    onChange(half ? starVal - 0.5 : starVal);
  };

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = display >= n;
        const half = display >= n - 0.5 && display < n;
        return (
          <span
            key={n}
            style={{ fontSize: '30px', cursor: 'pointer', position: 'relative', display: 'inline-block', userSelect: 'none' }}
            onMouseLeave={() => setHover(null)}
          >
            {/* Left half (half star) */}
            <span
              onMouseEnter={() => setHover(n - 0.5)}
              onClick={() => handleClick(n, true)}
              style={{
                position: 'absolute', left: 0, top: 0, width: '50%', height: '100%',
                overflow: 'hidden', display: 'inline-block', zIndex: 1,
              }}
            >
              <span style={{
                display: 'inline-block', color: (half || filled) ? 'var(--star-color)' : 'var(--text-muted)',
              }}>★</span>
            </span>
            {/* Right half (full star) */}
            <span
              onMouseEnter={() => setHover(n)}
              onClick={() => handleClick(n, false)}
              style={{
                position: 'absolute', right: 0, top: 0, width: '50%', height: '100%',
                zIndex: 0,
              }}
            />
            {/* Base star */}
            <span style={{ color: filled ? 'var(--star-color)' : half ? 'var(--star-color)' : 'var(--text-muted)', opacity: half ? 0.5 : 1 }}>
              ★
            </span>
          </span>
        );
      })}
    </div>
  );
};

const EstrellasMini = ({ valor }) => {
  return (
    <span style={{ color: 'var(--star-color)', fontSize: '13px', letterSpacing: '1px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ opacity: valor >= n ? 1 : valor >= n - 0.5 ? 0.5 : 0.2 }}>★</span>
      ))}
    </span>
  );
};

const Library = () => {
  const [biblioteca, setBiblioteca] = useState({ leyendo: [], quiero_leer: [], leidos: [] });
  const [tab, setTab] = useState('leyendo');
  const [libroSeleccionado, setLibroSeleccionado] = useState(null);
  const [modalResena, setModalResena] = useState(null);
  const [resena, setResena] = useState({ calificacion: 4, texto: '' });
  const [resenasLibro, setResenasLibro] = useState([]);
  const [resenasLibroId, setResenasLibroId] = useState(null);
  const [mensajeIA, setMensajeIA] = useState('');
  const [mensajeSistema, setMensajeSistema] = useState('');
  const [cargando, setCargando] = useState(true);
  const [publicandoResena, setPublicandoResena] = useState(false);
  const [resenaCargando, setResenaCargando] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { cargarBiblioteca(); }, []);

  const agregarBiblioteca = async (libro, estado) => {
    try {
      await axios.post(`${API}/biblioteca/agregar`, { libro, estado }, { headers });
      setMensajeSistema(`"${libro.titulo}" movido a ${estado.replace('_', ' ')}`);
      setLibroSeleccionado(null);
      setTimeout(() => setMensajeSistema(''), 3000);
      cargarBiblioteca();
    } catch (e) { console.error(e); }
  };

  const cargarBiblioteca = async () => {
    try {
      const res = await axios.get(`${API}/biblioteca`, { headers });
      setBiblioteca(res.data);
    } catch (e) { console.error(e); }
    setCargando(false);
  };

  const actualizarProgreso = async (libro_id, progreso) => {
    try {
      const res = await axios.post(`${API}/biblioteca/progreso`, { libro_id, progreso }, { headers });
      setMensajeSistema(res.data?.inferencia || res.data?.mensaje || '');
      setTimeout(() => setMensajeSistema(''), 3500);
      cargarBiblioteca();
    } catch (e) { console.error(e); }
  };

  const abrirModalResena = async (libro) => {
    setModalResena(libro);
    setResena({ calificacion: 4, texto: '' });
    setMensajeIA('');
    setResenasLibro([]);
    cargarResenasLibro(libro.id);
  };

  const cargarResenasLibro = async (libroId) => {
    setResenaCargando(true);
    setResenasLibroId(libroId);
    try {
      const res = await axios.get(`${API}/resenas/${libroId}`);
      setResenasLibro(res.data || []);
    } catch (e) { console.error(e); }
    setResenaCargando(false);
  };

  const publicarResena = async () => {
    setPublicandoResena(true);
    try {
      const res = await axios.post(`${API}/resenas`, {
        libro_id: modalResena.id,
        calificacion: resena.calificacion,
        texto: resena.texto,
      }, { headers });
      setMensajeIA(res.data.respuesta_ia);
      setMensajeSistema(res.data.mensaje || 'Reseña registrada');
      setTimeout(() => {
        setModalResena(null);
        setMensajeIA('');
        setMensajeSistema('');
        setResena({ calificacion: 4, texto: '' });
        cargarBiblioteca();
      }, 3500);
    } catch (e) { console.error(e); }
    setPublicandoResena(false);
  };

  const tabs = [
    { key: 'leyendo', label: 'Leyendo' },
    { key: 'quiero_leer', label: 'Quiero leer' },
    { key: 'leidos', label: 'Leídos' },
  ];

  const librosActuales = biblioteca[tab] || [];

  return (
    <div className="page-enter" style={{ padding: '28px 20px 100px', maxWidth: '640px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: '700', marginBottom: '20px' }}>
        Mi Biblioteca
      </h1>

      {mensajeSistema && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--accent-deep)',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
          color: 'var(--accent-warm)', fontSize: '13px', lineHeight: '1.5',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'fadeIn 0.2s ease',
        }}>
          <HiCheck size={16} /> {mensajeSistema}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '22px', gap: '4px' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '11px 6px', background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--accent-warm)' : '2px solid transparent',
            color: tab === t.key ? 'var(--accent-warm)' : 'var(--text-muted)',
            fontSize: '13px', cursor: 'pointer',
            fontWeight: tab === t.key ? '600' : '400',
            transition: 'all 0.2s',
          }}>
            {t.label}
            <span style={{
              marginLeft: '6px',
              background: tab === t.key ? 'var(--accent-deep)' : 'var(--bg-card)',
              color: tab === t.key ? 'var(--accent-warm)' : 'var(--text-muted)',
              borderRadius: '10px', padding: '1px 7px', fontSize: '11px',
            }}>
              {biblioteca[t.key]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {cargando && (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <HiBookOpen size={36} style={{ color: 'var(--accent-deep)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Cargando biblioteca...</p>
        </div>
      )}

      {!cargando && librosActuales.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <HiBookOpen size={48} style={{ color: 'var(--accent-deep)', marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '6px' }}>
            {tab === 'leyendo' ? 'No estás leyendo nada aún' :
              tab === 'quiero_leer' ? 'Tu lista de deseos está vacía' :
                'Aún no has marcado libros como leídos'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Busca libros o usa el Vibe detector para agregar
          </p>
        </div>
      )}

      {librosActuales.map(libro => (
        <div key={libro.id} onClick={() => setLibroSeleccionado(libro)} style={{
          background: 'var(--bg-card)', borderRadius: '14px',
          padding: '14px', marginBottom: '12px',
          display: 'flex', gap: '14px',
          border: '1px solid var(--border-subtle)',
          cursor: 'pointer', transition: 'transform 0.2s ease, border-color 0.2s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--accent-deep)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
        >
          {libro.portada_url ? (
            <img src={libro.portada_url} alt={libro.titulo}
              style={{ width: '70px', height: '100px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: '70px', height: '100px', borderRadius: '8px',
              background: 'var(--bg-secondary)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-deep)',
            }}>
              <HiBookOpen size={28} />
            </div>
          )}

          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px', lineHeight: '1.3' }}>
              {libro.titulo}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px' }}>
              {libro.autor}
            </p>

            {tab === 'leyendo' && (
              <div onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Progreso</span>
                  <span style={{ color: 'var(--accent-warm)', fontSize: '12px', fontWeight: '700' }}>{libro.progreso}%</span>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', height: '5px', marginBottom: '8px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${libro.progreso}%`, height: '100%',
                    background: 'var(--accent-warm)', borderRadius: '6px', transition: 'width 0.3s',
                  }} />
                </div>
                <input type="range" min="0" max="100" value={libro.progreso}
                  onChange={e => actualizarProgreso(libro.id, parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-warm)', cursor: 'pointer' }} />
              </div>
            )}

            {tab === 'quiero_leer' && (
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                En tu lista de deseos
              </p>
            )}

            {tab === 'leidos' && (
              <button onClick={e => { e.stopPropagation(); abrirModalResena(libro); }} style={{
                background: 'var(--accent-deep)', color: 'var(--accent-warm)',
                border: '1px solid var(--accent-deep)', borderRadius: '10px', padding: '7px 14px',
                fontSize: '12px', cursor: 'pointer', fontWeight: '600',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <HiPencil size={12} /> Escribir reseña
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Modal detalle libro — centrado */}
      {libroSeleccionado && !modalResena && (
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

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', paddingRight: '44px' }}>
              {libroSeleccionado.portada_url ? (
                <img src={libroSeleccionado.portada_url} alt={libroSeleccionado.titulo}
                  style={{ width: '80px', height: '116px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: '80px', height: '116px', borderRadius: '10px',
                  background: 'var(--bg-secondary)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-deep)',
                }}>
                  <HiBookOpen size={28} />
                </div>
              )}
              <div>
                <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: '700', fontSize: '16px', marginBottom: '6px', lineHeight: '1.3' }}>
                  {libroSeleccionado.titulo}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
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

            {/* Estado actual */}
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estado de lectura
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[
                { valor: 'quiero_leer', label: 'Quiero leer' },
                { valor: 'leyendo', label: 'Leyendo' },
                { valor: 'leido', label: 'Leído' },
              ].map(op => {
                const esActual = (
                  (op.valor === 'leyendo' && biblioteca.leyendo.find(l => l.id === libroSeleccionado.id)) ||
                  (op.valor === 'quiero_leer' && biblioteca.quiero_leer.find(l => l.id === libroSeleccionado.id)) ||
                  (op.valor === 'leido' && biblioteca.leidos.find(l => l.id === libroSeleccionado.id))
                );
                return (
                  <button key={op.valor} onClick={() => agregarBiblioteca(libroSeleccionado, op.valor)} style={{
                    flex: 1,
                    background: esActual ? 'var(--accent-warm)' : 'var(--bg-secondary)',
                    color: esActual ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    border: esActual ? 'none' : '1px solid var(--border-subtle)',
                    borderRadius: '12px', padding: '10px 6px',
                    fontSize: '12px', cursor: 'pointer',
                    fontWeight: esActual ? '700' : '400',
                    transition: 'all 0.2s ease',
                  }}>
                    {op.label}
                  </button>
                );
              })}
            </div>

            {/* Botón reseña */}
            {biblioteca.leidos.find(l => l.id === libroSeleccionado.id) && (
              <button onClick={() => { setLibroSeleccionado(null); abrirModalResena(libroSeleccionado); }} style={{
                width: '100%', background: 'var(--accent-deep)', color: 'var(--accent-warm)',
                border: '1px solid var(--accent-deep)', borderRadius: '12px', padding: '11px',
                fontSize: '13px', cursor: 'pointer', fontWeight: '600',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                <HiPencil size={14} /> Escribir reseña
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal Reseña */}
      {modalResena && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'flex-end', zIndex: 200,
        }}>
          <div className="modal-enter" style={{
            background: 'var(--bg-modal)', borderRadius: '20px 20px 0 0',
            padding: '24px', width: '100%', maxHeight: '88vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '19px' }}>Tu reseña</h3>
              <button onClick={() => setModalResena(null)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                fontSize: '22px', cursor: 'pointer', lineHeight: 1,
              }}>
                <HiXMark size={22} />
              </button>
            </div>

            {/* Info libro */}
            <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
              {modalResena.portada_url ? (
                <img src={modalResena.portada_url} alt={modalResena.titulo}
                  style={{ width: '64px', height: '92px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: '64px', height: '92px', borderRadius: '8px',
                  background: 'var(--bg-card)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-deep)',
                }}>
                  <HiBookOpen size={24} />
                </div>
              )}
              <div>
                <p style={{ fontWeight: '600', fontSize: '15px', marginBottom: '3px' }}>{modalResena.titulo}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{modalResena.autor}</p>
              </div>
            </div>

            {/* Estrellas con medias */}
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '10px' }}>
              Tu calificación
            </p>
            <div style={{ marginBottom: '8px' }}>
              <StarRating value={resena.calificacion} onChange={v => setResena({ ...resena, calificacion: v })} />
            </div>
            <p style={{ color: 'var(--accent-warm)', fontSize: '13px', fontWeight: '600', marginBottom: '18px' }}>
              {resena.calificacion} / 5
            </p>

            <textarea
              placeholder="Comparte tu opinión... (opcional)"
              value={resena.texto}
              onChange={e => setResena({ ...resena, texto: e.target.value })}
              rows={4}
              maxLength={600}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                borderRadius: '12px', padding: '13px',
                color: 'var(--text-primary)', fontSize: '13px',
                outline: 'none', width: '100%', resize: 'none', lineHeight: '1.5',
              }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'right', margin: '5px 0 16px' }}>
              {resena.texto.length}/600
            </p>

            {mensajeIA && (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--accent-deep)',
                borderRadius: '12px', padding: '13px', marginBottom: '16px',
                color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic',
                lineHeight: '1.5', animation: 'fadeIn 0.3s ease',
              }}>
                {mensajeIA}
              </div>
            )}

            <button onClick={publicarResena} disabled={publicandoResena} style={{
              background: publicandoResena ? 'var(--accent-deep)' : 'var(--accent-warm)',
              color: 'var(--bg-primary)', border: 'none', borderRadius: '12px', padding: '15px',
              fontSize: '14px', fontWeight: '700', cursor: publicandoResena ? 'not-allowed' : 'pointer',
              width: '100%', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              {publicandoResena ? 'Publicando...' : (
                <><HiStar size={16} /> Publicar reseña</>
              )}
            </button>

            {/* Reseñas existentes del libro */}
            {resenaCargando ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                Cargando reseñas...
              </p>
            ) : resenasLibro.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: 'var(--text-secondary)' }}>
                  Otras reseñas
                </p>
                {resenasLibro.map(r => (
                  <div key={r.id} style={{
                    background: 'var(--bg-secondary)', borderRadius: '12px',
                    padding: '13px', marginBottom: '10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600' }}>{r.username}</p>
                      <EstrellasMini valor={r.calificacion} />
                    </div>
                    {r.texto && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '8px' }}>
                        {r.texto}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {new Date(r.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      {r.sentimiento && (
                        <span style={{
                          background: 'var(--bg-card)', color: 'var(--text-muted)',
                          padding: '2px 8px', borderRadius: '10px', fontSize: '10px',
                        }}>{r.sentimiento}</span>
                      )}
                      {r.tags_auto?.filter(Boolean).map(tag => (
                        <span key={tag} style={{
                          background: 'var(--bg-card)', color: 'var(--accent-mid)',
                          padding: '2px 8px', borderRadius: '10px', fontSize: '10px',
                          border: '1px solid var(--accent-deep)',
                        }}>{tag.trim()}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
