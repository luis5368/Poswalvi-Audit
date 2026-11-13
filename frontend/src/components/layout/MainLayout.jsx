import useProteccionEdicion from '../../context/useProteccionEdicion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './layout.css';

const MainLayout = ({ children }) => {
  const root = useProteccionEdicion();
  return (
    <div ref={root} className="main-layout">
      <Sidebar />

      <section className="content-area">
        <Topbar />

        <main className="page-content">
          {children}
        </main>
      </section>
    </div>
  );
};

export default MainLayout;