import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Library from './pages/Library';
import Search from './pages/Search';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import Navbar from './components/Navbar';
import './index.css';

const Layout = ({ children }) => (
  <>
    <Navbar />
    <div style={{ marginLeft: 0 }} className="main-content">
      {children}
    </div>
    <style>{`
      @media (min-width: 769px) {
        .main-content { margin-left: 220px !important; }
      }
    `}</style>
  </>
);

function App() {
  const token = localStorage.getItem('token');

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={token ? <Layout><Home /></Layout> : <Navigate to="/login" />} />
        <Route path="/library" element={token ? <Layout><Library /></Layout> : <Navigate to="/login" />} />
        <Route path="/search" element={token ? <Layout><Search /></Layout> : <Navigate to="/login" />} />
        <Route path="/profile" element={token ? <Layout><Profile /></Layout> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
