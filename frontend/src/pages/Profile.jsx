import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  HiBookOpen, HiStar, HiFire,
  HiArrowPath, HiChevronDown, HiChevronUp, HiSparkles,
} from 'react-icons/hi2';
import API from '../config';

const GraficaGeneros = ({ datos }) => {
  if (!datos || datos.length === 0) return null;
  const max = Math.max(...datos.map(d => d.cantidad));
  const colores = ['#C9A882', '#A07856', '#7B5C3E', '#5C4033', '#3D2820'];
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '18px', marginBottom: '18px', border: '1px solid var(--border-subtle)' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
        Géneros favoritos
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {datos.map((d, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{d.genero}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.cantidad} {d.cantidad === 1 ? 'libro' : 'libros'}</span>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '4px', height: '6px' }}>
              <div style={{
                background: colores[i % colores.length],
                width: `${(d.cantidad / max) * 100}%`,
                height: '100%', borderRadius: '4px',
                transition: 'width 0.6s ease', minWidth: '4px',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Profile = () => {
  const [resumen, setResumen] = useState(null);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [reporteCargando, setReporteCargando] = useState(false);
  const [inferenciasAbiertas, setInferenciasAbiertas] = useState(false);
  const [retos, setRetos] = useState([]);
  const [editando, setEditando] = useState(null);
  const [nuevoReto, setNuevoReto] = useState({ titulo: '', descripcion: '', progreso: 0 });
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    cargarDatos();
    const stored = localStorage.getItem(`retos_${username}`);
    if (stored) {
      try { setRetos(JSON.parse(stored)); } catch { setRetos([]); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resRes] = await Promise.all([
        axios.get(`${API}/perfil/resumen`, { headers }),
      ]);
      setResumen(resRes.data);
    } catch (e) {
      console.error(e);
    }
    setCargando(false);
    cargarReporte();
  };

  const cargarReporte = async () => {
    setReporteCargando(true);
    try {
      const res = await axios.get(`${API}/supervisor/reporte`, { headers });
      setReporte(res.data);
    } catch (e) {
      console.error(e);
    }
    setReporteCargando(false);
  };

  const guardarReto = () => {
    if (!nuevoReto.titulo.trim()) return;
    let nuevosRetos;
    if (editando !== null) {
      nuevosRetos = retos.map((r, i) => i === editando ? { ...nuevoReto } : r);
      setEditando(null);
    } else {
      nuevosRetos = [...retos, { ...nuevoReto }];
    }
    setRetos(nuevosRetos);
    localStorage.setItem(`retos_${username}`, JSON.stringify(nuevosRetos));
    setNuevoReto({ titulo: '', descripcion: '', progreso: 0 });
  };

  const borrarReto = (idx) => {
    const nuevos = retos.filter((_, i) => i !== idx);
    setRetos(nuevos);
    localStorage.setItem(`retos_${username}`, JSON.stringify(nuevos));
    if (editando === idx) {
      setEditando(null);
      setNuevoReto({ titulo: '', descripcion: '', progreso: 0 });
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin datos';
    return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const retosCompletados = resumen?.retos?.filter(r => r.progreso >= 100).length || 0;
  const totalProgresoRetos = resumen?.retos?.length
    ? Math.round(resumen.retos.reduce((acc, r) => acc + r.progreso, 0) / resumen.retos.length)
    : 0;

  return (
    <div className="page-enter" style={{ padding: '28px 20px 100px', maxWidth: '640px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-deep), var(--accent-mid))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: '700', color: 'var(--accent-warm)' }}>
              {username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: '700' }}>{username}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>@{username?.toLowerCase()}</p>
          </div>
        </div>
      </div>

      {cargando && (
        <div style={{ textAlign: 'center', marginTop: '80px' }}>
          <HiBookOpen size={36} style={{ color: 'var(--accent-deep)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Cargando tu perfil...</p>
        </div>
      )}

      {!cargando && resumen && (
        <>
          {/* REPORTE IA — Supervisor */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            padding: '20px', marginBottom: '18px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                  Tu perfil lector
                </p>
                {reporteCargando ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Analizando tu perfil...</p>
                ) : reporte?.tipo_lectora ? (
                  <p style={{
                    fontFamily: "'Playfair Display', serif", fontSize: '20px',
                    fontWeight: '700', color: 'var(--accent-warm)', lineHeight: '1.25',
                  }}>
                    {reporte.tipo_lectora}
                  </p>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Agrega libros para ver tu análisis
                  </p>
                )}
              </div>
              <button onClick={cargarReporte} disabled={reporteCargando} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
              }}>
                <HiArrowPath size={16} style={{ animation: reporteCargando ? 'spin 1s linear infinite' : 'none' }} />
                <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
              </button>
            </div>

            {reporte?.insight && (
              <p style={{
                color: 'var(--text-secondary)', fontSize: '13px',
                fontStyle: 'italic', lineHeight: '1.6', marginBottom: '16px',
                borderLeft: '2px solid var(--accent-deep)', paddingLeft: '12px',
              }}>
                {reporte.insight}
              </p>
            )}

            {reporte?.prediccion && (
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: '10px',
                padding: '12px 14px', marginBottom: '16px',
              }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Prediccion del mes
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
                  {reporte.prediccion}
                </p>
              </div>
            )}

            {/* Géneros del alma */}
            {reporte?.generos_alma?.length > 0 && (
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                  Géneros del alma
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reporte.generos_alma.map((g, i) => (
                    <div key={i} style={{
                      background: 'var(--bg-secondary)', borderRadius: '10px',
                      padding: '10px 14px',
                    }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '3px', color: 'var(--accent-warm)' }}>
                        {g.genero}
                      </p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4' }}>
                        {g.explicacion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explicabilidad — inferencias */}
            {reporte?.inferencias?.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <button onClick={() => setInferenciasAbiertas(!inferenciasAbiertas)} style={{
                  background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '8px',
                  padding: '8px 12px', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                }}>
                  <HiSparkles size={14} />
                  Cómo funciona la IA
                  {inferenciasAbiertas ? <HiChevronUp size={14} style={{ marginLeft: 'auto' }} /> : <HiChevronDown size={14} style={{ marginLeft: 'auto' }} />}
                </button>
                {inferenciasAbiertas && (
                  <div style={{
                    marginTop: '10px', background: 'var(--bg-secondary)', borderRadius: '10px',
                    padding: '14px', animation: 'fadeIn 0.2s ease',
                  }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '10px' }}>
                      Estas son las reglas de inferencia que el sistema aplicó para analizar tu perfil:
                    </p>
                    {reporte.inferencias.map((inf, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <span style={{
                          width: '18px', height: '18px', borderRadius: '50%',
                          background: 'var(--accent-deep)', color: 'var(--accent-warm)',
                          fontSize: '10px', fontWeight: 'bold', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</span>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.5' }}>{inf}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ESTADÍSTICAS RÁPIDAS */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            padding: '18px', marginBottom: '18px',
            border: '1px solid var(--border-subtle)',
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
              Estadísticas
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {[
                { label: 'Racha', valor: `${resumen.estadisticas.racha_lectura}d`, Icon: HiFire },
                { label: 'Leídos', valor: resumen.estadisticas.libros_leidos, Icon: HiBookOpen },
                { label: 'Reseñas', valor: resumen.estadisticas.total_reseñas, Icon: HiStar },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'var(--bg-secondary)', borderRadius: '12px',
                  padding: '14px', textAlign: 'center',
                }}>
                  <item.Icon size={18} style={{ color: 'var(--accent-warm)', marginBottom: '6px' }} />
                  <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--accent-warm)', marginBottom: '2px' }}>
                    {item.valor}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.label}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Leyendo ahora', valor: resumen.estadisticas.leyendo_ahora },
                { label: 'Quiero leer', valor: resumen.estadisticas.quiero_leer },
                { label: 'Calificación prom.', valor: resumen.estadisticas.rating_promedio ? `${resumen.estadisticas.rating_promedio}/5` : '—' },
                { label: 'Nivel lector', valor: resumen.nivel_lector },
                { label: 'Días activos (30d)', valor: resumen.estadisticas.dias_activos_30 },
                { label: 'Actividad total', valor: resumen.estadisticas.actividad_total },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'var(--bg-secondary)', borderRadius: '12px',
                  padding: '14px',
                }}>
                  <p style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-warm)', marginBottom: '3px' }}>
                    {stat.valor}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* GRÁFICA DE GÉNEROS */}
          {resumen.generos_favoritos?.length > 0 && (
            <GraficaGeneros datos={resumen.generos_favoritos} />
          )}

          {/* RETOS */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            padding: '18px', marginBottom: '18px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: '600' }}>
                Retos de lectura
              </p>
              <span style={{
                background: 'var(--bg-secondary)', color: 'var(--accent-warm)',
                padding: '3px 10px', borderRadius: '10px', fontSize: '11px',
              }}>
                {retosCompletados}/{resumen.retos.length} completados
              </span>
            </div>
            {resumen.retos.map((reto, i) => (
              <div key={reto.titulo} style={{ marginBottom: i < resumen.retos.length - 1 ? '16px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600' }}>{reto.titulo}</p>
                  <p style={{ color: 'var(--accent-warm)', fontSize: '12px', fontWeight: '700' }}>{reto.progreso}%</p>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '7px', lineHeight: '1.4' }}>
                  {reto.descripcion}
                </p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${reto.progreso}%`, height: '100%',
                    background: reto.progreso >= 100 ? 'var(--accent-warm)' : 'var(--accent-mid)',
                    borderRadius: '999px', transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* GESTIONAR RETOS PERSONALIZADOS */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            padding: '18px', marginBottom: '18px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <p style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                  Mis retos personalizados
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Crea y sigue tus propios desafíos de lectura
                </p>
              </div>
              <button
                onClick={() => {
                  setEditando(null);
                  setNuevoReto({ titulo: '', descripcion: '', progreso: 0 });
                }}
                style={{
                  background: 'var(--accent-warm)',
                  color: 'var(--bg-primary)',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                + Nuevo
              </button>
            </div>

            {retos.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '20px 0',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                marginBottom: '14px'
              }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Sin retos personalizados aún
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Usa el formulario de abajo para crear tu primer reto
                </p>
              </div>
            ) : (
              retos.map((reto, idx) => (
                <div key={idx} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600' }}>{reto.titulo}</p>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                      <button onClick={() => { setEditando(idx); setNuevoReto({ ...reto }); }} style={{
                        background: 'none', border: '1px solid var(--border-subtle)',
                        borderRadius: '8px', padding: '3px 8px',
                        fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer'
                      }}>
                        Editar
                      </button>
                      <button onClick={() => borrarReto(idx)} style={{
                        background: 'none', border: '1px solid #8B4040',
                        borderRadius: '8px', padding: '3px 8px',
                        fontSize: '11px', color: '#A05050', cursor: 'pointer'
                      }}>
                        Borrar
                      </button>
                    </div>
                  </div>
                  {reto.descripcion && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '7px', lineHeight: '1.4' }}>
                      {reto.descripcion}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Progreso</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-warm)' }}>{reto.progreso}%</span>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${reto.progreso}%`, height: '100%',
                      background: reto.progreso >= 100 ? 'var(--accent-warm)' : 'var(--accent-mid)',
                      borderRadius: '999px', transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              ))
            )}

            {/* Formulario siempre visible */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginTop: '4px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '10px' }}>
                {editando !== null ? 'Editando reto' : 'Agregar nuevo reto'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Título del reto"
                  value={nuevoReto.titulo}
                  onChange={e => setNuevoReto({ ...nuevoReto, titulo: e.target.value })}
                  style={profileInputStyle}
                />
                <input
                  type="text"
                  placeholder="Descripción (opcional)"
                  value={nuevoReto.descripcion}
                  onChange={e => setNuevoReto({ ...nuevoReto, descripcion: e.target.value })}
                  style={profileInputStyle}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Progreso inicial</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-warm)' }}>
                      {nuevoReto.progreso}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={nuevoReto.progreso}
                    onChange={e => setNuevoReto({ ...nuevoReto, progreso: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-warm)', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={guardarReto} style={{ ...profileBtnStyle, flex: 1 }}>
                    {editando !== null ? 'Guardar cambios' : 'Agregar reto'}
                  </button>
                  {editando !== null && (
                    <button
                      onClick={() => {
                        setEditando(null);
                        setNuevoReto({ titulo: '', descripcion: '', progreso: 0 });
                      }}
                      style={{
                        ...profileBtnStyle,
                        flex: 1,
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVIDAD RECIENTE */}
          {resumen.actividad_reciente?.length > 0 && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: '16px',
              padding: '18px', marginBottom: '18px',
              border: '1px solid var(--border-subtle)',
            }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>
                Actividad reciente
              </p>
              {resumen.actividad_reciente.map((act, i) => (
                <div key={`${act.fecha}-${i}`} style={{
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                  marginBottom: i < resumen.actividad_reciente.length - 1 ? '12px' : 0,
                }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: 'var(--accent-mid)', flexShrink: 0, marginTop: '5px',
                  }} />
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px', textTransform: 'capitalize' }}>
                      {act.tipo}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4' }}>
                      {act.detalle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ANÁLISIS PERFIL (inferencias del sistema base) */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px',
            padding: '18px', marginBottom: '24px',
            border: '1px solid var(--border-subtle)',
          }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>
              Análisis del sistema
            </p>
            {resumen.inferencias_perfil.map((inf, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--accent-mid)', flexShrink: 0, marginTop: '7px',
                }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>{inf}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <button onClick={cerrarSesion} style={{
        width: '100%', background: 'none',
        border: '1px solid #8B4040', borderRadius: '12px',
        padding: '13px', color: '#A05050',
        fontSize: '14px', cursor: 'pointer', fontWeight: '600',
        transition: 'all 0.2s',
      }}>
        Cerrar sesión
      </button>
    </div>
  );
};

const profileInputStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '12px',
  padding: '12px 14px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const profileBtnStyle = {
  background: 'var(--accent-warm)',
  color: 'var(--bg-primary)',
  border: 'none',
  borderRadius: '12px',
  padding: '11px 16px',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
};

export default Profile;
