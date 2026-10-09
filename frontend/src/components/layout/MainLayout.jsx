import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './layout.css';

const MainLayout = ({ children }) => {
  return (
    <div className="main-layout">
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