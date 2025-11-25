import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import Notifications from './Notifications';
import { HomeIcon, LayoutGridIcon, SearchIcon, UsersIcon, MessageSquareIcon } from './Icons';
import { getAvatarUrl } from './Common';

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, userData } = useAuth();
    const [scrolled, setScrolled] = useState(false);

    // Detecta scroll para mudar a aparência do header
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const handleSignOut = async () => {
        try { await auth.signOut(); navigate('/login'); } catch (error) { console.error(error); }
    };
    
    return (
        // Header Flutuante com transição de vidro
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
            scrolled 
                ? 'bg-gray-900/80 backdrop-blur-xl border-white/5 py-3 shadow-lg shadow-black/20' 
                : 'bg-transparent border-transparent py-5'
        }`}>
            <div className="container mx-auto px-4 md:px-8 flex justify-between items-center">
                {/* Logo com Gradiente */}
                <h1 className="text-2xl font-black cursor-pointer tracking-tighter flex items-center gap-2" onClick={() => navigate('/feed')}>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-sm">
                        CineSync
                    </span>
                </h1>
                
                <div className="hidden md:flex items-center space-x-2 bg-black/20 p-1.5 rounded-full border border-white/5 backdrop-blur-md">
                    <NavItem icon={HomeIcon} active={isActive('/feed')} onClick={() => navigate('/feed')} tooltip="Feed" />
                    <NavItem icon={LayoutGridIcon} active={isActive('/home')} onClick={() => navigate('/home')} tooltip="Explorar" />
                    <NavItem icon={SearchIcon} active={isActive('/search')} onClick={() => navigate('/search')} tooltip="Buscar" />
                    <NavItem icon={UsersIcon} active={isActive('/friends')} onClick={() => navigate('/friends')} tooltip="Amigos" />
                    <NavItem icon={MessageSquareIcon} active={isActive('/chats')} onClick={() => navigate('/chats')} tooltip="Chat" />
                </div>

                <div className="flex items-center gap-4">
                    {currentUser && userData ? (
                        <>
                            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                                <Notifications />
                                <button onClick={() => navigate(`/profile/${currentUser.uid}`)} className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full opacity-0 group-hover:opacity-100 transition duration-300 blur-sm"></div>
                                    <img 
                                        src={getAvatarUrl(userData.foto, userData.nome)} 
                                        alt="Perfil" 
                                        className="relative w-9 h-9 rounded-full object-cover border border-white/10"
                                        onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, userData.nome); }}
                                    />
                                </button>
                            </div>
                        </>
                    ) : (
                        <button onClick={() => navigate('/login')} className="bg-white text-black hover:bg-gray-200 px-5 py-2 rounded-full text-sm font-bold transition-colors">Entrar</button>
                    )}
                </div>
            </div>
        </header>
    );
};

// Componente interno para os ícones de navegação com "Glow"
const NavItem = ({ icon: Icon, active, onClick, tooltip }) => (
    <button 
        onClick={onClick} 
        className={`relative p-2.5 rounded-full transition-all duration-300 group ${
            active ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
        title={tooltip}
    >
        <Icon className="w-5 h-5 relative z-10" />
        {active && (
            <span className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-full blur-sm z-0"></span>
        )}
    </button>
);

export default Header;