import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { tmdbApi } from '../services/tmdbApi';
import ContentCard from '../components/ContentCard';
import { Spinner, ErrorMessage, ContentCardSkeleton } from '../components/Common';
import { ChevronDownIcon } from '../components/Icons';

const StreamingCatalogPage = () => {
    const { serviceId } = useParams();
    const [searchParams] = useSearchParams();
    const serviceName = searchParams.get('name') || 'Catálogo';
    const navigate = useNavigate();

    const [content, setContent] = useState([]);
    const [genres, setGenres] = useState([]);
    const [selectedGenre, setSelectedGenre] = useState(null);
    const [mediaType, setMediaType] = useState('movie');
    const [sortBy, setSortBy] = useState('popularity.desc');
    
    const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');

    const sortOptions = [
        { label: 'Popularidade', value: 'popularity.desc' },
        { label: 'Maior Nota', value: 'vote_average.desc' },
        { label: 'Menor Nota', value: 'vote_average.asc' },
        { label: 'Mais Recentes', value: 'release_date.desc' },
    ];

    const observer = useRef();
    const lastContentElementRef = useCallback(node => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && page < totalPages) {
                setPage(prevPage => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, page, totalPages]);

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const data = await tmdbApi.getGenres(mediaType);
                setGenres(data.genres);
            } catch (err) {
                console.error(`Não foi possível carregar os gêneros de ${mediaType}.`);
            }
        };
        fetchGenres();
    }, [mediaType]);

    // Reset quando filtros mudam
    useEffect(() => {
        setPage(1);
        setContent([]);
        setLoading(true);
    }, [serviceId, mediaType, selectedGenre, sortBy]);

    useEffect(() => {
        const fetchContent = async () => {
            if (page === 1) setLoading(true);
            else setLoadingMore(true);
            setError('');
            
            try {
                let finalSortBy = sortBy;
                if (sortBy === 'release_date.desc') {
                    finalSortBy = mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
                }
                
                // Tratamento especial para "todos"
                const providerId = serviceId.includes('|') ? serviceId : serviceId;

                const data = await tmdbApi.discoverContent(mediaType, providerId, page, selectedGenre?.id, finalSortBy);
                
                setContent(prevContent => page === 1 ? data.results : [...prevContent, ...data.results]);
                setTotalPages(data.total_pages);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        };
        fetchContent();
    }, [serviceId, page, selectedGenre, mediaType, sortBy]);

    const handleGenreSelect = (genre) => {
        setSelectedGenre(genre);
        setIsGenreDropdownOpen(false);
    };

    const handleSortSelect = (sortValue) => {
        setSortBy(sortValue);
        setIsSortDropdownOpen(false);
    };

    return (
        <div className="container mx-auto p-4 md:p-8 text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Catálogo: <span className="text-indigo-400">{serviceName}</span></h2>
            
            <div className="flex flex-col md:flex-row md:items-center md:space-x-4 mb-6">
                <div className="flex space-x-2 bg-gray-800 p-1 rounded-lg mb-4 md:mb-0">
                    <button onClick={() => setMediaType('movie')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors w-full ${mediaType === 'movie' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}>
                        Filmes
                    </button>
                    <button onClick={() => setMediaType('tv')} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors w-full ${mediaType === 'tv' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}>
                        Séries
                    </button>
                </div>
                
                <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                    <div className="relative">
                        <button onClick={() => setIsGenreDropdownOpen(!isGenreDropdownOpen)} className="flex items-center justify-between w-full md:w-auto bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors text-sm">
                            <span>{selectedGenre ? selectedGenre.name : 'Todos os Gêneros'}</span>
                            <ChevronDownIcon className={`w-5 h-5 ml-2 transition-transform ${isGenreDropdownOpen ? 'transform rotate-180' : ''}`} />
                        </button>
                        {isGenreDropdownOpen && (
                            <div className="absolute z-20 mt-2 w-full md:w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                <button onClick={() => handleGenreSelect(null)} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-indigo-600 hover:text-white">Todos os Gêneros</button>
                                {genres.map(genre => (
                                    <button key={genre.id} onClick={() => handleGenreSelect(genre)} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-indigo-600 hover:text-white">{genre.name}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <button onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)} className="flex items-center justify-between w-full md:w-auto bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors text-sm">
                            <span>{sortOptions.find(o => o.value === sortBy)?.label || 'Ordenar por'}</span>
                            <ChevronDownIcon className={`w-5 h-5 ml-2 transition-transform ${isSortDropdownOpen ? 'transform rotate-180' : ''}`} />
                        </button>
                        {isSortDropdownOpen && (
                            <div className="absolute z-20 mt-2 w-full md:w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {sortOptions.map(option => (
                                    <button key={option.value} onClick={() => handleSortSelect(option.value)} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-indigo-600 hover:text-white">{option.label}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        
            {loading && content.length === 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {Array.from({ length: 10 }).map((_, i) => <ContentCardSkeleton key={i} />)}
                </div>
            )}
        
            {error && <ErrorMessage message={error} />}
        
            {content.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
                    {content.map((item, index) => {
                        const isLastElement = content.length === index + 1;
                        return (
                            <div ref={isLastElement ? lastContentElementRef : null} key={item.id}>
                                <ContentCard content={item} mediaType={mediaType} />
                            </div>
                        );
                    })}
                </div>
            ) : (
                !loading && <p className="text-gray-400 text-center py-10">Nenhum conteúdo encontrado para esta seleção.</p>
            )}
        
            {loadingMore && <Spinner />}
        </div>
    );
};

export default StreamingCatalogPage;