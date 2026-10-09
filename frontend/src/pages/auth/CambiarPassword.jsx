import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import './auth.css';

const CambiarPassword = () => {
  const navigate = useNavigate();
  const { cambiarPassword, usuario } = useAuth();

  const [form, setForm] = useState({
    password_actual: '',
    password_nueva: '',
    confirmar_password: ''
  });

  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.password_actual ||
      !form.password_nueva ||
      !form.confirmar_password
    ) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Completa todos los campos'
      });
      return;
    }

    if (form.password_nueva !== form.confirmar_password) {
      Swal.fire({
        icon: 'warning',
        title: 'Las contraseñas no coinciden',
        text: 'Verifica la confirmación de contraseña'
      });
      return;
    }

    try {
      setCargando(true);

      await cambiarPassword(form);

      await Swal.fire({
        icon: 'success',
        title: 'Contraseña actualizada',
        text: 'Ahora puedes continuar al sistema'
      });

      navigate('/dashboard', { replace: true });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo cambiar la contraseña',
        text:
          error.response?.data?.mensaje ||
          'Verifica la información ingresada'
      });
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="password-card">
        <div className="password-icon">
          <LockKeyhole size={34} />
        </div>

        <h1>Cambio de contraseña</h1>

        <p>
          Hola, <strong>{usuario?.nombre || usuario?.usuario}</strong>. Por
          seguridad debes actualizar tu contraseña antes de continuar.
        </p>

        <form className="password-form" onSubmit={handleSubmit}>
          <label>
            Contraseña actual
            <input
              type="password"
              name="password_actual"
              value={form.password_actual}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </label>

          <label>
            Nueva contraseña
            <input
              type="password"
              name="password_nueva"
              value={form.password_nueva}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </label>

          <label>
            Confirmar nueva contraseña
            <input
              type="password"
              name="confirmar_password"
              value={form.confirmar_password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </label>

          <div className="password-rules">
            <ShieldCheck size={17} />
            <span>Mínimo 8 caracteres, letras y números.</span>
          </div>

          <button type="submit" disabled={cargando}>
            {cargando ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default CambiarPassword;