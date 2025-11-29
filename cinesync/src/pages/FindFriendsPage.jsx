import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Common';
import { SearchIcon } from '../components/Icons';
import { getAvatarUrl } from '../components/Common';

const FindFriendsPage = () => {
    const navigate = useNavigate();
    const { userData, currentUser } = useAuth();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [friends, setFriends] = useState([]);
    const [friendsLoading, setFriendsLoading] = useState(true);
    const debounceTimeoutRef = useRef(null);

    // Carrega amigos que já sigo
    useEffect(() => {
        const fetchFriends = async () => {
            if (userData && userData.seguindo && userData.seguindo.length > 0) {
                try {
                    // Otimização: Aumentei o limit para mostrar mais amigos já que agora ocupa a tela principal
                    const friendPromises = userData.seguindo.slice(0, 20).map(uid => db.collection("users").doc(uid).get());
                    const friendDocs = await Promise.all(friendPromises);
                    const friendsData = friendDocs
                        .filter(doc => doc.exists)
                        .map(doc => ({ id: doc.id, ...doc.data() }));
                    setFriends(friendsData);
                } catch (error) {
                    console.error("Erro ao buscar amigos:", error);
                }
            } else {
                setFriends([]);
            }
            setFriendsLoading(false);
        };
        if (userData) fetchFriends();
        else setFriendsLoading(false);
    }, [userData]);

    // Busca preditiva
    useEffect(() => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        if (query.trim() === "") {
            setPredictions([]);
            setResults([]); // Limpa resultados se a query for limpa
            return;
        }
        debounceTimeoutRef.current = setTimeout(async () => {
            const searchQuery = query.trim().toLowerCase();
            const nameQuery = db.collection("users")
                .where("nome_completo_lowercase", ">=", searchQuery)
                .where("nome_completo_lowercase", "<=", searchQuery + '\uf8ff')
                .limit(5);
            
            try {
                const snapshot = await nameQuery.get();
                const users = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(user => user.id !== currentUser?.uid);
                setPredictions(users);
            } catch (error) {
                console.error("Erro ao buscar predições:", error);
            }
        }, 300);
    }, [query, currentUser]);

    const handleSearch = async (e) => {
        e.preventDefault();
        setPredictions([]);
        if (!query.trim()) { setResults([]); return; }
        
        setLoading(true);
        const searchQuery = query.trim().toLowerCase();
        try {
            const snapshot = await db.collection("users")
                .where("nome_completo_lowercase", ">=", searchQuery)
                .where("nome_completo_lowercase", "<=", searchQuery + '\uf8ff')
                .get();
            
            const users = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(user => user.id !== currentUser?.uid);
            setResults(users);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Função auxiliar para renderizar itens de usuário (evita repetição de código)
    const UserListItem = ({ user }) => (
        <div onClick={() => navigate(`/profile/${user.id}`)} className="bg-gray-800/50 p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:bg-gray-800 transition-colors border border-gray-700/50 hover:border-indigo-500/30">
            <img 
                src={getAvatarUrl(user.foto, user.nome)} 
                alt={user.nome} 
                className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-700"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getAvatarUrl(null, user.nome); }}
            />
            <div className="flex-grow min-w-0"> {/* min-w-0 ajuda com truncamento de texto */}
                <p className="font-bold text-white truncate">{user.nome} {user.sobrenome}</p>
                <p className="text-sm text-gray-400 truncate">{user.bio || `@${user.username}`}</p>
            </div>
        </div>
    );

    return (
        <div className="h-screen flex flex-col text-white bg-gray-900">
            {/* Cabeçalho Fixo */}
            <header className="flex-shrink-0 py-3 md:py-4 px-4 md:px-6 shadow-lg bg-gray-900/95 backdrop-blur-sm z-30 border-b border-gray-800">
                <h2 className="text-xl md:text-2xl font-bold mb-3 text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                    Descobrir Pessoas
                </h2>
                <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl mx-auto relative w-full">
                    <div className="relative flex-grow">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-gray-400"/>
                        </span>
                        <input
                            type="text"
                            name="find-friends-query"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar por nome..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100 transition-all"
                            autoComplete="off"
                        />
                        {predictions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-40 overflow-hidden max-h-64 overflow-y-auto">
                                {predictions.map(user => (
                                    <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="flex items-center p-3 cursor-pointer hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0">
                                        <img 
                                            src={getAvatarUrl(user.foto, user.nome)} 
                                            alt={user.nome} 
                                            className="w-8 h-8 object-cover rounded-full mr-3"
                                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src=getAvatarUrl(null, user.nome); }}
                                        />
                                        <div>
                                            <p className="font-semibold text-white text-sm">{user.nome} {user.sobrenome}</p>
                                            <p className="text-xs text-gray-400">@{user.username}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button type="submit" className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
                        {loading ? <Spinner size="sm" /> : 'Buscar'}
                    </button>
                </form>
            </header>

            {/* Conteúdo Principal Unificado */}
            <main className="flex-grow overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                <div className="max-w-2xl mx-auto pb-6">
                    
                    {/* ESTADO 1: Carregando Busca */}
                    {loading && (
                        <div className="flex justify-center mt-10">
                            <Spinner />
                        </div>
                    )}

                    {/* ESTADO 2: Exibindo Resultados da Busca */}
                    {!loading && results.length > 0 && (
                        <div className="animate-fade-in">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300">Resultados da busca</h3>
                            <div className="space-y-3">
                                {results.map(user => <UserListItem key={user.id} user={user} />)}
                            </div>
                        </div>
                    )}

                    {/* ESTADO 3: Sem busca (Estado Padrão - Lista de Amigos) */}
                    {!loading && results.length === 0 && query.trim() === "" && (
                        <div className="animate-fade-in">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300 flex items-center gap-2">
                                <span>Quem eu sigo</span>
                                <span className="text-xs bg-gray-800 text-gray-400 py-0.5 px-2 rounded-full border border-gray-700">
                                    {friends.length}
                                </span>
                            </h3>

                            {friendsLoading ? (
                                <div className="flex justify-center py-10">
                                    <Spinner />
                                </div>
                            ) : friends.length > 0 ? (
                                <div className="space-y-3">
                                    {friends.map(user => <UserListItem key={user.id} user={user} />)}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                                    <p className="text-gray-400 mb-2">Você ainda não segue ninguém.</p>
                                    <p className="text-sm text-gray-500">Use a busca acima para encontrar amigos!</p>
                                </div>
                            )}
                        </div>
                    )}

                     {/* ESTADO 4: Busca sem resultados */}
                     {!loading && results.length === 0 && query.trim() !== "" && (
                        <div className="text-center mt-10">
                            <p className="text-gray-400">Nenhum usuário encontrado para "{query}".</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default FindFriendsPage;