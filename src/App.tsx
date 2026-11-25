import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MagicLinkHandler } from './components/MagicLinkHandler';
import { Navbar } from './components/Navbar';
import { StatusBanner } from './components/StatusBanner';
import { AppProvider } from './context/AppContext';
import { AdminPage } from './pages/AdminPage';
import { BoardPage } from './pages/BoardPage';
import { GamesPage } from './pages/GamesPage';
import { HomePage } from './pages/HomePage';
import { MyQuotaPage } from './pages/MyQuotaPage';
import { RulesPage } from './pages/RulesPage';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Início e Login — MegaCorn',
  '/regras': 'Regras e Funcionamento — MegaCorn',
  '/minha-cota': 'Minha Cota e Pagamento PIX — MegaCorn',
  '/placar': 'Placar de Transparência — MegaCorn',
  '/jogos': 'Jogos, Probabilidades e Conferidor — MegaCorn',
  '/admin': 'Painel dos Moderadores — MegaCorn',
};

function RouteAccessibilityManager() {
  const location = useLocation();
  const title = ROUTE_TITLES[location.pathname] || 'MegaCorn — Bolão do Time';

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      Página atual: {title}
    </div>
  );
}

export default function App() {
  function handleSkipToContent(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.focus();
      mainEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <AppProvider>
      <HashRouter>
        <div className="app-shell">
          <a
            href="#main-content"
            className="skip-link"
            onClick={handleSkipToContent}
          >
            Pular para o conteúdo principal
          </a>
          <RouteAccessibilityManager />
          <Navbar />
          <StatusBanner />
          <MagicLinkHandler />
          <main id="main-content" tabIndex={-1} className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/regras" element={<RulesPage />} />
              <Route path="/minha-cota" element={<MyQuotaPage />} />
              <Route path="/placar" element={<BoardPage />} />
              <Route path="/jogos" element={<GamesPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </main>
          <footer className="footer">
            <div className="container row-between">
              <span>
                <strong>MegaCorn</strong> • Bolão de Fim de Ano do Time
              </span>
              <span>
                Privacidade: e-mail e CPF isolados (PII) • Todas as informações
                serão deletadas em até 30 dias após o sorteio
              </span>
            </div>
          </footer>
        </div>
      </HashRouter>
    </AppProvider>
  );
}
