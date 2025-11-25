import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Common';
import { SearchIcon } from '../components/Icons';
import { getAvatarUrl } from '../components/Common'; // <--- IMPORTADO

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
                    const friendPromises = userData.seguindo.slice(0, 10).map(uid => db.collection("users").doc(uid).get());
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

    return (
        <div className="container mx-auto p-4 md:p-8 text-white">
            <h2 className="text-3xl font-bold mb-6 text-center text-shadow">Descobrir Pessoas</h2>
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-8 max-w-lg mx-auto relative">
                <div className="relative flex-grow">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <SearchIcon className="w-5 h-5 text-gray-400"/>
                    </span>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nome..."
                        className="w-full pl-10 pr-4 py-3 bg-gray-900/70 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100"
                    />
                    {predictions.length > 0 && (
                        <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                            {predictions.map(user => (
                                <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="flex items-center p-3 cursor-pointer hover:bg-gray-700 transition-colors">
                                    {/* CORREÇÃO AQUI */}
                                    <img 
                                        src={getAvatarUrl(user.foto, user.nome)} 
                                        alt={user.nome} 
                                        className="w-10 h-10 object-cover rounded-full mr-4"
                                        onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, user.nome); }}
                                    />
                                    <div>
                                        <p className="font-semibold text-white">{user.nome} {user.sobrenome}</p>
                                        <p className="text-sm text-gray-400">@{user.username}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button type="submit" className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-opacity hover:opacity-90">
                    {loading ? '...' : 'Buscar'}
                </button>
            </form>

            {loading ? <Spinner /> : results.length > 0 && (
                <div className="mb-12">
                    <h3 className="text-xl font-bold mb-4 text-center">Resultados</h3>
                    <div className="space-y-4 max-w-md mx-auto">
                        {results.map(user => (
                            <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="bg-gray-800/50 p-3 rounded-lg flex items-center space-x-4 cursor-pointer hover:bg-gray-800 transition-colors">
                                {/* CORREÇÃO AQUI */}
                                <img 
                                    src={getAvatarUrl(user.foto, user.nome)} 
                                    alt={user.nome} 
                                    className="w-12 h-12 rounded-full object-cover"
                                    onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, user.nome); }}
                                />
                                <div>
                                    <p className="font-bold">{user.nome} {user.sobrenome}</p>
                                    <p className="text-sm text-gray-400">{user.bio}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-8">
                <h3 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2 max-w-lg mx-auto">Quem eu sigo</h3>
                {friendsLoading ? <Spinner /> : friends.length > 0 ? (
                    <div className="space-y-4 max-w-md mx-auto">
                        {friends.map(user => (
                            <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} className="bg-gray-800/50 p-3 rounded-lg flex items-center space-x-4 cursor-pointer hover:bg-gray-800 transition-colors">
                                {/* CORREÇÃO AQUI */}
                                <img 
                                    src={getAvatarUrl(user.foto, user.nome)} 
                                    alt={user.nome} 
                                    className="w-12 h-12 rounded-full object-cover"
                                    onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, user.nome); }}
                                />
                                <div>
                                    <p className="font-bold">{user.nome} {user.sobrenome}</p>
                                    <p className="text-sm text-gray-400">{user.bio}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-gray-400 text-center">Você ainda não segue ninguém.</p>}
            </div>
        </div>
    );
};

export default FindFriendsPage;