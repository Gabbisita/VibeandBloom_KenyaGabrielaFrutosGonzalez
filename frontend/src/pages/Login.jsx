import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API from '../config';

const Login = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [recuperar, setRecuperar] = useState({ identificador: '', nuevaPassword: '' });
  const [modoRecuperacion, setModoRecuperacion] = useState(false);
  const [error, setError] = useState('');
  const [mensajeRecuperacion, setMensajeRecuperacion] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleChange = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (!form.username.trim() || !form.password) {
      setError('Completa usuario y contraseña');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const body = new URLSearchParams();
      body.append('username', form.username.trim());
      body.append('password', form.password);
      const res = await axios.post(`${API}/login`, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('username', form.username.trim());
      // Forzamos reload completo para que App.js lea el token nuevo desde localStorage
      window.location.href = '/';
    } catch (err) {
      const detalle = err?.response?.data?.detail;
      setError(detalle || 'Usuario o contraseña incorrectos');
    }
    setCargando(false);
  };

  const handleRecuperar = async () => {
    if (!recuperar.identificador.trim() || !recuperar.nuevaPassword) {
      setError('Completa todos los campos');
      return;
    }
    setCargando(true);
    setError('');
    setMensajeRecuperacion('');
    try {
      const res = await axios.post(`${API}/recuperar-password`, {
        identificador: recuperar.identificador.trim(),
        nueva_password: recuperar.nuevaPassword,
      });
      setMensajeRecuperacion(res.data?.mensaje || 'Contraseña actualizada');
    } catch (err) {
      const detalle = err?.response?.data?.detail;
      setError(detalle || 'No se encontró ese usuario o correo');
    }
    setCargando(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      background: 'var(--bg-primary)',
    }}>
      <h1 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: '44px', color: 'var(--accent-warm)', marginBottom: '6px',
        fontStyle: 'italic', letterSpacing: '-1px',
      }}>
        Novelia
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '14px' }}>
        Tu biblioteca literaria
      </p>

      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {!modoRecuperacion ? (
          <>
            <input
              placeholder="Usuario o email"
              value={form.username}
              onChange={e => handleChange('username', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="username"
              style={inputStyle(!!error)}
            />
            <input
              placeholder="Contraseña"
              type="password"
              value={form.password}
              onChange={e => handleChange('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete="current-password"
              style={inputStyle(!!error)}
            />

            {error && (
              <div style={{
                background: 'rgba(192,99,90,0.12)', border: '1px solid rgba(192,99,90,0.4)',
                borderRadius: '10px', padding: '10px 14px',
                color: '#E08080', fontSize: '13px', textAlign: 'center',
                animation: 'fadeIn 0.2s ease',
              }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={cargando} style={btnStyle(cargando)}>
              {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>

            <button
              onClick={() => { setModoRecuperacion(true); setError(''); }}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                fontSize: '13px', cursor: 'pointer', textAlign: 'center', padding: '4px',
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
              Ingresa tu usuario o correo y elige una nueva contraseña
            </p>
            <input
              placeholder="Usuario o email"
              value={recuperar.identificador}
              onChange={e => { setRecuperar(prev => ({ ...prev, identificador: e.target.value })); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleRecuperar()}
              style={inputStyle(!!error)}
            />
            <input
              placeholder="Nueva contraseña"
              type="password"
              value={recuperar.nuevaPassword}
              onChange={e => { setRecuperar(prev => ({ ...prev, nuevaPassword: e.target.value })); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleRecuperar()}
              style={inputStyle(!!error)}
            />

            {error && (
              <div style={{
                background: 'rgba(192,99,90,0.12)', border: '1px solid rgba(192,99,90,0.4)',
                borderRadius: '10px', padding: '10px 14px',
                color: '#E08080', fontSize: '13px', textAlign: 'center',
              }}>
                {error}
              </div>
            )}
            {mensajeRecuperacion && (
              <div style={{
                background: 'rgba(90,160,100,0.12)', border: '1px solid rgba(90,160,100,0.4)',
                borderRadius: '10px', padding: '10px 14px',
                color: '#80C890', fontSize: '13px', textAlign: 'center',
              }}>
                {mensajeRecuperacion} — ahora puedes iniciar sesión
              </div>
            )}

            <button onClick={handleRecuperar} disabled={cargando} style={btnStyle(cargando)}>
              {cargando ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>

            <button
              onClick={() => { setModoRecuperacion(false); setError(''); setMensajeRecuperacion(''); }}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                fontSize: '13px', cursor: 'pointer', textAlign: 'center', padding: '4px',
              }}
            >
              Volver al inicio de sesión
            </button>
          </>
        )}

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          ¿No tienes cuenta?{' '}
          <Link to="/register" style={{ color: 'var(--accent-warm)', textDecoration: 'none', fontWeight: '600' }}>
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
};

const inputStyle = (hasError) => ({
  background: 'var(--bg-card)',
  border: `1px solid ${hasError ? 'rgba(192,99,90,0.5)' : 'var(--border-subtle)'}`,
  borderRadius: '12px',
  padding: '14px 16px',
  color: 'var(--text-primary)',
  fontSize: '15px',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.2s',
});

const btnStyle = (disabled) => ({
  background: disabled ? 'var(--accent-deep)' : 'var(--accent-warm)',
  color: 'var(--bg-primary)',
  border: 'none',
  borderRadius: '12px',
  padding: '14px',
  fontSize: '15px',
  fontWeight: '700',
  cursor: disabled ? 'not-allowed' : 'pointer',
  width: '100%',
  transition: 'background 0.2s',
  fontFamily: "'Inter', system-ui, sans-serif",
});

export default Login;
