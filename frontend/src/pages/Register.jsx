import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import API from '../config';

const Register = () => {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleChange = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      setError('Completa todos los campos');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setCargando(true);
    setError('');
    try {
      await axios.post(`${API}/registro`, {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      // Auto-login tras registro exitoso
      const body = new URLSearchParams();
      body.append('username', form.username.trim());
      body.append('password', form.password);
      const res = await axios.post(`${API}/login`, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('username', form.username.trim());
      window.location.href = '/';
    } catch (err) {
      const detalle = err?.response?.data?.detail;
      setError(detalle || 'Error al registrarse, intenta con otro usuario o email');
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
        Crea tu cuenta
      </p>

      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <input
          placeholder="Usuario"
          value={form.username}
          onChange={e => handleChange('username', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoComplete="username"
          style={inputStyle(!!error)}
        />
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={e => handleChange('email', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoComplete="email"
          style={inputStyle(!!error)}
        />
        <input
          placeholder="Contraseña (mín. 6 caracteres)"
          type="password"
          value={form.password}
          onChange={e => handleChange('password', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoComplete="new-password"
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
          {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: 'var(--accent-warm)', textDecoration: 'none', fontWeight: '600' }}>
            Inicia sesión
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

export default Register;
