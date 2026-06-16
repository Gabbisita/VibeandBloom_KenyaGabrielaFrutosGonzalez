import { Link, useLocation } from 'react-router-dom';
import { HiHome, HiBookOpen, HiMagnifyingGlass, HiUser } from 'react-icons/hi2';

const links = [
  { path: '/', icon: HiHome, label: 'Inicio' },
  { path: '/library', icon: HiBookOpen, label: 'Biblioteca' },
  { path: '/search', icon: HiMagnifyingGlass, label: 'Buscar' },
  { path: '/profile', icon: HiUser, label: 'Perfil' },
];

const Navbar = () => {
  const location = useLocation();

  return (
    <>
      {/* Desktop sidebar */}
      <nav style={{
        position: 'fixed', left: 0, top: 0, bottom: 0,
        width: '220px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column',
        padding: '32px 0 24px',
        zIndex: 100,
      }} className="desktop-nav">
        <div style={{ padding: '0 24px 32px' }}>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '22px', fontWeight: '700',
            color: 'var(--accent-warm)', letterSpacing: '-0.5px'
          }}>Novelia</span>
        </div>
        {links.map(link => {
          const Icon = link.icon;
          const active = location.pathname === link.path;
          return (
            <Link key={link.path} to={link.path} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '13px 24px', textDecoration: 'none',
              color: active ? 'var(--accent-warm)' : 'var(--text-muted)',
              fontSize: '14px', fontWeight: active ? '600' : '400',
              background: active ? 'var(--bg-card)' : 'transparent',
              borderRight: active ? '3px solid var(--accent-warm)' : '3px solid transparent',
              transition: 'all 0.15s ease',
            }}>
              <Icon size={20} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile bottom nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(10px)',
        display: 'flex', justifyContent: 'space-around',
        padding: '10px 0 18px', zIndex: 100,
      }} className="mobile-nav">
        {links.map(link => {
          const Icon = link.icon;
          const active = location.pathname === link.path;
          return (
            <Link key={link.path} to={link.path} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '4px', textDecoration: 'none',
              color: active ? 'var(--accent-warm)' : 'var(--text-muted)',
              fontSize: '10px', fontWeight: active ? '600' : '400',
              transition: 'color 0.15s ease',
              minWidth: '60px',
            }}>
              <Icon size={22} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
          .desktop-nav { display: flex !important; }
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </>
  );
};

export default Navbar;
