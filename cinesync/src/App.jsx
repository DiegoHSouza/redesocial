import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AnimatePresence } from 'framer-motion';

// --- PÁGINAS ---
import LoginPage from './pages/LoginPage';
import FeedPage from './pages/FeedPage';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import FindFriendsPage from './pages/FindFriendsPage';

// Páginas de Conteúdo
import DetailPage from './pages/DetailPage';
import StreamingCatalogPage from './pages/StreamingCatalogPage';
import ListPage from './pages/ListPage';
import ProfilePage from './pages/ProfilePage';
import CreateListPage from './pages/CreateListPage';

// Páginas Sociais/Chat
import ChatListPage from './pages/ChatListPage';
import ChatPage from './pages/ChatPage';

// Funcionalidades Premium / Novas
import CineMatchPage from './pages/CineMatchPage';
import CineBattlePage from './pages/CineBattlePage'; // ✅ ADICIONADO: Batalha de Filmes
import CineClubsPage from './pages/CineClubsPage';
import ClubDetailPage from './pages/ClubDetailPage';
import ClubPostPage from './pages/ClubPostPage';
import AchievementsPage from './pages/AchievementsPage';
import AboutPage from './pages/AboutPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';

// --- COMPONENTES GLOBAIS ---
import Header from './components/Header';
import BottomNavBar from './components/BottomNavBar';
import { Spinner } from './components/Common';
import PageTransition from './components/PageTransition';

// Proteção de Rotas (HOC)
const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="h-screen bg-gray-900 flex items-center justify-center"><Spinner/></div>;
  return currentUser ? children : <Navigate to="/login" />;
};

// Componente interno para usar hooks de rota
function AnimatedRoutes() {
    const location = useLocation();
    const { currentUser } = useAuth();

    return (
        // Layout base com ajuste para o Header fixo (pt-24)
        <div className={`bg-gray-900 min-h-screen text-white font-sans flex flex-col ${currentUser ? 'pt-24' : ''}`}>
            
            {currentUser && <Header />} 

            <AnimatePresence mode="wait">
                {/* A key location.pathname força o Framer Motion a animar na troca de rotas */}
                <Routes location={location} key={location.pathname}>
                    
                    {/* Autenticação */}
                    <Route path="/login" element={
                        <PageTransition><LoginPage /></PageTransition>
                    } />

                    {/* Rotas Públicas */}
                    <Route path="/privacy-policy" element={
                        <PageTransition><PrivacyPolicyPage /></PageTransition>
                    } />
                    <Route path="/about" element={
                        <PageTransition><AboutPage /></PageTransition>
                    } />
                    
                    {/* --- ROTAS PROTEGIDAS --- */}
                    
                    {/* Feed / Home Principal */}
                    <Route path="/" element={<PrivateRoute><PageTransition><FeedPage /></PageTransition></PrivateRoute>} />
                    <Route path="/feed" element={<PrivateRoute><PageTransition><FeedPage /></PageTransition></PrivateRoute>} />
                    
                    {/* Explorar (Roleta, Catálogo, Match, Clubes) */}
                    <Route path="/home" element={<PrivateRoute><PageTransition><HomePage /></PageTransition></PrivateRoute>} />
                    
                    {/* Busca e Descoberta */}
                    <Route path="/search" element={<PrivateRoute><PageTransition><SearchPage /></PageTransition></PrivateRoute>} />
                    <Route path="/friends" element={<PrivateRoute><PageTransition><FindFriendsPage /></PageTransition></PrivateRoute>} />
                    <Route path="/catalog/:serviceId" element={<PrivateRoute><PageTransition><StreamingCatalogPage /></PageTransition></PrivateRoute>} />
                    
                    {/* Conteúdo e Perfil */}
                    <Route path="/detail/:mediaType/:mediaId" element={<PrivateRoute><PageTransition><DetailPage /></PageTransition></PrivateRoute>} />
                    <Route path="/profile/:userId" element={<PrivateRoute><PageTransition><ProfilePage /></PageTransition></PrivateRoute>} />
                    <Route path="/profile/:userId/achievements" element={<PrivateRoute><PageTransition><AchievementsPage /></PageTransition></PrivateRoute>} />
                    <Route path="/list/:listId" element={<PageTransition><ListPage /></PageTransition>} />
                    <Route path="/create-list" element={<PrivateRoute><PageTransition><CreateListPage /></PageTransition></PrivateRoute>} />
                    
                    {/* Chat */}
                    <Route path="/chats" element={<PrivateRoute><PageTransition><ChatListPage /></PageTransition></PrivateRoute>} />
                    <Route path="/chat/:conversationId" element={<PrivateRoute><PageTransition><ChatPage /></PageTransition></PrivateRoute>} />
                    
                    {/* Funcionalidades Avançadas */}
                    <Route path="/match" element={<PrivateRoute><PageTransition><CineMatchPage /></PageTransition></PrivateRoute>} />
                    <Route path="/battle" element={<PrivateRoute><PageTransition><CineBattlePage /></PageTransition></PrivateRoute>} /> {/* ✅ ADICIONADO: Rota da Batalha */}
                    
                    {/* CLUBES */}
                    <Route path="/clubs" element={<PrivateRoute><PageTransition><CineClubsPage /></PageTransition></PrivateRoute>} />
                    <Route path="/club/:groupId" element={<PrivateRoute><PageTransition><ClubDetailPage /></PageTransition></PrivateRoute>} />
                    <Route path="/club/:groupId/post/:postId" element={<PrivateRoute><PageTransition><ClubPostPage /></PageTransition></PrivateRoute>} />
                    
                </Routes>
            </AnimatePresence>

            {currentUser && <BottomNavBar />}

            {/* Rodapé Global */}
            <footer className="w-full text-center p-4 mt-auto text-xs text-gray-500 border-t border-gray-800/50">
                <div className="flex justify-center items-center gap-4">
                    <span>© {new Date().getFullYear()} CineSync. Todos os direitos reservados.</span>
                    <Link to="/about" className="hover:text-gray-300 transition-colors">
                        Sobre Nós
                    </Link>
                    <Link to="/privacy-policy" className="hover:text-gray-300 transition-colors">
                        Política de Privacidade
                    </Link>
                </div>
            </footer>
        </div>
    );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AnimatedRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;