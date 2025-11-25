import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HomeIcon, LayoutGridIcon, SearchIcon, UsersIcon, MessageSquareIcon, UserCircleIcon } from './Icons';

const BottomNavBar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuth();

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const navItems = [
        { path: '/feed', label: 'Feed', icon: HomeIcon },
        { path: '/home', label: 'Explorar', icon: LayoutGridIcon },
        { path: '/search', label: 'Buscar', icon: SearchIcon },
        { path: '/friends', label: 'Amigos', icon: UsersIcon },
        { path: '/chats', label: 'Chat', icon: MessageSquareIcon },
        { path: `/profile/${currentUser?.uid}`, label: 'Perfil', icon: UserCircleIcon }
    ];

    if (!currentUser) return null;

    return (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-50">
            <nav className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex justify-around items-center p-2">
                {navItems.map(item => (
                    <button
                        key={item.label}
                        onClick={() => navigate(item.path)}
                        className={`relative flex flex-col items-center justify-center w-full py-2 transition-all duration-300 rounded-xl ${
                            isActive(item.path) ? 'text-white' : 'text-gray-500'
                        }`}
                    >
                        {/* Indicador de Ativo (Ponto brilhante) */}
                        {isActive(item.path) && (
                            <div className="absolute -top-2 w-8 h-1 bg-indigo-500 rounded-b-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
                        )}
                        
                        <item.icon className={`w-6 h-6 mb-0.5 transition-transform duration-300 ${isActive(item.path) ? 'scale-110' : 'scale-100'}`} />
                        
                        {/* Label some quando não ativo para limpar o visual (opcional, estilo iOS) */}
                        {/* <span className={`text-[10px] font-medium transition-opacity ${isActive(item.path) ? 'opacity-100' : 'opacity-0 hidden'}`}>{item.label}</span> */}
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default BottomNavBar;