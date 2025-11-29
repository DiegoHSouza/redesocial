import React, { useState, useEffect, useRef, useCallback } from 'react';
import { tmdbApi, TMDB_IMAGE_URL } from '../services/tmdbApi';
import { SearchIcon, CloseIcon } from './Icons';
import { Spinner } from './Common';

// SECURITY: Define a maximum query length to prevent overly long/abusive API requests.
const MAX_QUERY_LENGTH = 100;

const ContentSearchModal = ({ onSelectMedia, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const debounceTimeoutRef = useRef(null);
    const modalRef = useRef(null);

    useEffect(() => {
        // UX: Trap focus within the modal for keyboard users.
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
            if (e.key === 'Tab' && modalRef.current) {
                const focusableElements = modalRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            setResults([]);
            return;
        }
        
        setLoading(true);
        // PERFORMANCE: Debounce API calls to avoid sending a request on every keystroke,
        // reducing network traffic and improving user experience.
        debounceTimeoutRef.current = setTimeout(async () => {
            try {
                const data = await tmdbApi.get('search/multi', { query: trimmedQuery });
                // ROBUSTNESS: Filter results to include only movies or TV shows that have a poster image,
                // ensuring the UI doesn't display broken or incomplete items.
                const filtered = data.results.filter(item => 
                    (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
                );
                setResults(filtered);
            } catch (error) {
                console.error("Search API error:", error);
                setResults([]); // Clear results on error
            } finally {
                setLoading(false);
            }
        }, 500);
    }, [query]);

    // PERFORMANCE: Use a single, stable callback for all item selections to prevent
    // creating new functions on each render within the loop.
    const handleSelect = useCallback((item) => {
        onSelectMedia(item);
    }, [onSelectMedia]);

    // ROBUSTNESS: Stable image error handler to provide a fallback, preventing broken image icons.
    const handleImageError = useCallback((e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = 'https://via.placeholder.com/500x750?text=No+Image';
    }, []);

    return (
        // ACCESSIBILITY (WCAG): Use role="dialog" and aria-modal="true" to define the modal for screen readers.
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[80] p-4 animate-fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="search-modal-title">
            <div ref={modalRef} className="bg-gray-800/90 backdrop-blur-lg border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 id="search-modal-title" className="text-xl font-bold text-white">Search Catalog</h3>
                    <button onClick={onClose} aria-label="Close search modal"><CloseIcon className="w-6 h-6 text-gray-400 hover:text-white"/></button>
                </div>

                <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                    <div className="relative">
                        <label htmlFor="content-search-input" className="sr-only">Search for a movie or series</label>
                        <SearchIcon className="w-5 h-5 absolute inset-y-0 left-3 my-auto text-gray-500 pointer-events-none"/>
                        <input
                            id="content-search-input"
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Type the name of the movie or series..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                            autoFocus
                            maxLength={MAX_QUERY_LENGTH}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading && <Spinner />}
                    {!loading && results.length > 0 && (
                        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                            {results.map(item => (
                                <li key={item.id}>
                                    <button onClick={() => handleSelect(item)} className="w-full text-left cursor-pointer group relative">
                                        <img 
                                            src={`${TMDB_IMAGE_URL}${item.poster_path}`} 
                                            alt={item.title || item.name}
                                            className="rounded-lg aspect-[2/3] object-cover w-full border-2 border-transparent group-hover:border-indigo-500 transition-all bg-gray-700"
                                            onError={handleImageError}
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                            <span className="text-white font-bold text-sm text-center px-2">Select</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1 truncate group-hover:text-white">{item.title || item.name}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {!loading && query && results.length === 0 && (
                        <p className="text-center text-gray-500 mt-10">No results found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContentSearchModal;