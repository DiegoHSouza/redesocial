import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { tmdbApi, TMDB_IMAGE_URL } from '../services/tmdbApi';
import { Spinner, getAvatarUrl } from '../components/Common'; // <--- CORREÇÃO: Importado getAvatarUrl
import { HeartIcon, CloseIcon, InfoIcon } from '../components/Icons';

// IDs dos serviços para a busca "global"
const ALL_PROVIDERS = "8|119|337|1899|350"; // Netflix, Prime, Disney+, Max, AppleTV

// --- Sub-componente para buscar o logo do Streaming do filme atual ---
const MovieProviderBadge = ({ mediaId }) => {
    const [provider, setProvider] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const fetchProvider = async () => {
            setProvider(null);
            try {
                // Busca onde assistir especificamente para este filme
                const data = await tmdbApi.get(`movie/${mediaId}/watch/providers`);
                const brProviders = data.results?.BR?.flatrate;
                
                if (isMounted && brProviders && brProviders.length > 0) {
                    // Pega o primeiro provider da lista
                    setProvider(brProviders[0]);
                }
            } catch (error) {
                console.error("Erro provider", error);
            }
        };
        fetchProvider();
        return () => { isMounted = false; };
    }, [mediaId]);

    if (!provider) return null;

    return (
        <div className="absolute top-4 left-4 z-20 animate-fade-in">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded-lg flex items-center gap-2 shadow-lg">
                <img 
                    src={`${TMDB_IMAGE_URL}${provider.logo_path}`} 
                    alt={provider.provider_name} 
                    className="w-6 h-6 rounded-md object-cover" 
                />
                <span className="text-xs font-bold text-white pr-1">{provider.provider_name}</span>
            </div>
        </div>
    );
};

