import { Bell, CalendarDays, LogOut, Search, UserCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './layout.css';

const Topbar = () => {
  const { usuario, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={18} />
        <input type="text" placeholder="Buscar en el sistema..." />
        <span>Ctrl + K</span>
      </div>

      <div className="topbar-actions">
        <button className="date-button">
          <CalendarDays size={18} />
          <span>Período actual</span>
        </button>

        <button className="notification-button">
          <Bell size={18} />
          <span>3</span>
        </button>

        <div className="user-box">
          <div className="user-avatar">
            <UserCircle size={24} />
          </div>

          <div>
            <strong>{usuario?.nombre || 'Usuario'}</strong>
            <span>{usuario?.rol || usuario?.nombre_rol}</span>
          </div>
        </div>

        <button className="logout-button" onClick={logout}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};

export default Topbar;