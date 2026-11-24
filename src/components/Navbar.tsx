import {
  BookOpen,
  Clover,
  LogOut,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export function Navbar() {
  const { authUser, profile, publicConfig, isDemoMode, signOut } = useApp();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand-link" id="nav-brand-link">
          <img
            src="./megacorn-mascot.jpg"
            alt="Mascote MegaCorn"
            className="brand-avatar"
          />
          <span>
            <span className="brand-title">
              {publicConfig.poolName}
              <span className="badge badge-warning">{publicConfig.edition}</span>
            </span>
            <span className="brand-sub">
              Bolão de Fim de Ano • Unicorn
            </span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="Navegação principal">
          <NavLink
            to="/regras"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            id="nav-rules"
          >
            <BookOpen size={15} />
            Regras
          </NavLink>

          {authUser && (
            <>
              <NavLink
                to="/minha-cota"
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
                id="nav-my-quota"
              >
                <Ticket size={15} />
                Minha Cota
              </NavLink>

              {(publicConfig.flags.boardVisible || profile?.isModerator) && (
                <NavLink
                  to="/placar"
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' active' : ''}`
                  }
                  id="nav-board"
                >
                  <Users size={15} />
                  Placar
                </NavLink>
              )}

              {(publicConfig.flags.gamesVisible || profile?.isModerator) && (
                <NavLink
                  to="/jogos"
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' active' : ''}`
                  }
                  id="nav-games"
                >
                  <Clover size={15} />
                  Jogos &amp; Chances
                </NavLink>
              )}

              {profile?.isModerator && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' active' : ''}`
                  }
                  id="nav-admin"
                >
                  <ShieldCheck size={15} />
                  Admin
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="nav-actions">
          {isDemoMode && (
            <span
              className="badge badge-unicorn"
              title="Rodando localmente em modo demonstração sem Firebase configurado"
            >
              <Sparkles size={13} />
              Modo Demo
            </span>
          )}

          {authUser ? (
            <div className="row" style={{ gap: 8 }}>
              <span
                className="badge badge-neutral"
                title={`Conectado como ${authUser.email}`}
              >
                {profile?.displayName || authUser.email}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSignOut}
                id="btn-sign-out"
                title="Encerrar sessão neste navegador"
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          ) : (
            <Link to="/" className="btn btn-primary btn-sm" id="nav-login-btn">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
