import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Login from '../pages/auth/Login';
import CambiarPassword from '../pages/auth/CambiarPassword';
import DashboardAdmin from '../pages/dashboard/DashboardAdmin';
import DashboardAuditoria from '../pages/auditoria/DashboardAuditoria';
import Usuarios from '../pages/usuarios/Usuarios';
import Clientes from '../pages/clientes/Clientes';

const RutaPrivada = ({ children }) => {
  const { estaAutenticado, cargandoAuth } = useAuth();

  if (cargandoAuth) {
    return null;
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const RutaCambioPassword = ({ children }) => {
  const { estaAutenticado, usuario, cargandoAuth } = useAuth();

  if (cargandoAuth) {
    return null;
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  if (Number(usuario?.requiere_cambio_password || 0) === 0) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const RutaPrivadaNormal = ({ children }) => {
  const { estaAutenticado, usuario, cargandoAuth } = useAuth();

  if (cargandoAuth) {
    return null;
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  if (Number(usuario?.requiere_cambio_password || 0) === 1) {
    return <Navigate to="/cambiar-password" replace />;
  }

  return children;
};

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/cambiar-password"
        element={
          <RutaCambioPassword>
            <CambiarPassword />
          </RutaCambioPassword>
        }
      />

      <Route
        path="/dashboard"
        element={
          <RutaPrivadaNormal>
            <DashboardAdmin />
          </RutaPrivadaNormal>
        }
      />
      <Route
        path="/auditoria"
        element={
          <RutaPrivadaNormal>
            <DashboardAuditoria />
          </RutaPrivadaNormal>
        }
      />
      <Route
        path="/usuarios"
        element={
          <RutaPrivadaNormal>
            <Usuarios />
          </RutaPrivadaNormal>
        }
      />
      <Route
        path="/clientes"
        element={
          <RutaPrivadaNormal>
            <Clientes />
          </RutaPrivadaNormal>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRouter;