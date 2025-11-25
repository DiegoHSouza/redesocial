import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tmdbApi, TMDB_IMAGE_URL } from '../services/tmdbApi';
import ContentCard from '../components/ContentCard';
import ContentCarousel from '../components/ContentCarousel';
import { SearchIcon } from '../components/Icons';
import { Spinner, ContentCardSkeleton } from '../components/Common';

const STREAMING_SERVICES = [
    { id: 8, name: 'Netflix' }, { id: 119, name: 'Prime Video' },
    { id: 337, name: 'Disney+' }, { id: 1899, name: 'Max' }, { id: 350, name: 'Apple TV+' },
];

const SearchPage = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState(null);
    const [suggestionsLoading, setSuggestionsLoading] = useState(true);
    const debounceTimeoutRef = useRef(null);

    // Carrega sugestões (filmes populares dos streamings)
    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                const promises = STREAMING_SERVICES.map(service => 
                    tmdbApi.discoverContent('movie', service.id, 1, null, 'popularity.desc')
                );
                const results = await Promise.all(promises);
                const suggestionsData = STREAMING_SERVICES.reduce((acc, service, index) => {
                    acc[service.name] = results[index].results;
                    return acc;
                }, {});
                setSuggestions(suggestionsData);
            } catch (error) {
                console.error("Falha ao buscar sugestões:", error);
            } finally {
                setSuggestionsLoading(false);
            }
        };
        fetchSuggestions();
    }, []);

    // Busca preditiva enquanto digita
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
        return () => {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        };
    }, [query]);

    const handleSearch = async (e) => {
        e.preventDefault();
        setPredictions([]);
        if (!query.trim()) {
            setResults([]);
            return;
        }
        setLoading(true);
        setResults([]);
        try {
            const data = await tmdbApi.get('search/multi', { query });
            setResults(data.results.filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path));
        } catch (error) {
            console.error("Falha na busca:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePredictionClick = (item) => {
        navigate(`/detail/${item.media_type}/${item.id}`);
    }

    const showSuggestions = !query.trim() && results.length === 0;

    return (
        <div className="container mx-auto text-white px-0 sm:px-4">
            <div className="p-2 md:p-8">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 pl-2 md:pl-0">Buscar</h2>
                <form
                    onSubmit={handleSearch}
                    className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 mb-6 md:mb-8 sticky top-[60px] md:static bg-gray-900 py-2 md:py-4 z-40 -mx-2 px-2 md:mx-0 md:px-0"
                >
                    <div className="relative flex-grow">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2 md:pl-3">
                            <SearchIcon className="w-5 h-5 text-gray-400"/>
                        </span>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); if (!e.target.value.trim()) setResults([]); }}
                            placeholder="Buscar por filmes ou séries..."
                            className="pl-9 md:pl-10 w-full px-3 md:px-4 py-2 md:py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoComplete="off"
                        />
                        {predictions.length > 0 && (
                            <div className="absolute top-full mt-1 md:mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                                {predictions.map(item => (
                                    <div 
                                        key={item.id}
                                        onClick={() => handlePredictionClick(item)}
                                        className="flex items-center p-2 md:p-3 cursor-pointer hover:bg-gray-700 transition-colors"
                                    >
                                        <img
                                            src={item.poster_path ? `${TMDB_IMAGE_URL}${item.poster_path}`: 'https://via.placeholder.com/40x56'}
                                            alt={item.title || item.name}
                                            className="w-8 h-12 md:w-10 md:h-14 object-cover rounded-md mr-3 md:mr-4"
                                        />
                                        <div className="flex-1">
                                            <p className="font-semibold text-white text-sm md:text-base">{item.title || item.name}</p>
                                            <p className="text-xs md:text-sm text-gray-400">{item.media_type === 'movie' ? 'Filme' : 'Série'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg text-sm md:text-base transition-opacity hover:opacity-90"
                    >
                        {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>
    
                <div>
                    {loading && <Spinner />}

                    {!loading && !showSuggestions && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2 md:gap-x-4 gap-y-4 md:gap-y-8">
                            {results.map(item => (
                                <div className="w-full" key={item.id}>
                                    {/* For mobile, wrap ContentCard to control width */}
                                    <ContentCard content={item} mediaType={item.media_type} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showSuggestions && (
                <div className="space-y-3 md:space-y-4">
                    {suggestionsLoading ? (
                        <div className="space-y-6 md:space-y-8">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i}>
                                    <div className="h-6 md:h-8 bg-gray-700/50 rounded w-1/2 md:w-1/3 mb-3 md:mb-4 ml-2 md:ml-0"></div>
                                    <div className="flex space-x-2 md:space-x-4 overflow-x-auto pl-2 md:pl-0">
                                        {Array.from({ length: 5 }).map((_, j) => (
                                            <div key={j} className="w-24 md:w-48 flex-shrink-0"><ContentCardSkeleton /></div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        suggestions && Object.entries(suggestions).map(([serviceName, content]) => (
                            content && content.length > 0 && (
                                <div key={serviceName} className="px-0 md:px-0">
                                    {/* For mobile, ContentCarousel should be horizontally scrollable and more compact */}
                                    <ContentCarousel
                                        title={serviceName}
                                        content={content}
                                        cardClassName="w-24 md:w-48"
                                        titleClassName="text-base md:text-xl pl-2 md:pl-0"
                                    />
                                </div>
                            )
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchPage;