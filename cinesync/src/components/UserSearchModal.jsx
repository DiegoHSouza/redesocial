import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseConfig';
import { Spinner, getAvatarUrl } from './Common';

const UserSearchModal = ({ onSelectUser, onClose, currentUser }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const debounceTimeoutRef = useRef(null);
    const [allowedIds, setAllowedIds] = useState([]);

    // Buscar seguidores/seguidos do usuário logado
    useEffect(() => {
        if (!currentUser?.uid) return;
        const fetchUserData = async () => {
            try {
                const userDoc = await db.collection("users").doc(currentUser.uid).get();
                const data = userDoc.data() || {};
                const seguindo = data.seguindo || [];
                const seguidores = data.seguidores || [];
                setAllowedIds(Array.from(new Set([...seguindo, ...seguidores])));
            } catch (e) {
                setAllowedIds([]);
            }
        };
        fetchUserData();
    }, [currentUser]);

    useEffect(() => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        if (!query.trim() || allowedIds.length === 0) {
            setResults([]);
            return;
        }
        setLoading(true);
        debounceTimeoutRef.current = setTimeout(async () => {
            const searchQuery = query.trim().toLowerCase();
            let users = [];
            try {
                // Buscar todos os usuários permitidos (seguindo/seguidores)
                const allowedChunks = [];
                // Firestore limita a 10 elementos por 'in' query
                for (let i = 0; i < allowedIds.length; i += 10) {
                    allowedChunks.push(allowedIds.slice(i, i + 10));
                }
                let fetchedUsers = [];
                for (const chunk of allowedChunks) {
                    const snap = await db.collection("users")
                        .where("__name__", "in", chunk)
                        .get();
                    fetchedUsers = fetchedUsers.concat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }
                // Filtrar localmente por nome ou username
                users = fetchedUsers.filter(user => {
                    if (!user) return false;
                    if (user.id === currentUser.uid) return false;
                    const nomeCompleto = ((user.nome || '') + ' ' + (user.sobrenome || '')).trim().toLowerCase();
                    const username = (user.username || '').toLowerCase();
                    if (searchQuery.startsWith('@')) {
                        return username.includes(searchQuery.replace('@', ''));
                    }
                    return nomeCompleto.includes(searchQuery) || username.includes(searchQuery);
                });
                setResults(users);
            } catch (error) {
                console.error("Erro ao buscar usuários:", error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
    }, [query, allowedIds, currentUser.uid]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-start justify-center z-[70] p-4 pt-20 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800/80 backdrop-filter backdrop-blur-lg border border-gray-700 rounded-xl shadow-lg w-full max-w-md text-white max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold mb-2">Iniciar Nova Conversa</h2>
                    <input 
                        type="text" 
                        value={query} 
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar por nome ou @username..." 
                        className="w-full px-4 py-2 bg-gray-900/70 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100 text-sm" 
                        autoFocus
                    />
                </div>
                <div className="p-2 overflow-y-auto">
                    {loading && <Spinner />}
                    {!loading && results.length > 0 && (
                        <div className="space-y-2">
                            {results.map(user => (
                                <div key={user.id} onClick={() => onSelectUser(user)} className="p-3 rounded-lg flex items-center space-x-4 cursor-pointer hover:bg-gray-700 transition-colors">
                                    <img 
                                        src={getAvatarUrl(user.foto, user.nome)} 
                                        alt={user.nome} 
                                        className="w-12 h-12 rounded-full object-cover"
                                        onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, user.nome); }}
                                    />
                                    <div>
                                        <p className="font-bold">{user.nome} {user.sobrenome}</p>
                                        <p className="text-sm text-gray-400">@{user.username}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!loading && query && results.length === 0 && <p className="text-center text-gray-400 p-4">Nenhum usuário encontrado.</p>}
                </div>
            </div>
        </div>
    );
};

export default UserSearchModal;