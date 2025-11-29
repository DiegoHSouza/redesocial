import React, { useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HomeIcon, LayoutGridIcon, SearchIcon, UsersIcon, MessageSquareIcon, UserCircleIcon } from './Icons';

const BottomNavBar = () => {
    const navigate = useNavigate();
    // PERFORMANCE: Only destructure `pathname` to prevent re-renders when URL search params change.
    const { pathname } = useLocation();
    const { currentUser } = useAuth();

    // PERFORMANCE: Memoize the active path check. This callback only re-creates if `pathname` changes.
    const isActive = useCallback((path) => {
        if (path === '/') return pathname === '/';
        return pathname.startsWith(path);
    }, [pathname]);

    // PERFORMANCE: Memoize the navigation items array to prevent re-creation on every render.
    // It's stable unless the authenticated user's ID changes.
    const navItems = useMemo(() => [
        { path: '/feed', label: 'Feed', icon: HomeIcon },
        { path: '/home', label: 'Explorar', icon: LayoutGridIcon },
        { path: '/search', label: 'Buscar', icon: SearchIcon },
        { path: '/friends', label: 'Amigos', icon: UsersIcon },
        { path: '/chats', label: 'Chat', icon: MessageSquareIcon },
        // SECURITY: The user ID is from a trusted auth context, not user input, mitigating path injection risks.
        { path: `/profile/${currentUser?.uid}`, label: 'Perfil', icon: UserCircleIcon }
    ], [currentUser?.uid]);

    // UX: This handler provides a smart navigation action. If the user is already on the
    // target path (e.g., '/feed'), it scrolls to the top instead of re-navigating.
    const handleNavItemClick = useCallback((path) => {
        if (path === '/feed' && pathname === '/feed' && window.scrollY > 0) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            navigate(path);
        }
    }, [pathname, navigate]);

    // UX & SECURITY: Render only for authenticated users to prevent access to protected navigation
    // and avoid layout shifts for unauthenticated sessions on mobile viewports.
    if (!currentUser) return null;

    return (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-50">
            <nav className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex justify-around items-center p-2">
                {navItems.map(({ path, label, icon: Icon }) => {
                    const active = isActive(path);
                    return (
                        <button
                            key={label}
                            onClick={() => handleNavItemClick(path)}
                            className={`relative flex flex-col items-center justify-center w-full py-2 transition-all duration-300 rounded-xl ${
                                active ? 'text-white' : 'text-gray-500'
                            }`}
                            aria-label={label}
                            aria-current={active ? 'page' : undefined}
                        >
                            {active && <div className="absolute -top-2 w-8 h-1 bg-indigo-500 rounded-b-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>}
                            <Icon className={`w-6 h-6 mb-0.5 transition-transform duration-300 ${active ? 'scale-110' : 'scale-100'}`} />
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default BottomNavBar;