import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, User, Eye, EyeOff, Activity } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import './auth.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    usuario: '',
    password: ''
  });

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.usuario.trim() || !form.password.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Ingresa usuario y contraseña'
      });
      return;
    }

    try {
      setCargando(true);

      const data = await login(form);

      if (Number(data.usuario?.requiere_cambio_password || 0) === 1) {
        navigate('/cambiar-password', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Acceso denegado',
        text:
          error.response?.data?.mensaje ||
          'No se pudo iniciar sesión. Verifica tus credenciales.'
      });
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-left">
          <div className="brand-box">
            <div className="brand-icon">
              <Activity size={34} />
            </div>

            <div>
              <h1>POSWALVI</h1>
              <p>Punto de Venta & Auditoría Continua</p>
            </div>
          </div>

          <div className="auth-message">
            <h2>Control operativo en tiempo real</h2>
            <p>
              Accede al sistema administrativo para gestionar ventas, inventario,
              compras, caja y auditoría continua.
            </p>
          </div>

          <div className="auth-features">
            <div>
              <ShieldCheck size={20} />
              <span>Seguridad con JWT</span>
            </div>
            <div>
              <ShieldCheck size={20} />
              <span>Auditoría continua</span>
            </div>
            <div>
              <ShieldCheck size={20} />
              <span>Control de caja por turnos</span>
            </div>
            <div>
              <ShieldCheck size={20} />
              <span>Inventario en tiempo real</span>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-header">
              <h2>Iniciar sesión</h2>
              <p>Ingresa tus credenciales para continuar</p>
            </div>

            <label>
              Usuario
              <div className="input-box">
                <User size={18} />
                <input
                  type="text"
                  name="usuario"
                  placeholder="Ej. admin"
                  value={form.usuario}
                  onChange={handleChange}
                  autoComplete="username"
                />
              </div>
            </label>

            <label>
              Contraseña
              <div className="input-box">
                <Lock size={18} />
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Ingresa tu contraseña"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="eye-button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                >
                  {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button className="login-button" type="submit" disabled={cargando}>
              {cargando ? 'Validando...' : 'Iniciar sesión'}
            </button>

            <div className="login-footer">
              <span>POSWALVI V1.3</span>
              <span>Guatemala</span>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
};

export default Login;