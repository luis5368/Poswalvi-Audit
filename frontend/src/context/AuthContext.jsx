import usePermisosSesion from './usePermisosSesion';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  loginRequest,
  logoutRequest,
  cambiarPasswordRequest
} from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const permisosSesion = usePermisosSesion(token);
  const puede = (modulo,accion) => permisosSesion.permisos.includes(modulo+':'+accion);
  useEffect(()=>{const invalidar=()=>{setToken(null);setUsuario(null);};const cambio=e=>{if(e.key==='poswalvi_token'||e.key==='poswalvi_usuario')invalidar();};window.addEventListener('poswalvi-sesion-invalida',invalidar);window.addEventListener('storage',cambio);return()=>{window.removeEventListener('poswalvi-sesion-invalida',invalidar);window.removeEventListener('storage',cambio);};},[]);

  useEffect(() => {
    const tokenGuardado = localStorage.getItem('poswalvi_token');
    const usuarioGuardado = localStorage.getItem('poswalvi_usuario');

    if (tokenGuardado && usuarioGuardado) {
      setToken(tokenGuardado);
      try {setUsuario(JSON.parse(usuarioGuardado));} catch {localStorage.removeItem('poswalvi_token');localStorage.removeItem('poswalvi_usuario');setToken(null);}
    }

    setCargandoAuth(false);
  }, []);

  const login = async ({ usuario: userInput, password }) => {
    const data = await loginRequest({
      usuario: userInput,
      password
    });

    if (data.ok) {
      localStorage.setItem('poswalvi_token', data.token);
      localStorage.setItem('poswalvi_usuario', JSON.stringify(data.usuario));

      setToken(data.token);
      setUsuario(data.usuario);
    }

    return data;
  };

  const cambiarPassword = async ({
    password_actual,
    password_nueva,
    confirmar_password
  }) => {
    const data = await cambiarPasswordRequest({
      password_actual,
      password_nueva,
      confirmar_password
    });

    if (data.ok) {
      const usuarioActualizado = {
        ...usuario,
        requiere_cambio_password: 0
      };

      localStorage.setItem(
        'poswalvi_usuario',
        JSON.stringify(usuarioActualizado)
      );

      setUsuario(usuarioActualizado);
      permisosSesion.refrescarPermisos();
    }

    return data;
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch (error) {
      console.warn('No se pudo cerrar sesión en backend:', error.message);
    }

    localStorage.removeItem('poswalvi_token');
    localStorage.removeItem('poswalvi_usuario');

    setToken(null);
    setUsuario(null);
  };

  const estaAutenticado = Boolean(token && usuario);

  return (
    <AuthContext.Provider
      value={{
        ...permisosSesion,
        puede,
        usuario,
        token,
        cargandoAuth,
        estaAutenticado,
        login,
        logout,
        cambiarPassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};