const CineMatchPage = () => {
    const { currentUser } = useAuth();
    const [mode, setMode] = useState('menu'); 
    const [sessionId, setSessionId] = useState('');
    const [movies, setMovies] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [match, setMatch] = useState(null);
    
    const [participants, setParticipants] = useState([]);
    const [showDetails, setShowDetails] = useState(false);
    const [copied, setCopied] = useState(false);

    const moviesRef = useRef([]); 

    useEffect(() => {
        moviesRef.current = movies;
    }, [movies]);

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    const createSession = async () => {
        setLoading(true);
        try {
            // 1. Sorteia página entre 1 e 20 para variedade
            const randomPage = Math.floor(Math.random() * 20) + 1;
            
            // 2. Busca em TODOS os provedores
            const data = await tmdbApi.discoverContent('movie', ALL_PROVIDERS, randomPage); 
            
            // 3. Embaralha
            const sessionMovies = shuffleArray(data.results);
            
            const docRef = await db.collection('cinematch').add({
                hostId: currentUser.uid,
                movies: sessionMovies,
                users: [currentUser.uid],
                likes: {},
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setSessionId(docRef.id);
            setMovies(sessionMovies);
            setMode('lobby');
        } catch (error) { console.error(error); }
        setLoading(false);
    };

    const joinSession = async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const docRef = db.collection('cinematch').doc(sessionId);
            const doc = await docRef.get();
            if (doc.exists) {
                await docRef.update({
                    users: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
                setMovies(doc.data().movies);
                setMode('swipe');
            } else {
                alert("Sessão não encontrada");
            }
        } catch (error) { console.error(error); }
        setLoading(false);
    };

    useEffect(() => {
        if ((mode !== 'swipe' && mode !== 'lobby') || !sessionId) return;

        const unsubscribe = db.collection('cinematch').doc(sessionId)
            .onSnapshot(async (doc) => {
                if (!doc.exists) return;
                const data = doc.data();
                
                const allUsers = data.users || [];
                const allLikes = data.likes || {};

                if (allUsers.length !== participants.length) {
                    const userPromises = allUsers.map(uid => db.collection('users').doc(uid).get());
                    const userDocs = await Promise.all(userPromises);
                    const usersData = userDocs.map(d => d.exists ? d.data() : { nome: 'Usuário', foto: null });
                    setParticipants(usersData);
                }

                for (let movieId in allLikes) {
                    const userLikes = allLikes[movieId];
                    if (allUsers.length > 1 && userLikes && userLikes.length === allUsers.length) {
                        const movie = moviesRef.current.find(m => m.id.toString() === movieId);
                        if (movie) {
                            setMatch(movie);
                            break;
                        }
                    }
                }
            });
            
        return () => unsubscribe();
    }, [sessionId, mode]);

    const handleSwipe = async (liked) => {
        setShowDetails(false);
        if (currentIndex >= movies.length) return;
        const movie = movies[currentIndex];

        if (liked) {
            const docRef = db.collection('cinematch').doc(sessionId);
            await docRef.set({
                likes: {
                    [movie.id]: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                }
            }, { merge: true });
        }
        
        setCurrentIndex(prev => prev + 1);
    };

    const handleCopySessionId = () => {
        navigator.clipboard.writeText(sessionId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    if (loading) return <Spinner />;

    const progress = Math.min(100, ((currentIndex) / movies.length) * 100);

    return (
        <div className="container mx-auto p-4 text-white h-[calc(100vh-80px)] flex flex-col items-center justify-center overflow-hidden">
            {match ? (
                <div className="text-center animate-fade-in p-8 bg-gray-800/90 backdrop-blur-xl rounded-3xl border border-green-500/50 shadow-2xl max-w-md w-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 mb-6 relative z-10">MATCH!</h1>
                    
                    <div className="relative w-48 mx-auto mb-6 group">
                        <img src={`${TMDB_IMAGE_URL}${match.poster_path}`} className="w-full rounded-xl shadow-2xl transform group-hover:scale-105 transition-transform duration-500" alt={match.title} />
                        {/* Badge do Provider no Resultado do Match */}
                        <div className="absolute -top-3 -left-3">
                             <MovieProviderBadge mediaId={match.id} />
                        </div>
                        <div className="absolute -bottom-4 -right-4 bg-white text-green-600 p-3 rounded-full shadow-lg">
                            <HeartIcon className="w-8 h-8 fill-current" />
                        </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold mb-2 relative z-10">{match.title}</h2>
                    <p className="text-gray-300 text-sm relative z-10">Todos curtiram! Preparem a pipoca.</p>
                </div>
            ) : (
                <>
                    {mode === 'menu' && (
                        <div className="space-y-8 text-center max-w-md w-full animate-fade-in">
                            <div>
                                <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-600 drop-shadow-lg">CineMatch</h1>
                                <p className="text-gray-400 text-lg">Escolham juntos, sem brigas.</p>
                            </div>
                            
                            <div className="bg-gray-800/60 backdrop-blur-md p-8 rounded-3xl border border-gray-700 shadow-xl">
                                <button onClick={createSession} className="block w-full py-4 bg-gradient-to-r from-pink-600 to-red-600 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-pink-500/30 hover:-translate-y-1 transition-all mb-8">
                                    Criar Nova Sessão
                                </button>
                                
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div className="h-px bg-gray-600 flex-1"></div>
                                    <span className="text-gray-500 text-sm uppercase tracking-wider">Ou</span>
                                    <div className="h-px bg-gray-600 flex-1"></div>
                                </div>

                                {/* Ajuste: stack vertical no mobile, input e botão ocupando 100% */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input 
                                        type="text" 
                                        name="session-id"
                                        value={sessionId} 
                                        onChange={e => setSessionId(e.target.value)} 
                                        placeholder="Código da Sala" 
                                        className="bg-gray-900/80 border border-gray-600 px-4 py-3 rounded-xl flex-1 focus:outline-none focus:border-pink-500 transition-colors text-center tracking-widest font-mono text-white w-full"
                                    />
                                    <button 
                                        onClick={joinSession} 
                                        className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-bold transition-colors w-full sm:w-auto"
                                    >
                                        Entrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === 'lobby' && (
                        <div className="text-center max-w-md w-full bg-gray-800/60 backdrop-blur-md p-4 md:p-8 rounded-3xl border border-gray-700 shadow-xl animate-fade-in">
                            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Sala de Espera</h2>
                            
                            <div className="mb-3 flex flex-col items-center gap-2">
                                <div 
                                    className="bg-black/40 p-3 md:p-4 rounded-2xl font-mono text-xl md:text-3xl tracking-widest text-center border border-indigo-500/50 text-indigo-400 select-all w-full max-w-full overflow-hidden whitespace-nowrap text-ellipsis"
                                    style={{ wordBreak: 'break-all', maxWidth: '100%' }}
                                >
                                    <span className="block w-full overflow-hidden whitespace-nowrap text-ellipsis">{sessionId}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopySessionId}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors text-sm md:text-base"
                                >
                                    {copied ? "Copiado!" : "Copiar Código"}
                                </button>
                            </div>

                            <div className="flex justify-center gap-2 md:gap-4 mb-6 md:mb-8 min-h-[60px] md:min-h-[80px]">
                                {participants.map((p, i) => (
                                    <div key={i} className="flex flex-col items-center animate-fade-in">
                                        <div className="relative">
                                            <img 
                                                src={getAvatarUrl(p.foto, p.nome)} 
                                                className="w-10 h-10 md:w-14 md:h-14 rounded-full object-cover border-2 border-pink-500 shadow-lg" 
                                                alt={p.nome}
                                                onError={(e) => { e.target.onerror = null; e.target.src=getAvatarUrl(null, p.nome); }}
                                            />
                                            <div className="absolute bottom-0 right-0 w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full border border-gray-800"></div>
                                        </div>
                                        <span className="text-[10px] md:text-xs mt-1 md:mt-2 text-gray-300 max-w-[40px] md:max-w-[60px] truncate">{p.nome}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <button
                                onClick={() => setMode('swipe')}
                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-lg hover:shadow-green-900/20 py-3 md:py-4 px-6 md:px-8 rounded-xl font-bold transition-all transform hover:-translate-y-0.5 text-sm md:text-base"
                            >
                                Começar a Escolher
                            </button>
                        </div>
                    )}

                    {mode === 'swipe' && currentIndex < movies.length && (
                        <div className="w-full max-w-sm flex flex-col items-center">
                            <div className="w-full flex items-center gap-3 mb-4 px-2">
                                <span className="text-xs text-gray-400 font-mono">{currentIndex + 1}/{movies.length}</span>
                                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>

                            <div className="relative w-full aspect-[2/3] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-700/50 group perspective-1000">
                                <MovieProviderBadge mediaId={movies[currentIndex].id} />

                                <img src={`${TMDB_IMAGE_URL}${movies[currentIndex].poster_path}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Movie" />
                                
                                <div className={`absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent transition-opacity duration-300 ${showDetails ? 'opacity-0' : 'opacity-100'}`}></div>

                                <div className={`absolute bottom-0 inset-x-0 p-6 transition-all duration-300 transform ${showDetails ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
                                    <h2 className="text-3xl font-bold leading-tight drop-shadow-lg mb-1">{movies[currentIndex].title}</h2>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded border border-yellow-500/30">
                                            ★ {movies[currentIndex].vote_average.toFixed(1)}
                                        </span>
                                        <span className="text-xs text-gray-300">{movies[currentIndex].release_date?.split('-')[0]}</span>
                                    </div>
                                </div>

                                <div className={`absolute inset-0 bg-black/80 backdrop-blur-sm p-6 flex flex-col justify-center transition-all duration-300 ${showDetails ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                                    <h2 className="text-2xl font-bold mb-4 text-pink-400">{movies[currentIndex].title}</h2>
                                    <p className="text-gray-200 text-sm leading-relaxed overflow-y-auto max-h-[60%] pr-2 scrollbar-thin scrollbar-thumb-gray-600">
                                        {movies[currentIndex].overview || "Sinopse não disponível."}
                                    </p>
                                    <div className="mt-6 pt-6 border-t border-gray-700">
                                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Título Original</p>
                                        <p className="text-sm">{movies[currentIndex].original_title}</p>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setShowDetails(!showDetails)}
                                    className="absolute top-4 right-4 bg-black/40 hover:bg-black/70 backdrop-blur-md text-white p-2 rounded-full border border-white/20 transition-all z-20"
                                >
                                    {showDetails ? <CloseIcon className="w-6 h-6" /> : <InfoIcon className="w-6 h-6" />}
                                </button>
                            </div>
                            
                            <div className="flex justify-center gap-8 mt-6">
                                <button onClick={() => handleSwipe(false)} className="p-5 bg-gray-800/80 backdrop-blur text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 border-2 border-red-500/50 rounded-full shadow-lg transform hover:scale-110 hover:shadow-red-500/30">
                                    <CloseIcon className="w-8 h-8" />
                                </button>
                                <button onClick={() => handleSwipe(true)} className="p-5 bg-gray-800/80 backdrop-blur text-green-500 hover:bg-green-500 hover:text-white transition-all duration-200 border-2 border-green-500/50 rounded-full shadow-lg transform hover:scale-110 hover:shadow-green-500/30">
                                    <HeartIcon className="w-8 h-8" />
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {mode === 'swipe' && currentIndex >= movies.length && (
                         <div className="text-center p-8 bg-gray-800/50 rounded-3xl border border-gray-700 max-w-md w-full">
                            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <span className="text-2xl">🎬</span>
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Fim da Lista!</h2>
                            <p className="text-gray-400 mb-6">Você já viu todas as sugestões.</p>
                            
                            <div className="flex items-center justify-center gap-3 bg-black/30 p-4 rounded-xl">
                                <Spinner />
                                <span className="text-sm text-indigo-300 font-medium animate-pulse">Aguardando o match do amigo...</span>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CineMatchPage;