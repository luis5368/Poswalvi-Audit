import {useEffect, useRef} from 'react';
import {trazaNavegacion} from '../services/trazaNavegacion';
import {useLocation} from 'react-router-dom';
import {rutaPermitida} from '../services/permisosNavegacion';
import MainLayout from '../components/layout/MainLayout';
import Reportes from '../pages/reportes/Reportes';
import Configuracion from '../pages/configuracion/Configuracion';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Login from '../pages/auth/Login';
import CambiarPassword from '../pages/auth/CambiarPassword';
import DashboardAdmin from '../pages/dashboard/DashboardAdmin';
import DashboardAuditoria from '../pages/auditoria/DashboardAuditoria';
import Usuarios from '../pages/usuarios/Usuarios';
import Clientes from '../pages/clientes/Clientes';
import Proveedores from '../pages/proveedores/Proveedores';
import Productos from '../pages/productos/Productos';
import Inventario from '../pages/inventario/Inventario';
import Ventas from '../pages/ventas/Ventas';
import Compras from '../pages/compras/Compras';
import CajaTurnos from '../pages/caja/CajaTurnos';
import CentroAlertas from '../pages/seguridad/CentroAlertas';

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
  const { estaAutenticado, usuario, cargandoAuth, estadoPermisos: estadoActualPermisos } = useAuth();

  if (cargandoAuth) {
    return null;
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  if (estadoActualPermisos === 'cargando') return null;

  if (Number(usuario?.requiere_cambio_password || 0) === 0 && estadoActualPermisos!=='CAMBIO_PASSWORD_REQUERIDO') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const RutaPrivadaNormal = ({ children }) => {
  const {pathname}=useLocation();
  const {permisos,estadoPermisos,refrescarPermisos}=useAuth();
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

  if(estadoPermisos==='CAMBIO_PASSWORD_REQUERIDO')return <Navigate to="/cambiar-password" replace />;
  if(!rutaPermitida(pathname,permisos))return <MainLayout><p role="status">{estadoPermisos==='cargando'?'Verificando permisos...':'Esta pantalla no esta autorizada o no se pudieron verificar sus permisos.'}</p><button onClick={refrescarPermisos}>Reintentar</button></MainLayout>;
  return children;
};

const AppRouter = () => {
  const {pathname}=useLocation();
  const anterior=useRef(pathname);
  const {estaAutenticado}=useAuth();
  useEffect(()=>{trazaNavegacion("ruta_SPA",{anterior:anterior.current,nueva:pathname,autenticado:estaAutenticado});anterior.current=pathname;},[pathname,estaAutenticado]);
  return (
    <Routes>
      <Route path="/alertas-seguridad" element={<RutaPrivadaNormal><CentroAlertas /></RutaPrivadaNormal>} />
      <Route path="/reportes" element={<RutaPrivadaNormal><Reportes /></RutaPrivadaNormal>} />
      <Route path="/configuracion" element={<RutaPrivadaNormal><Configuracion /></RutaPrivadaNormal>} />
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
      <Route
        path="/proveedores"
        element={
          <RutaPrivadaNormal>
            <Proveedores />
          </RutaPrivadaNormal>
        }
      />
      <Route
        path="/productos"
        element={
          <RutaPrivadaNormal>
            <Productos />
          </RutaPrivadaNormal>
        }
      />
      <Route
        path="/inventario"
        element={
          <RutaPrivadaNormal>
            <Inventario />
          </RutaPrivadaNormal>
        }
      />
      <Route
        path="/ventas"
        element={
          <RutaPrivadaNormal>
            <Ventas />
          </RutaPrivadaNormal>
        }
      />
      <Route
        path="/compras"
        element={
          <RutaPrivadaNormal>
            <Compras />
          </RutaPrivadaNormal>
        }
      />
      <Route
        path="/caja"
        element={
          <RutaPrivadaNormal>
            <CajaTurnos />
          </RutaPrivadaNormal>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRouter;
