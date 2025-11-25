import React, { useState, useEffect, useRef } from 'react';
import { tmdbApi, TMDB_IMAGE_URL } from '../services/tmdbApi';
import { SearchIcon, CloseIcon } from './Icons';
import { Spinner } from './Common';

const ContentSearchModal = ({ onSelectMedia, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const debounceTimeoutRef = useRef(null);

    useEffect(() => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        if (!query.trim()) {
            setResults([]);
            return;
        }
        
        setLoading(true);
        debounceTimeoutRef.current = setTimeout(async () => {
            try {
                // Busca mista (Filmes e Séries)
                const data = await tmdbApi.get('search/multi', { query });
                const filtered = data.results.filter(item => 
                    (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
                );
                setResults(filtered);
            } catch (error) {
                console.error("Erro na busca:", error);
            } finally {
                setLoading(false);
            }
        }, 500);
    }, [query]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[80] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800/90 backdrop-blur-lg border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Buscar no Catálogo</h3>
                    <button onClick={onClose}><CloseIcon className="w-6 h-6 text-gray-400 hover:text-white"/></button>
                </div>

                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                            <SearchIcon className="w-5 h-5"/>
                        </span>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Digite o nome do filme ou série..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading && <Spinner />}
                    
                    {!loading && results.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                            {results.map(item => (
                                <div 
                                    key={item.id} 
                                    className="cursor-pointer group relative"
                                    onClick={() => onSelectMedia(item)}
                                >
                                    <img 
                                        src={`${TMDB_IMAGE_URL}${item.poster_path}`} 
                                        alt={item.title || item.name}
                                        className="rounded-lg aspect-[2/3] object-cover w-full border-2 border-transparent group-hover:border-indigo-500 transition-all"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                        <span className="text-white font-bold text-sm text-center px-2">Selecionar</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 truncate">{item.title || item.name}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && query && results.length === 0 && (
                        <p className="text-center text-gray-500 mt-10">Nenhum resultado encontrado.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContentSearchModal;