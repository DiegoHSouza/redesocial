import React, { useState, useEffect } from 'react';
import { tmdbApi } from '../services/tmdbApi';
import { Spinner } from './Common';
import { DiceIcon, CloseIcon, ChevronDownIcon } from './Icons';
import ContentCard from './ContentCard';
import ConfirmModal from './ConfirmModal'; 
import { useAuth } from '../contexts/AuthContext';
import { awardXP } from '../utils/gamification'; // Mantido conforme seu snippet
import { useNavigate } from 'react-router-dom';

const STREAMING_SERVICES = [
    { id: 8, name: 'Netflix' }, { id: 119, name: 'Prime Video' },
    { id: 337, name: 'Disney+' }, { id: 1899, name: 'Max' }, { id: 350, name: 'Apple TV+' },
];

// ALTERAÇÃO: Recebendo onSpin como prop para comunicar com a HomePage
const RandomPicker = ({ onSpin }) => {
    const [genres, setGenres] = useState([]);
    const [selectedService, setSelectedService] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('');
    const [mediaType, setMediaType] = useState('movie');
    
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    
    const { currentUser } = useAuth(); 
    
    // Estados de Modal
    const [showResultModal, setShowResultModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const data = await tmdbApi.getGenres(mediaType);
                setGenres(data.genres);
            } catch (error) { console.error(error); }
        };
        fetchGenres();
    }, [mediaType]);

    const fetchRandomItem = async () => {
        let type = mediaType;
        let service = selectedService;
        let genre = selectedGenre;

        if (!selectedService && !selectedGenre) {
            type = Math.random() < 0.5 ? 'movie' : 'tv';
            const allServices = ['', ...STREAMING_SERVICES.map(s => s.id)];
            service = allServices[Math.floor(Math.random() * allServices.length)];
            genre = '';
        }

        const initialData = await tmdbApi.discoverContent(type, service || null, 1, genre || null);

        if (!initialData.results || initialData.results.length === 0) {
            return null; 
        }

        const totalPages = initialData.total_pages;
        const maxPage = Math.min(totalPages, 100);
        const randomPage = Math.floor(Math.random() * maxPage) + 1;

        const finalData = await tmdbApi.discoverContent(type, service || null, randomPage, genre || null);
        let items = finalData.results.filter(item => item.poster_path);

        // Fallback para página 1 se a aleatória estiver vazia
        if (items.length === 0 && totalPages > 0) {
            console.log("Página aleatória vazia. Tentando resgate na página 1...");
            const rescueData = await tmdbApi.discoverContent(type, service || null, 1, genre || null);
            items = rescueData.results.filter(item => item.poster_path);
        }

        if (items.length > 0) {
            if (!selectedService && !selectedGenre && type !== mediaType) {
                setMediaType(type);
            }
            return items[Math.floor(Math.random() * items.length)];
        }
        
        return null;
    };

    const handleSpin = async () => {
        setLoading(true);
        setResult(null);
        
        try {
            const randomItem = await fetchRandomItem();
            
            if (randomItem) {
                setResult(randomItem);
                setShowResultModal(true);
                
                // 1. Chama a função do Pai (HomePage) para registrar no Backend
                if (onSpin) {
                    onSpin();
                }

                // 2. Mantém sua lógica local de XP (caso use para UI imediata)
                if (currentUser) {
                    awardXP(currentUser.uid, 'USE_RANDOM_PICKER');
                }
            } else {
                setShowErrorModal(true);
            }

        } catch (error) {
            console.error("Erro ao sortear:", error);
            setShowErrorModal(true);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigateToDetails = (item, event) => {
        if (event) event.stopPropagation();
        const type = item.media_type || mediaType;
        navigate(`/detail/${type}/${item.id}`);
    };

    return (
        <div className="w-full max-w-4xl mx-auto mb-12">
            <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-2xl p-6 md:p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
                
                <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                    <DiceIcon className="w-8 h-8 text-indigo-400" />
                    Não sabe o que assistir?
                </h3>
                <p className="text-gray-300 mb-6 text-sm">Deixe o destino (e nossa IA) escolherem para você.</p>

                <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-6">
                    <div className="bg-gray-800/80 rounded-lg p-1 flex">
                        <button 
                            onClick={() => setMediaType('movie')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mediaType === 'movie' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Filmes
                        </button>
                        <button 
                            onClick={() => setMediaType('tv')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mediaType === 'tv' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Séries
                        </button>
                    </div>

                    <div className="relative w-full md:w-48">
                        <select 
                            value={selectedService} 
                            onChange={(e) => setSelectedService(e.target.value)}
                            className="w-full appearance-none bg-gray-800 border border-gray-600 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="">Todas as Plataformas</option>
                            {STREAMING_SERVICES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <ChevronDownIcon className="w-4 h-4 absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                    </div>

                    <div className="relative w-full md:w-48">
                        <select 
                            value={selectedGenre} 
                            onChange={(e) => setSelectedGenre(e.target.value)}
                            className="w-full appearance-none bg-gray-800 border border-gray-600 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="">Todos os Gêneros</option>
                            {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <ChevronDownIcon className="w-4 h-4 absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <button 
                    onClick={handleSpin} 
                    disabled={loading}
                    className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold py-3 px-8 rounded-full shadow-lg shadow-indigo-900/50 transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                    {loading ? <Spinner /> : (
                        <>
                            <DiceIcon className="w-5 h-5" />
                            Sortear Agora
                        </>
                    )}
                </button>
            </div>

            {/* Modal de Resultado (Sucesso) */}
            {showResultModal && result && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowResultModal(false)}>
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl max-w-sm w-full relative flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowResultModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                        
                        <h4 className="text-lg font-semibold text-gray-300 mb-4">O destino escolheu:</h4>
                        
                        <div className="w-48 mb-6 transform hover:scale-105 transition-transform duration-300">
                            <ContentCard
                                content={result}
                                mediaType={mediaType}
                                onClick={(e) => handleNavigateToDetails(result, e)}
                            />
                        </div>

                        <div className="flex gap-3 w-full">
                            <button onClick={handleSpin} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-medium transition-colors">
                                Tentar Outro
                            </button>
                            <button 
                                onClick={(e) => handleNavigateToDetails(result, e)} 
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold transition-colors"
                            >
                                Ver Detalhes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Erro */}
            <ConfirmModal 
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                title="Nada Encontrado"
                message="Não encontramos nenhum conteúdo com esses filtros exatos. Tente mudar a plataforma ou o gênero!"
                confirmText="Entendi"
                showCancel={false} 
            />
        </div>
    );
};

export default RandomPicker;