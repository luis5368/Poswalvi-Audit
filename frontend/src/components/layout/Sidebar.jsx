import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileBarChart,
  Home,
  Package,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Store,
  Truck,
  Users,
  WalletCards
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import './layout.css';

const menuItems = [
  { label: 'Dashboard', icon: Home, path: '/dashboard' },
  { label: 'Ventas', icon: ShoppingCart, path: '/ventas' },
  { label: 'Inventario', icon: Boxes, path: '/inventario' },
  { label: 'Compras', icon: Package, path: '/compras' },
  { label: 'Proveedores', icon: Truck, path: '/proveedores' },
  { label: 'Clientes', icon: Users, path: '/clientes' },
  { label: 'Caja y turnos', icon: WalletCards, path: '/caja' },
  { label: 'Usuarios', icon: Building2, path: '/usuarios' },
  { label: 'Auditoría Continua', icon: ShieldAlert, path: '/auditoria' },
  { label: 'Reportes', icon: FileBarChart, path: '/reportes' },
  { label: 'Configuración', icon: Settings, path: '/configuracion' }
];

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <BarChart3 size={30} />
        </div>

        <div>
          <h1>POSWALVI</h1>
          <p>VENTA & AUDITORÍA</p>
        </div>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                isActive ? 'sidebar-link active' : 'sidebar-link'
              }
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="company-avatar">W</div>

        <div>
          <strong>WALVI S.A.</strong>
          <span>Administrador</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;