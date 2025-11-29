import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import firebase from 'firebase/compat/app';

import { tmdbApi, TMDB_IMAGE_URL } from '../services/tmdbApi';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';

import ContentCard from '../components/ContentCard';
import { SearchIcon, TicketIcon, PaperAirplaneIcon, CloseIcon, PlayIcon } from '../components/Icons'; // Garanta que PlayIcon exista ou remova
import { Spinner, ContentCardSkeleton, getAvatarUrl } from '../components/Common';

// --- CONFIGURAÇÃO VISUAL DAS ABAS (Mantendo os Gradients Originais) ---
const TABS = [
    { id: 'now_playing', name: 'Cinema', icon: TicketIcon, gradient: 'from-yellow-500 to-amber-600', shadow: 'shadow-yellow-500/20' },
    { id: 8, name: 'Netflix', icon: null, gradient: 'from-red-600 to-rose-700', shadow: 'shadow-red-600/20' },
    { id: 119, name: 'Prime', icon: null, gradient: 'from-blue-400 to-cyan-500', shadow: 'shadow-blue-400/20' },
    { id: 337, name: 'Disney+', icon: null, gradient: 'from-indigo-600 to-blue-700', shadow: 'shadow-indigo-600/20' },
    { id: 1899, name: 'Max', icon: null, gradient: 'from-purple-600 to-fuchsia-700', shadow: 'shadow-purple-600/20' },
    { id: 350, name: 'Apple TV', icon: null, gradient: 'from-gray-500 to-gray-600', shadow: 'shadow-gray-500/20' },
];

