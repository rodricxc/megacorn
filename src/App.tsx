import { HashRouter, Route, Routes } from 'react-router-dom';
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

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <div className="app-shell">
          <Navbar />
          <StatusBanner />
          <MagicLinkHandler />
          <main className="main-content">
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
                <strong>MegaCorn</strong> • Bolão de Fim de Ano do Time 🌽🦄🍀
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
