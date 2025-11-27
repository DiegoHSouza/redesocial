import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tmdbApi, TMDB_IMAGE_URL } from '../services/tmdbApi';
import ContentCard from '../components/ContentCard';
// Ícones unificados
import { SearchIcon, TicketIcon, PaperAirplaneIcon, CloseIcon } from '../components/Icons';
import { Spinner, ContentCardSkeleton, getAvatarUrl } from '../components/Common';
import { db } from '../services/firebaseConfig'; 
import { useAuth } from '../contexts/AuthContext';
import firebase from 'firebase/compat/app';

// Configuração das Abas
const TABS = [
    { id: 'now_playing', name: 'Em Cartaz', icon: <TicketIcon className="w-5 h-5" />, color: 'yellow', gradient: 'from-yellow-500 to-amber-500' },
    { id: 8, name: 'Netflix', icon: <span className="font-black text-lg"></span>, color: 'red', gradient: 'from-red-600 to-rose-600' },
    { id: 119, name: 'Prime Video', icon: <span className="font-bold text-lg"></span>, color: 'cyan', gradient: 'from-cyan-500 to-sky-500' },
    { id: 337, name: 'Disney+', icon: <span className="font-bold text-lg"></span>, color: 'blue', gradient: 'from-blue-600 to-indigo-600' },
    { id: 1899, name: 'Max', icon: <span className="font-bold text-lg"></span>, color: 'purple', gradient: 'from-purple-600 to-fuchsia-600' },
    { id: 350, name: 'Apple TV+', icon: <span className="font-bold text-lg"></span>, color: 'gray', gradient: 'from-gray-400 to-gray-600' },
];