const SearchPage = () => {
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth();

    // Estados
    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState('now_playing');
    const [results, setResults] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    
    // Conteúdo das Abas
    const [tabContent, setTabContent] = useState([]);
    const [loadingContent, setLoadingContent] = useState(false);

    // Modal Convite
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [movieToInvite, setMovieToInvite] = useState(null);
    const [friends, setFriends] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [inviteSentTo, setInviteSentTo] = useState(null);

    const debounceRef = useRef(null);

    // --- 1. BUSCA DE CONTEÚDO (Lógica Restaurada) ---
    useEffect(() => {
        if (query.trim()) return;

        const fetchContent = async () => {
            setLoadingContent(true);
            try {
                let data;
                if (activeTab === 'now_playing') {
                    // Lógica Cinema (Datas)
                    const today = new Date();
                    const maxDateStr = today.toISOString().split('T')[0];
                    const minBrDate = new Date(); minBrDate.setDate(today.getDate() - 40);
                    const minGlobalDate = new Date(); minGlobalDate.setDate(today.getDate() - 180);

                    data = await tmdbApi.get('discover/movie', {
                        page: 1, region: 'BR', sort_by: 'popularity.desc', include_adult: false,
                        'with_release_type': '3', // 3 = Theatrical (Limited), 2 = Theatrical (Regular)
                        // Exclui produções originais dos principais serviços de streaming.
                        // 8 (Netflix), 119 (Prime), 337 (Disney+), 1899 (Max), 350 (Apple TV)
                        'without_companies': '8|119|337|1899|350',
                        'release_date.gte': minBrDate.toISOString().split('T')[0],
                        'release_date.lte': maxDateStr,
                        'primary_release_date.gte': minGlobalDate.toISOString().split('T')[0],
                        'vote_count.gte': 100
                    });
                } else {
                    data = await tmdbApi.discoverContent('movie', activeTab, 1, null, 'popularity.desc');
                }
                setTabContent(data.results.filter(m => m.poster_path && m.popularity > 10) || []);
            } catch (error) { console.error(error); } 
            finally { setLoadingContent(false); }
        };
        fetchContent();
    }, [activeTab, query]);

    // --- 2. BUSCA (Debounce) ---
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!query.trim()) { setPredictions([]); return; }

        debounceRef.current = setTimeout(async () => {
            const data = await tmdbApi.get('search/multi', { query });
            setPredictions(data.results.filter(i => (i.media_type === 'movie' || i.media_type === 'tv') && i.poster_path).slice(0, 5));
        }, 300);
        return () => clearTimeout(debounceRef.current);
    }, [query]);

    const handleSearch = async (e) => {
        e.preventDefault();
        setPredictions([]);
        if (!query.trim()) { setResults([]); return; }
        setLoadingSearch(true);
        try {
            const data = await tmdbApi.get('search/multi', { query });
            setResults(data.results.filter(i => i.poster_path));
        } finally { setLoadingSearch(false); }
    };

    // --- 3. LÓGICA DE CONVITE (Simplificada para brevidade) ---
    const handleOpenInvite = async (e, movie) => {
        e.stopPropagation();
        setMovieToInvite(movie);
        setShowInviteModal(true);
        if (friends.length === 0 && userData?.seguindo?.length > 0) {
            setLoadingFriends(true);
            try {
                const friendsSnap = await db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', userData.seguindo.slice(0, 10)).get();
                setFriends(friendsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } finally { setLoadingFriends(false); }
        }
    };

    const sendInvite = async (friendId) => {
        if (!currentUser) return;
        const batch = db.batch();
        const sortedIds = [currentUser.uid, friendId].sort();
        const convoRef = db.collection("conversations").doc(sortedIds.join('_'));
        
        batch.set(convoRef.collection("messages").doc(), {
            senderId: currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'movie_invite', movie: { id: movieToInvite.id, title: movieToInvite.title || movieToInvite.name, poster_path: movieToInvite.poster_path, mediaType: 'movie' },
            text: `Bora ver ${movieToInvite.title}?`, acceptedBy: []
        });
        batch.set(convoRef, { 
            participants: sortedIds, 
            lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            [`deletedBy.${currentUser.uid}`]: false, [`deletedBy.${friendId}`]: false 
        }, { merge: true });
        
        await batch.commit();
        setInviteSentTo(friendId);
        setTimeout(() => { setInviteSentTo(null); setShowInviteModal(false); }, 1500);
    };

    const isSearching = query.trim().length > 0;

    return (
        <div className="min-h-screen text-white relative bg-gray-900 font-sans">
            {/* Background Atmosphere (Mantido do original) */}
            <div className="fixed top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-900/40 via-gray-900/60 to-gray-900 -z-10 pointer-events-none" />

            <div className="container mx-auto px-4 pb-24 pt-6 max-w-7xl">
                
                {/* --- BARRA DE BUSCA (Estilo Neon Restaurado) --- */}
                <div className="sticky top-4 z-40 mb-10 flex flex-col items-center">
                    <form onSubmit={handleSearch} className="w-full max-w-4xl relative group transition-all duration-300">
                        {/* GLOW EFFECT (O "brilho" que você gostava) */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500 animate-pulse-slow"></div>
                        
                        <div className="relative flex items-center bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl">
                            <span className="pl-5 text-gray-400 group-focus-within:text-white transition-colors"><SearchIcon className="w-6 h-6"/></span>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Pesquise filmes, séries, atores..."
                                className="w-full bg-transparent border-none text-white placeholder-gray-500 px-5 py-4 focus:outline-none text-lg font-medium tracking-wide"
                            />
                            {loadingSearch && <div className="pr-5"><Spinner size="sm" /></div>}
                        </div>

                        {/* Dropdown de Predições */}
                        <AnimatePresence>
                            {predictions.length > 0 && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full mt-3 w-full bg-gray-800/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                                >
                                    {predictions.map(item => (
                                        <div key={item.id} onClick={() => navigate(`/detail/${item.media_type}/${item.id}`)} 
                                             className="flex items-center p-3 hover:bg-white/10 cursor-pointer border-b border-gray-700/50 last:border-0 transition-colors">
                                            <img src={item.poster_path ? `${TMDB_IMAGE_URL.replace('original', 'w92')}${item.poster_path}` : 'https://via.placeholder.com/40'} 
                                                 className="w-10 h-14 object-cover rounded shadow-lg mr-4" alt=""/>
                                            <div>
                                                <p className="font-bold text-gray-100">{item.title || item.name}</p>
                                                <p className="text-xs text-gray-400">{item.media_type === 'movie' ? 'Filme' : 'Série'} • {item.release_date?.split('-')[0]}</p>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>
                </div>

                {/* --- MODO BUSCA ATIVA --- */}
                {isSearching ? (
                    <div className="animate-fade-in pt-4">
                        <h3 className="text-xl font-bold mb-6 text-gray-200 pl-2 border-l-4 border-indigo-500">Resultados para "{query}"</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {results.map(item => (
                                <div key={item.id} onClick={() => navigate(`/detail/${item.media_type}/${item.id}`)} className="cursor-pointer hover:scale-105 transition-transform duration-300">
                                    <ContentCard content={item} mediaType={item.media_type} />
                                </div>
                            ))}
                        </div>
                        {results.length === 0 && !loadingSearch && <p className="text-center text-gray-500 mt-20">Nada encontrado.</p>}
                    </div>
                ) : (
                    /* --- MODO EXPLORAÇÃO (ABAS) --- */
                    <div className="animate-fade-in">
                        {/* CONTAINER DAS ABAS
                           - Mobile: Scroll Horizontal (overflow-x-auto)
                           - Desktop: Centralizado (justify-center)
                           - Estilo: Pills com Gradients Restaurados
                        */}
                        <div className="flex justify-start sm:justify-center overflow-x-auto pb-6 mb-2 px-2 sm:px-0 scrollbar-hide">
                            <div className="flex items-center gap-3 bg-gray-800/30 p-2 rounded-full border border-gray-700/30 backdrop-blur-sm">
                                {TABS.map(tab => {
                                    const isActive = activeTab === tab.id;
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`
                                                relative flex items-center justify-center gap-2 px-6 py-2.5 rounded-full transition-all duration-500 ease-out whitespace-nowrap group
                                                ${isActive ? 'text-white scale-105' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}
                                            `}
                                        >
                                            {/* BACKGROUND ANIMADO (GRADIENT) */}
                                            {isActive && (
                                                <motion.div 
                                                    layoutId="activeTabBg"
                                                    className={`absolute inset-0 bg-gradient-to-r ${tab.gradient} rounded-full ${tab.shadow} shadow-lg`} 
                                                    initial={false} 
                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                />
                                            )}
                                            
                                            {/* CONTEÚDO (Z-INDEX PARA FICAR ACIMA DO BG) */}
                                            <div className="relative z-10 flex items-center gap-2">
                                                {Icon && <Icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />}
                                                {/* CORREÇÃO: Nome sempre visível, sem classes duplicadas */}
                                                <span className="font-bold text-sm tracking-wide">{tab.name}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Conteúdo da Aba */}
                        <div className="min-h-[400px] mt-6">
                            {loadingContent ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {Array.from({ length: 10 }).map((_, i) => <ContentCardSkeleton key={i} />)}
                                </div>
                            ) : (
                                <motion.div 
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                                >
                                    {/* Título da Seção */}
                                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 px-1">
                                        {activeTab === 'now_playing' ? 'Em Cartaz nos Cinemas' : `Destaques ${TABS.find(t => t.id === activeTab)?.name}`}
                                    </h2>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                                        {tabContent.map(item => (
                                            <div key={item.id} className="relative group cursor-pointer" onClick={() => navigate(`/detail/movie/${item.id}`)}>
                                                {/* Card com Hover Effect */}
                                                <div className="relative z-10 transition-transform duration-300 group-hover:scale-[1.02]">
                                                    <ContentCard content={item} mediaType="movie" />
                                                </div>
                                                
                                                {/* Botão de Convite - Estilo Neon */}
                                                {activeTab === 'now_playing' && (
                                                    <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0 px-2 pointer-events-none group-hover:pointer-events-auto">
                                                        <button 
                                                            onClick={(e) => handleOpenInvite(e, item)}
                                                            className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs py-3 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] flex items-center justify-center gap-2 transform active:scale-95 transition-transform"
                                                        >
                                                            <TicketIcon className="w-4 h-4" />
                                                            CHAMAR GALERA
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- MODAL DE CONVITE (Mantido mas ajustado) --- */}
                <AnimatePresence>
                    {showInviteModal && movieToInvite && (
                        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowInviteModal(false)}>
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" 
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        <TicketIcon className="w-5 h-5 text-yellow-500" /> Convite
                                    </h3>
                                    <button onClick={() => setShowInviteModal(false)} className="bg-gray-700/50 p-1 rounded-full text-gray-400 hover:text-white"><CloseIcon className="w-5 h-5" /></button>
                                </div>

                                <div className="p-5">
                                    <div className="flex items-center gap-4 mb-6 bg-gray-900/50 p-3 rounded-xl border border-gray-700">
                                        <img src={`${TMDB_IMAGE_URL.replace('original', 'w92')}${movieToInvite.poster_path}`} className="w-12 h-16 rounded object-cover" alt="" />
                                        <div>
                                            <p className="text-xs text-yellow-500 font-bold uppercase">Filme Selecionado</p>
                                            <p className="font-bold text-white leading-tight line-clamp-2">{movieToInvite.title}</p>
                                        </div>
                                    </div>
                                    
                                    <p className="text-gray-400 text-xs uppercase font-bold mb-3 tracking-wider">Seus Amigos</p>
                                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {loadingFriends ? <div className="text-center py-4"><Spinner size="sm"/></div> : 
                                         friends.length > 0 ? friends.map(friend => {
                                            const isSent = inviteSentTo === friend.id;
                                            return (
                                                <button key={friend.id} onClick={() => !isSent && sendInvite(friend.id)}
                                                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${isSent ? 'bg-green-500/10 border-green-500/50' : 'bg-gray-700/30 border-transparent hover:bg-gray-700'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <img src={getAvatarUrl(friend.foto, friend.nome)} className="w-10 h-10 rounded-full border border-gray-600" alt=""/>
                                                        <div className="text-left"><span className="block text-sm font-bold text-gray-200">{friend.nome}</span></div>
                                                    </div>
                                                    {isSent ? <span className="text-xs text-green-400 font-bold">Enviado</span> : <PaperAirplaneIcon className="w-4 h-4 text-indigo-400" />}
                                                </button>
                                            )
                                         }) : <p className="text-center text-gray-500 text-sm py-4">Nenhum amigo encontrado.</p>}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default SearchPage;