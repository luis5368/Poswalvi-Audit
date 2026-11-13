import {useEffect, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import Swal from 'sweetalert2';
import {trazaNavegacion} from '../services/trazaNavegacion';

// Solo marcas en memoria; no conserva valores ni borradores.
export default function useProteccionEdicion() {
  const root = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const forms = new Set();
    let preguntando = false;
    const editado = e => { if (e.target.form && root.current?.contains(e.target)) forms.add(e.target.form); };
    const pendiente = () => [...forms].some(f => f.isConnected);
    const unload = e => {
      trazaNavegacion('salida_documento');
      if (pendiente()) { e.preventDefault(); e.returnValue = ''; }
    };
    const enlace = async e => {
      const a = e.target.closest?.('a[href]');
      if (!a || !root.current?.contains(a) || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || a.target === '_blank') return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || !pendiente()) return;
      e.preventDefault(); e.stopPropagation();
      if (preguntando) return;
      preguntando = true;
      const result = await Swal.fire({icon:'warning',title:'¿Salir de esta pantalla?',text:'Ha editado un formulario. Verifique que guardó los cambios antes de salir.',showCancelButton:true,confirmButtonText:'Salir',cancelButtonText:'Continuar editando'});
      preguntando = false;
      // Si expiró la sesión durante la confirmación, no reinstalar una ruta anterior.
      if (result.isConfirmed && root.current) navigate(url.pathname + url.search + url.hash);
    };
    document.addEventListener('input',editado,true);
    document.addEventListener('change',editado,true);
    document.addEventListener('click',enlace,true);
    window.addEventListener('beforeunload',unload);
    trazaNavegacion('montaje_pantalla');
    return () => {
      document.removeEventListener('input',editado,true);
      document.removeEventListener('change',editado,true);
      document.removeEventListener('click',enlace,true);
      window.removeEventListener('beforeunload',unload);
      forms.clear();
      trazaNavegacion('desmontaje_pantalla');
    };
  },[navigate]);
  return root;
}
