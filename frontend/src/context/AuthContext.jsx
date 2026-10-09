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

  useEffect(() => {
    const tokenGuardado = localStorage.getItem('poswalvi_token');
    const usuarioGuardado = localStorage.getItem('poswalvi_usuario');

    if (tokenGuardado && usuarioGuardado) {
      setToken(tokenGuardado);
      setUsuario(JSON.parse(usuarioGuardado));
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