const SearchPage = () => {
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth();
    
    // Estados de Busca
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    
    // Estados de Conteúdo (Abas)
    const [activeTab, setActiveTab] = useState('now_playing');
    const [tabContent, setTabContent] = useState([]);
    const [loadingContent, setLoadingContent] = useState(false);

    // Estados do Modal de Convite
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [movieToInvite, setMovieToInvite] = useState(null);
    const [friends, setFriends] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [inviteSentTo, setInviteSentTo] = useState(null);

    const debounceTimeoutRef = useRef(null);

    // --- 1. CARREGAR CONTEÚDO (LÓGICA CORRIGIDA) ---
    useEffect(() => {
        if (query.trim()) return;

        const fetchTabContent = async () => {
            setLoadingContent(true);
            try {
                let data;
                if (activeTab === 'now_playing') {
                    // --- LÓGICA DE CINEMA (SOLUÇÃO ANTI-STREAMING) ---
                    const today = new Date();
                    
                    // DATA MÁXIMA = HOJE (Para não mostrar filmes que estreiam amanhã ou depois)
                    const maxDateStr = today.toISOString().split('T')[0];
                    
                    // DATA MÍNIMA = 40 dias atrás (Filmes que ainda estão em cartaz)
                    const minBrDate = new Date();
                    minBrDate.setDate(today.getDate() - 40); 
                    const minBrDateStr = minBrDate.toISOString().split('T')[0];

                    // DATA GLOBAL = 6 meses (Para evitar relançamentos de clássicos)
                    const minGlobalDate = new Date();
                    minGlobalDate.setDate(today.getDate() - 180);
                    const minGlobalDateStr = minGlobalDate.toISOString().split('T')[0];

                    data = await tmdbApi.get('discover/movie', { 
                        page: 1,
                        region: 'BR', 
                        sort_by: 'popularity.desc',
                        include_adult: false,
                        'with_release_type': '3', 
                        'without_companies': '20580,10201,2552', // Exclui Netflix, Amazon, Apple
                        'release_date.gte': minBrDateStr,
                        'release_date.lte': maxDateStr,
                        'primary_release_date.gte': minGlobalDateStr,
                        'vote_count.gte': 100 
                    });
                } else {
                    // Streaming
                    data = await tmdbApi.discoverContent('movie', activeTab, 1, null, 'popularity.desc');
                }
                setTabContent(data.results.filter(movie => movie.poster_path && movie.popularity > 10) || []);
            } catch (error) {
                console.error("Erro ao carregar aba:", error);
            } finally {
                setLoadingContent(false);
            }
        };

        fetchTabContent();
    }, [activeTab, query]);

    // --- 2. LÓGICA DE BUSCA ---
    useEffect(() => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        if (query.trim() === "") {
            setPredictions([]);
            return;
        }
        debounceTimeoutRef.current = setTimeout(async () => {
            try {
                const data = await tmdbApi.get('search/multi', { query });
                const filteredPredictions = data.results
                    .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
                    .slice(0, 5);
                setPredictions(filteredPredictions);
            } catch (error) {
                console.error("Falha ao buscar predições:", error);
            }
        }, 300);
        return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
    }, [query]);

    const handleSearch = async (e) => {
        e.preventDefault();
        setPredictions([]);
        if (!query.trim()) { setResults([]); return; }
        setLoadingSearch(true);
        try {
            const data = await tmdbApi.get('search/multi', { query });
            setResults(data.results.filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path));
        } catch (error) { console.error(error); } finally { setLoadingSearch(false); }
    };

    // --- 3. LÓGICA DE CONVITE ---
    const handleOpenInvite = async (e, movie) => {
        e.stopPropagation();
        setMovieToInvite(movie);
        setShowInviteModal(true);
        setInviteSentTo(null);
        
        if (friends.length === 0 && userData?.seguindo?.length > 0) {
            setLoadingFriends(true);
            try {
                const friendsToFetch = userData.seguindo.slice(0, 10);
                const friendsSnap = await db.collection('users')
                    .where(firebase.firestore.FieldPath.documentId(), 'in', friendsToFetch)
                    .get();
                
                const friendsList = friendsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setFriends(friendsList);
            } catch (error) {
                console.error("Erro ao buscar amigos:", error);
            } finally {
                setLoadingFriends(false);
            }
        }
    };

    const sendInvite = async (friendId) => {
        if (!currentUser) return;
        
        const batch = db.batch();
        try {
            const sortedIds = [currentUser.uid, friendId].sort();
            const conversationId = sortedIds.join('_');
            const convoRef = db.collection("conversations").doc(conversationId);
            const msgRef = convoRef.collection("messages").doc();
            
            // Prepara os dados dos participantes para a conversa
            const friendData = friends.find(f => f.id === friendId);
            const participantsInfo = {
                [currentUser.uid]: {
                    nome: userData.nome || "Usuário",
                    foto: userData.foto || ""
                },
                [friendId]: {
                    nome: friendData?.nome || "Cinéfilo",
                    foto: friendData?.foto || ""
                }
            };

            // Objeto da mensagem que vai para a subcoleção 'messages'
            const messageData = {
                senderId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'movie_invite',
                movie: {
                    id: movieToInvite.id,
                    title: movieToInvite.title || movieToInvite.name, // Garante que pegue o título de filme ou série
                    poster_path: movieToInvite.poster_path,
                    mediaType: movieToInvite.media_type || 'movie' // Garante o mediaType
                },
                text: `${userData.nome || 'Alguém'} te convidou para assistir!`
            };
            
            // Objeto simplificado para o campo 'lastMessage' na conversa principal
            const lastMessageData = { ...messageData };
            delete lastMessageData.timestamp; // Remove o timestamp complexo

            batch.set(msgRef, messageData);
            batch.set(convoRef, {
                lastMessage: lastMessageData, // <--- USA O OBJETO SIMPLIFICADO
                participantInfo: participantsInfo, // Adiciona/Atualiza os dados dos participantes
                lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                participants: sortedIds,
            }, { merge: true });

            // ATUALIZAÇÃO EXPLÍCITA: Garante que a conversa seja "desarquivada" para ambos os usuários.
            batch.update(convoRef, {
                [`deletedBy.${currentUser.uid}`]: false,
                [`deletedBy.${friendId}`]: false
            });

            await batch.commit();
            setInviteSentTo(friendId);
            setTimeout(() => {
                setInviteSentTo(null);
                setShowInviteModal(false);
            }, 1500);

        } catch (error) {
            console.error("Erro ao enviar convite:", error);
        }
    };

    const isSearching = query.trim().length > 0;

    return (
        <div className="min-h-screen text-white relative bg-gray-900">
            {/* Background Atmosphere */}
            <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/30 via-gray-900/50 to-gray-900 -z-10 pointer-events-none" />

            <div className="container mx-auto px-4 pb-24 pt-4 max-w-7xl">
                
                {/* --- BARRA DE BUSCA (STICKY) --- */}
                {/* Adicionado 'sticky', 'z-40' e 'backdrop-blur' para não esconder conteúdo */}
                <div className="sticky top-4 z-40 mb-8 flex flex-col items-center">
                    <form onSubmit={handleSearch} className="w-full max-w-4xl relative group">
                        {/* Glow Effect */}
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                        
                        <div className="relative flex items-center bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl">
                            <span className="pl-4 text-gray-400"><SearchIcon className="w-5 h-5"/></span>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); }}
                                placeholder="Pesquise filmes, séries..."
                                className="w-full bg-transparent border-none text-white placeholder-gray-500 px-4 py-4 focus:outline-none text-lg"
                            />
                            {loadingSearch && <div className="pr-4"><Spinner size="sm" /></div>}
                        </div>

                        {/* Dropdown de Predições (Z-Index alto para ficar acima de tudo) */}
                        {predictions.length > 0 && (
                             <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                                {predictions.map(item => (
                                    <div key={item.id} onClick={() => navigate(`/detail/${item.media_type}/${item.id}`)} className="flex items-center p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700/50 last:border-0">
                                        <img src={item.poster_path ? `${TMDB_IMAGE_URL.replace('original', 'w92')}${item.poster_path}` : 'https://via.placeholder.com/40'} alt="" className="w-10 h-14 object-cover rounded mr-3 shadow-sm"/>
                                        <div className="text-sm">
                                            <p className="font-bold text-gray-200 text-base">{item.title || item.name}</p>
                                            <p className="text-xs text-gray-400 mt-1">{item.media_type === 'movie' ? 'Filme' : 'Série'} • {item.release_date?.split('-')[0]}</p>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        )}
                    </form>
                </div>

                {/* --- MODO BUSCA ATIVA --- */}
                {isSearching ? (
                    <div className="animate-fade-in pt-4">
                        <h3 className="text-lg font-semibold mb-6 text-gray-300 border-b border-gray-800 pb-2">Resultados para "{query}"</h3>
                        {results.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {results.map(item => (
                                    <div key={item.id} onClick={() => navigate(`/detail/${item.media_type}/${item.id}`)} className="cursor-pointer transform transition-transform hover:scale-[1.02]">
                                        <ContentCard content={item} mediaType={item.media_type} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            !loadingSearch && <p className="text-center text-gray-500 py-20 text-lg">Nenhum resultado encontrado.</p>
                        )}
                    </div>
                ) : (
                    /* --- MODO EXPLORAÇÃO (ABAS) --- */
                    <div className="animate-fade-in">
                        <div className="flex justify-center pb-6 mb-6">
                            <div className="bg-gray-900/50 p-2 rounded-full flex items-center gap-2 border border-gray-700/50 shadow-inner">
                                {TABS.map(tab => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`
                                                relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 ease-in-out
                                                ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}
                                            `}
                                        >
                                            {isActive && (
                                                <div className={`absolute -inset-0.5 bg-gradient-to-r ${tab.gradient} rounded-full blur opacity-60 animate-pulse`}></div>
                                            )}
                                            <div className={`relative z-10 flex items-center gap-2 ${isActive ? '' : 'opacity-70'}`}>
                                                {tab.icon}
                                                <span className="font-bold text-sm hidden sm:inline">{tab.name}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Conteúdo da Aba */}
                        <div className="min-h-[300px] mt-4">
                            {loadingContent ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {Array.from({ length: 10 }).map((_, i) => <ContentCardSkeleton key={i} />)}
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-6 px-1">
                                        <h2 className={`text-2xl font-bold flex items-center gap-2 ${TABS.find(t => t.id === activeTab)?.color}`}>
                                            {activeTab === 'now_playing' ? 'Hoje nos Cinemas' : `Destaques ${TABS.find(t => t.id === activeTab)?.name}`}
                                        </h2>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                                        {tabContent.map(item => (
                                            <div key={item.id} className="relative group cursor-pointer" onClick={() => navigate(`/detail/movie/${item.id}`)}>
                                                {/* Wrapper do Card para garantir contexto de empilhamento */}
                                                <div className="relative z-10">
                                                    <ContentCard content={item} mediaType="movie" />
                                                </div>
                                                
                                                {/* BOTÃO DE CONVITE (Refatorado para ficar SOBRE o poster) */}
                                                {activeTab === 'now_playing' && (
                                                    <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none group-hover:pointer-events-auto bg-gradient-to-t from-black/90 via-black/40 to-transparent rounded-lg">
                                                        <button 
                                                            onClick={(e) => handleOpenInvite(e, item)}
                                                            className="w-[90%] bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold text-xs py-2.5 rounded-xl shadow-lg shadow-yellow-500/30 flex items-center justify-center gap-2 transform transition-transform active:scale-95"
                                                        >
                                                            <TicketIcon className="w-4 h-4" />
                                                            CHAMAR
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* --- MODAL DE CONVITE (Z-Index Máximo) --- */}
                {showInviteModal && movieToInvite && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowInviteModal(false)}>
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                            
                            <div className="bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <TicketIcon className="w-5 h-5 text-yellow-500" />
                                    Vamos ao Cinema?
                                </h3>
                                <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-white bg-gray-800 p-1 rounded-full hover:bg-gray-700 transition-colors"><CloseIcon className="w-5 h-5" /></button>
                            </div>

                            <div className="p-5">
                                <div className="flex items-center gap-4 mb-6 bg-gray-700/30 p-3 rounded-xl border border-gray-700/50">
                                    <img src={`${TMDB_IMAGE_URL.replace('original', 'w92')}${movieToInvite.poster_path}`} alt="" className="w-12 h-16 rounded-lg object-cover shadow-md" />
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Convite para:</p>
                                        <p className="font-bold text-white text-base leading-tight line-clamp-2">{movieToInvite.title}</p>
                                    </div>
                                </div>

                                <p className="text-gray-300 text-sm mb-3 font-medium">Quem você quer chamar?</p>
                                
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {loadingFriends && (
                                        <div className="text-center py-8"><Spinner size="sm"/></div>
                                    )}

                                    {!loadingFriends && friends.length > 0 && (
                                        friends.map(friend => {
                                            const isSent = inviteSentTo === friend.id;
                                            return (
                                                <button 
                                                    key={friend.id}
                                                    onClick={() => !isSent && sendInvite(friend.id)}
                                                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 border ${isSent ? 'bg-green-900/30 border-green-500/50' : 'bg-gray-700/50 border-transparent hover:bg-gray-700 hover:border-gray-600'}`}
                                                >
                                                    <div className="flex items-center gap-3" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${friend.id}`); }}>
                                                        <img src={getAvatarUrl(friend.foto, friend.nome)} alt={friend.nome} className="w-10 h-10 rounded-full object-cover border border-gray-500"/>
                                                        <div className="text-left">
                                                            <span className="block text-sm font-bold text-gray-200 truncate max-w-[140px]">{friend.nome || 'Usuário'}</span>
                                                            <span className="block text-xs text-gray-400">@{friend.username || 'cinefilo'}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    {isSent ? (
                                                        <div className="flex items-center gap-1 text-green-400 bg-green-900/40 px-2 py-1 rounded-lg">
                                                            <span className="text-xs font-bold">Enviado</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-gray-400 bg-gray-700 p-2 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                            <PaperAirplaneIcon className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                </button>
                                            )
                                        })
                                    )}

                                    {!loadingFriends && friends.length === 0 && (
                                        <div className="text-center py-8 px-4 bg-gray-700/20 rounded-xl border border-dashed border-gray-700">
                                            <p className="text-gray-400 mb-1">Sua lista de amigos está vazia.</p>
                                            <p className="text-xs text-gray-500 mb-4">Siga pessoas para convidá-las.</p>
                                            <button onClick={() => { setShowInviteModal(false); navigate('/friends'); }} className="text-indigo-400 text-sm font-bold hover:text-indigo-300 hover:underline">Buscar Cinefilos</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;