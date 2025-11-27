import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tmdbApi, TMDB_IMAGE_URL } from '../services/tmdbApi';
import { registerRandomPickerXP } from "../utils/gamification"; // <--- AJUSTE O CAMINHO SE NECESSÁRIO
import RandomPicker from '../components/RandomPicker';
import { HeartIcon, DiceIcon, LayoutGridIcon, UsersIcon } from '../components/Icons';

const STREAMING_SERVICES = [
    { id: 8, name: 'Netflix', logo: '/logos/netflix.svg', color: 'shadow-red-500/40' },
    { id: 119, name: 'Prime Video', logo: '/logos/prime.svg', color: 'shadow-cyan-400/40' },
    { id: 337, name: 'Disney+', logo: '/logos/disney.svg', color: 'shadow-blue-500/40' },
    { id: 1899, name: 'Max', logo: '/logos/max.svg', color: 'shadow-purple-500/40' },
    { id: 350, name: 'Apple TV+', logo: '/logos/apple.svg', color: 'shadow-gray-400/40' },
];

const EXPLORE_SERVICES = [
    ...STREAMING_SERVICES,
    { id: 'all', name: 'Todos' }
];

const HomePage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('catalog');

    const handleNavigate = (service) => {
        if (service.id === 'all') {
            const allIds = STREAMING_SERVICES.map(s => s.id).join('|');
            navigate(`/catalog/${allIds}?name=Todos os Streamings`);
        } else {
            navigate(`/catalog/${service.id}?name=${service.name}`);
        }
    };

    // --- NOVO: Handler para registrar XP quando usar a roleta ---
    const handleRouletteUsed = async () => {
        console.log("Sorteador utilizado! Registrando XP...");
        await registerRandomPickerXP();
    };

    return (
         <div className="relative min-h-[calc(100vh-80px)] flex flex-col items-center pt-4 md:pt-8 overflow-hidden">
            
            <div className="absolute inset-0 w-full h-full z-[-1]">
                <div className="absolute inset-0 bg-gray-900"></div>
            </div>

            <div className="container mx-auto p-2 md:p-8 text-white relative z-10 w-full max-w-4xl">
                
                <h2 className="text-2xl md:text-4xl font-bold mb-6 md:mb-8 text-center tracking-tight text-shadow">Explorar</h2>

                {/* --- MENU DE ABAS --- */}
                <div className="flex justify-center mb-6 md:mb-10 overflow-x-auto pb-2 md:pb-0 w-full">
                    <div className="bg-gray-800/80 p-1.5 rounded-xl flex items-center shadow-lg border border-gray-700/50 whitespace-nowrap overflow-x-auto w-full max-w-full gap-1">
                        {/* Abas centralizadas, responsivas e ocupando todo espaço */}
                        <button 
                            onClick={() => setActiveTab('catalog')}
                            className={`flex flex-col items-center justify-center flex-1 px-0 md:px-6 py-2 rounded-lg text-3xl md:text-sm font-bold transition-all duration-300 min-w-0 ${activeTab === 'catalog' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                            style={{minWidth: 0}}
                        >
                            <LayoutGridIcon className="w-9 h-9 md:w-5 md:h-5 mx-auto" />
                            <span className="hidden md:inline truncate">Catálogo</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('roulette')}
                            className={`flex flex-col items-center justify-center flex-1 px-0 md:px-6 py-2 rounded-lg text-3xl md:text-sm font-bold transition-all duration-300 min-w-0 ${activeTab === 'roulette' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                            style={{minWidth: 0}}
                        >
                            <DiceIcon className="w-9 h-9 md:w-5 md:h-5 mx-auto" />
                            <span className="hidden md:inline truncate">Sorteador</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('match')}
                            className={`flex flex-col items-center justify-center flex-1 px-0 md:px-6 py-2 rounded-lg text-3xl md:text-sm font-bold transition-all duration-300 min-w-0 ${activeTab === 'match' ? 'bg-pink-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                            style={{minWidth: 0}}
                        >
                            <HeartIcon className="w-9 h-9 md:w-5 md:h-5 mx-auto" />
                            <span className="hidden md:inline truncate">CineMatch</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('clubs')}
                            className={`flex flex-col items-center justify-center flex-1 px-0 md:px-6 py-2 rounded-lg text-3xl md:text-sm font-bold transition-all duration-300 min-w-0 ${activeTab === 'clubs' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                            style={{minWidth: 0}}
                        >
                            <UsersIcon className="w-9 h-9 md:w-5 md:h-5 mx-auto" />
                            <span className="hidden md:inline truncate">Clubes</span>
                        </button>
                    </div>
                </div>

                {/* --- CONTEÚDO --- */}
                
                {/* ABA 1: CATÁLOGO */}
                {activeTab === 'catalog' && (
                    <div className="animate-fade-in">
                        <div className="text-center mb-6 md:mb-8">
                            <p className="text-gray-400 text-sm md:text-base">Navegue pelos catálogos completos dos seus streamings favoritos.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                            {EXPLORE_SERVICES.map(service => <ServiceCard key={service.id} service={service} onClick={() => handleNavigate(service)} />)}
                        </div>
                    </div>
                )}

                {/* ABA 2: ROLETA */}
                {activeTab === 'roulette' && (
                    <div className="animate-fade-in py-2 md:py-4">
                        {/* Passamos a função handleRouletteUsed via prop 'onSpin' */}
                        <RandomPicker onSpin={handleRouletteUsed} />
                    </div>
                )}

                {/* ABA 3: CINEMATCH */}
                {activeTab === 'match' && (
                    <div className="animate-fade-in py-4 md:py-8 flex flex-col items-center">
                         <div 
                            onClick={() => navigate('/match')}
                            className="w-full bg-gradient-to-br from-pink-900/60 to-red-900/60 border border-pink-500/30 rounded-3xl p-6 md:p-12 flex flex-col items-center text-center cursor-pointer hover:scale-[1.01] transition-transform group shadow-2xl shadow-pink-900/30 relative overflow-hidden"
                        >
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
                            <HeartIcon className="w-16 md:w-20 h-16 md:h-20 text-pink-500 mb-4 md:mb-6 drop-shadow-lg transform group-hover:scale-110 transition-transform" />
                            <h3 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">CineMatch</h3>
                            <p className="text-gray-300 text-base md:text-lg mb-4 md:mb-8 max-w-lg leading-relaxed">
                                Brigando para escolher o filme? Crie uma sala, dê likes e descubra o filme perfeito em segundos.
                            </p>
                            <div className="bg-pink-600 px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-white text-base md:text-lg group-hover:bg-pink-500 transition-colors flex items-center gap-3 shadow-lg">
                                Iniciar Sessão
                            </div>
                        </div>
                    </div>
                )}

                {/* ABA 4: CLUBES */}
                {activeTab === 'clubs' && (
                    <div className="animate-fade-in py-4 md:py-8 flex flex-col items-center">
                         <div 
                            onClick={() => navigate('/clubs')}
                            className="w-full bg-gradient-to-br from-emerald-900/60 to-teal-900/60 border border-emerald-500/30 rounded-3xl p-6 md:p-12 flex flex-col items-center text-center cursor-pointer hover:scale-[1.01] transition-transform group shadow-2xl shadow-emerald-900/30 relative overflow-hidden"
                        >
                            <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
                            <UsersIcon className="w-16 md:w-20 h-16 md:h-20 text-emerald-500 mb-4 md:mb-6 drop-shadow-lg transform group-hover:scale-110 transition-transform" />
                            <h3 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">CineClubes</h3>
                            <p className="text-gray-300 text-base md:text-lg mb-4 md:mb-8 max-w-lg leading-relaxed">
                                Junte-se a comunidades de fãs, discuta seus gêneros favoritos e faça parte de grupos exclusivos.
                            </p>
                            <div className="bg-emerald-600 px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-white text-base md:text-lg group-hover:bg-emerald-500 transition-colors flex items-center gap-3 shadow-lg">
                                Explorar Clubes
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

const ServiceCard = ({ service, onClick }) => {
    const [posters, setPosters] = useState([]);
    const [activePosterIndex, setActivePosterIndex] = useState(0);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchPosters = async () => {
            if (service.id === 'all' || service.id === 'match' || service.id === 'clubs') return;
            try {
                const data = await tmdbApi.discoverContent('movie', service.id, 1, null, 'popularity.desc');
                const posterUrls = data.results
                    .filter(item => item.backdrop_path)
                    .slice(0, 10)
                    .map(item => `${TMDB_IMAGE_URL.replace('/original', '/w1280')}${item.backdrop_path}`);
                
                if (isMounted && posterUrls.length > 0) {
                    setPosters(posterUrls);
                }
            } catch (error) {
                console.error(`Falha ao buscar pôsteres para ${service.name}`, error);
            }
        };
        fetchPosters();
        return () => { isMounted = false; };
    }, [service.id, service.name]);

    useEffect(() => {
        if (posters.length <= 1) return;

        const intervalId = setInterval(() => {
            setIsFading(true);
            setTimeout(() => {
                setActivePosterIndex((prevIndex) => (prevIndex + 1) % posters.length);
                setIsFading(false);
            }, 1000);
        }, 6000);

        return () => clearInterval(intervalId);
    }, [posters]);

    const currentPoster = posters[activePosterIndex];
    const nextPoster = posters[(activePosterIndex + 1) % posters.length];

    return (
        <div 
            onClick={onClick}
            className={`group relative bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center justify-center cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:border-white/20 aspect-video overflow-hidden hover:${service.color || 'shadow-indigo-500/30'}`}
        >
            <div
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
                style={{ backgroundImage: `url(${currentPoster})`, opacity: isFading ? 0 : 1 }}
            />
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${nextPoster})`, opacity: 0 }}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="relative z-10 flex flex-col items-center justify-center text-center">
                <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white transition-transform duration-300 group-hover:scale-110" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>{service.name}</h3>
            </div>
        </div>
    );
};

export default HomePage;