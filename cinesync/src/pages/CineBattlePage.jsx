import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../services/firebaseConfig';
import { 
    doc, getDoc, getDocs, writeBatch, increment, 
    serverTimestamp, collection, query, orderBy, limit 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/Common';
import { TrophyIcon, FireIcon, CloseIcon, CrownIcon, LayoutGridIcon, PlayIcon, PlusIcon, SearchIcon, DiceIcon, StarIcon } from '../components/Icons'; 

// --- CONFIGURAÇÃO ---
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY; 
const TMDB_IMAGE_HD = 'https://image.tmdb.org/t/p/original'; 
const TMDB_IMAGE_SMALL = 'https://image.tmdb.org/t/p/w342'; 

const GENRE_PAIRS = [
    { id: 28, name: 'Ação' }, { id: 12, name: 'Aventura' }, { id: 16, name: 'Animação' },
    { id: 35, name: 'Comédia' }, { id: 27, name: 'Terror' }, { id: 878, name: 'Sci-Fi' },
    { id: 53, name: 'Suspense' }, { id: 10749, name: 'Romance' }, { id: 18, name: 'Drama' }
];

// --- COMPONENTES AUXILIARES ---

const RankingImage = ({ path, alt, isWinner, percentage }) => {
    const [error, setError] = useState(false);
    if (!path || error) return (
        <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center p-2 text-gray-600 relative overflow-hidden">
            <LayoutGridIcon className="w-6 h-6 opacity-30" />
            <div className="absolute bottom-0 left-0 w-full bg-black/60 p-1 text-center"><span className="text-xs font-bold text-white">{percentage}%</span></div>
            {isWinner && <div className="absolute top-1 left-1 bg-blue-600 text-[8px] font-bold px-1 rounded text-white shadow-sm">WIN</div>}
        </div>
    );
    return (
        <div className="relative w-full h-full group">
            <img src={`${TMDB_IMAGE_SMALL}${path}`} className="w-full h-full object-cover opacity-90 transition-opacity" alt={alt} onError={() => setError(true)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
            <div className="absolute bottom-2 left-2 z-10"><span className={`text-lg font-black leading-none ${isWinner ? 'text-white' : 'text-gray-400'}`}>{percentage}%</span></div>
            {isWinner && <div className="absolute top-1 left-1 bg-blue-600/90 backdrop-blur-sm text-[8px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm border border-white/10">WIN</div>}
        </div>
    );
};

const ArenaMovieCard = React.memo(({ movie, side, onVote, disabled, showStats, percent, isChosen }) => {
    const isLeft = side === 'left';
    const gradient = isLeft ? "from-blue-900/95 via-blue-900/30" : "from-red-900/95 via-red-900/30";
    const textColor = isLeft ? "text-blue-400" : "text-red-400";
    const borderColor = isLeft ? "border-blue-500" : "border-red-500";

    return (
        <div onClick={!disabled ? onVote : undefined} className={`flex-1 relative group overflow-hidden cursor-pointer transition-all duration-700 ${disabled && !isChosen ? 'grayscale opacity-30 blur-sm' : 'grayscale-0 opacity-100'} ${isLeft ? 'border-r-4 border-black' : ''}`}>
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out group-hover:scale-110" style={{ backgroundImage: `url(${TMDB_IMAGE_HD}${movie?.poster_path})` }} />
            <div className={`absolute inset-0 bg-gradient-to-t ${gradient} to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500`} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 opacity-80" />
            <AnimatePresence>
                {showStats && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-20">
                        <span className={`text-7xl md:text-9xl font-black ${textColor} drop-shadow-2xl tracking-tighter`}>{percent}%</span>
                        {isChosen && <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-4 bg-white/10 px-6 py-2 rounded-full border border-white/20"><span className="text-white text-sm font-bold uppercase tracking-widest flex items-center gap-2"><TrophyIcon className="w-4 h-4 text-yellow-400" /> Seu Voto</span></motion.div>}
                    </motion.div>
                )}
            </AnimatePresence>
            <div className={`absolute z-10 p-8 md:p-12 w-full flex flex-col justify-end h-full transition-transform duration-500 group-hover:-translate-y-4 ${isLeft ? 'items-start text-left' : 'items-end text-right'}`}>
                {!showStats && <div className={`mb-4 px-4 py-1.5 rounded-full border ${borderColor} bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0`}><span className={`text-xs font-black uppercase tracking-widest ${textColor}`}>Votar</span></div>}
                <h2 className="text-3xl md:text-5xl font-black text-white uppercase leading-[0.9] drop-shadow-2xl max-w-xl">{movie?.title}</h2>
                {movie?.release_date && <p className="text-white/60 font-medium mt-2 text-sm uppercase tracking-wider drop-shadow-md">{movie.release_date.split('-')[0]}</p>}
            </div>
        </div>
    );
});

// --- COMPONENTE PRINCIPAL ---
const CineBattlePage = () => {
    const { currentUser } = useAuth();
    
    // Estados do Jogo
    const [movies, setMovies] = useState([null, null]); 
    const [battleId, setBattleId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [votingState, setVotingState] = useState('idle'); 
    const [stats, setStats] = useState({ votesA: 0, votesB: 0, total: 0 });
    const [userChoice, setUserChoice] = useState(null);
    const [currentGenre, setCurrentGenre] = useState('');
    const [battleType, setBattleType] = useState('new'); 

    // Modals
    const [showRanking, setShowRanking] = useState(false);
    const [rankingData, setRankingData] = useState([]);
    const [loadingRanking, setLoadingRanking] = useState(false);
    
    // Criação
    const [showCreate, setShowCreate] = useState(false);
    const [createSelection, setCreateSelection] = useState({ A: null, B: null });
    const [activeSlot, setActiveSlot] = useState(null); 
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // --- GAME LOGIC ---
    const fetchNewBattle = useCallback(async () => {
        setLoading(true);
        setVotingState('idle');
        setUserChoice(null);
        setStats({ votesA: 0, votesB: 0, total: 0 });

        try {
            const shouldFetchExisting = Math.random() > 0.6; 

            if (shouldFetchExisting) {
                const battlesRef = collection(db, 'battles');
                const q = query(battlesRef, orderBy('lastActivity', 'desc'), limit(15)); 
                const snapshot = await getDocs(q);
                
                if (!snapshot.empty) {
                    const randomDoc = snapshot.docs[Math.floor(Math.random() * snapshot.docs.length)];
                    const data = randomDoc.data();
                    
                    setMovies([
                        { id: data.movieA_Id, title: data.movieA_Title, poster_path: data.movieA_Poster, release_date: '' },
                        { id: data.movieB_Id, title: data.movieB_Title, poster_path: data.movieB_Poster, release_date: '' }
                    ]);
                    setBattleId(randomDoc.id);
                    setBattleType('trending');
                    
                    const voteRef = doc(db, 'battles', randomDoc.id, 'votes', currentUser.uid);
                    const voteSnap = await getDoc(voteRef);
                    if (voteSnap.exists()) {
                        setUserChoice(voteSnap.data().choiceId);
                        setVotingState('voted');
                    }
                    
                    setStats({
                        votesA: data.votesA || 0,
                        votesB: data.votesB || 0,
                        total: (data.votesA || 0) + (data.votesB || 0)
                    });
                    
                    setLoading(false);
                    return;
                }
            }

            const randomGenreIndex = Math.floor(Math.random() * GENRE_PAIRS.length);
            const selectedGenre = GENRE_PAIRS[randomGenreIndex];
            setCurrentGenre(selectedGenre.name);

            const randomPage = Math.floor(Math.random() * 40) + 1;
            const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${selectedGenre.id}&language=pt-BR&sort_by=popularity.desc&vote_count.gte=300&page=${randomPage}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            const validMovies = data.results.filter(m => m.poster_path && m.backdrop_path);
            if (!validMovies || validMovies.length < 2) throw new Error("Sem filmes suficientes");

            const shuffled = validMovies.sort(() => 0.5 - Math.random()).slice(0, 2);
            
            setBattleType('new'); 
            setupBattle(shuffled[0], shuffled[1]);

        } catch (error) {
            console.warn("Retrying fetch...", error);
            setTimeout(fetchNewBattle, 1000);
        } finally {
            // setLoading tratado no setupBattle
        }
    }, [currentUser]);

    const setupBattle = async (movieA, movieB) => {
        setMovies([movieA, movieB]);
        const newBattleId = `${Math.min(movieA.id, movieB.id)}_vs_${Math.max(movieA.id, movieB.id)}`;
        setBattleId(newBattleId);
        setVotingState('idle');
        setUserChoice(null);
        setStats({ votesA: 0, votesB: 0, total: 0 });
        await loadBattleData(newBattleId);
        setLoading(false);
    };

    const loadBattleData = async (id) => {
        try {
            const [battleSnap, myVoteSnap] = await Promise.all([
                getDoc(doc(db, 'battles', id)),
                getDoc(doc(db, 'battles', id, 'votes', currentUser.uid))
            ]);

            if (battleSnap.exists()) {
                const data = battleSnap.data();
                setStats({
                    votesA: data.votesA || 0,
                    votesB: data.votesB || 0,
                    total: (data.votesA || 0) + (data.votesB || 0)
                });
                if (data.totalVotes > 5) setBattleType('trending');
            }

            if (myVoteSnap.exists()) {
                setUserChoice(myVoteSnap.data().choiceId);
                setVotingState('voted');
            }
        } catch (error) { console.error(error); }
    };

    const handleSelectFromRanking = async (battleData) => {
        setShowRanking(false); 
        setLoading(true); 
        const movieA = { id: battleData.movieA_Id, title: battleData.movieA_Title, poster_path: battleData.movieA_Poster };
        const movieB = { id: battleData.movieB_Id, title: battleData.movieB_Title, poster_path: battleData.movieB_Poster };
        setMovies([movieA, movieB]);
        setBattleId(battleData.id);
        setCurrentGenre("Duelo da Comunidade"); 
        setBattleType('trending');
        setVotingState('idle');
        setUserChoice(null);
        setStats({ votesA: 0, votesB: 0, total: 0 });
        await loadBattleData(battleData.id);
        setLoading(false);
    };

    const handleVote = async (selectedMovieIndex) => {
        if (votingState !== 'idle') return;
        const selectedMovie = movies[selectedMovieIndex];
        const isMovieA = selectedMovieIndex === 0;
        setVotingState('voting');
        setUserChoice(selectedMovie.id);
        setStats(prev => ({ ...prev, votesA: isMovieA ? prev.votesA + 1 : prev.votesA, votesB: !isMovieA ? prev.votesB + 1 : prev.votesB, total: prev.total + 1 }));

        try {
            const batch = writeBatch(db);
            const battleRef = doc(db, 'battles', battleId);
            const voteRef = doc(db, 'battles', battleId, 'votes', currentUser.uid);

            batch.set(battleRef, {
                movieA_Id: movies[0].id, movieA_Title: movies[0].title, movieA_Poster: movies[0].poster_path, 
                movieB_Id: movies[1].id, movieB_Title: movies[1].title, movieB_Poster: movies[1].poster_path, 
                votesA: isMovieA ? increment(1) : increment(0),
                votesB: !isMovieA ? increment(1) : increment(0),
                totalVotes: increment(1),
                lastActivity: serverTimestamp()
            }, { merge: true });

            batch.set(voteRef, { choiceId: selectedMovie.id, timestamp: serverTimestamp() });

            await batch.commit();
            setVotingState('voted');
            if (!showCreate) setTimeout(fetchNewBattle, 3000); 
        } catch (error) { console.error(error); setVotingState('idle'); }
    };

    // --- FUNÇÕES DE CRIAÇÃO ---
    const handleSearchMovie = async (query) => {
        setSearchTerm(query);
        if (query.length < 3) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(query)}&page=1`);
            const data = await res.json();
            setSearchResults(data.results.filter(m => m.poster_path)); 
        } catch (error) { console.error(error); }
        finally { setIsSearching(false); }
    };

    const handleSelectMovieForSlot = (movie) => {
        setCreateSelection(prev => ({ ...prev, [activeSlot]: movie }));
        setActiveSlot(null);
        setSearchTerm('');
        setSearchResults([]);
    };

    const confirmCustomBattle = () => {
        if (createSelection.A && createSelection.B) {
            setShowCreate(false);
            setCurrentGenre("Duelo Personalizado");
            setBattleType('new');
            setupBattle(createSelection.A, createSelection.B);
            setCreateSelection({ A: null, B: null });
        }
    };

    const fetchRanking = async () => {
        if (rankingData.length > 0) return; 
        setLoadingRanking(true);
        try {
            const q = query(collection(db, 'battles'), orderBy('totalVotes', 'desc'), limit(20));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRankingData(data);
        } catch (error) { console.error(error); } 
        finally { setLoadingRanking(false); }
    };

    useEffect(() => { fetchNewBattle(); }, [fetchNewBattle]);
    useEffect(() => { if (showRanking) fetchRanking(); }, [showRanking]);

    const getPercent = (votes) => stats.total === 0 ? 0 : Math.round((votes / stats.total) * 100);

    if (loading && !movies[0]) return <div className="h-screen flex items-center justify-center bg-gray-950"><Spinner /></div>;

    return (
        <div className="h-screen w-full bg-gray-950 text-white font-sans overflow-hidden flex flex-col relative pt-16">
            
            {/* HEADER FLUTUANTE (AGORA ISOLADO E PROTEGIDO CONTRA CLIQUES FANTASMAS) */}
            <div className="absolute top-24 left-0 w-full z-50 pointer-events-none flex flex-col items-center justify-center">
                
                {/* Ilha de Controle (Recebe os cliques) */}
                <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="pointer-events-auto bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-2xl flex flex-col items-center gap-3 animate-fade-in-down"
                >
                    {/* Status Badge */}
                    <div className="flex items-center gap-2 px-2">
                        {battleType === 'new' ? (
                            <div className="flex items-center gap-1.5 text-yellow-300">
                                <StarIcon className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Inédita</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-orange-400">
                                <FireIcon className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Em Alta</span>
                            </div>
                        )}
                        {currentGenre && (
                            <>
                                <span className="text-gray-600">•</span>
                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{currentGenre}</span>
                            </>
                        )}
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowRanking(true); }} 
                            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5"
                        >
                            <TrophyIcon className="w-4 h-4 text-yellow-400" />
                            <span className="text-xs font-bold uppercase">Top</span>
                        </button>

                        <button 
                            onClick={(e) => { e.stopPropagation(); fetchNewBattle(); }} 
                            className="bg-purple-600 hover:bg-purple-500 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-purple-900/30"
                        >
                            <DiceIcon className="w-5 h-5" />
                        </button>

                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowCreate(true); }} 
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-900/30"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase">Criar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Arena Main Page */}
            <div className="flex-1 flex flex-col md:flex-row relative">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                    <div className="relative">
                        <div className="absolute inset-0 bg-black blur-3xl rounded-full opacity-80"></div>
                        <span className="relative z-10 text-7xl md:text-9xl font-black text-white italic drop-shadow-[0_0_35px_rgba(255,255,255,0.4)] tracking-tighter">VS</span>
                    </div>
                </div>
                <ArenaMovieCard movie={movies[0]} side="left" stats={stats.votesA} percent={getPercent(stats.votesA)} onVote={() => handleVote(0)} disabled={votingState !== 'idle'} showStats={votingState === 'voted'} isChosen={userChoice === movies[0]?.id} />
                <ArenaMovieCard movie={movies[1]} side="right" stats={stats.votesB} percent={getPercent(stats.votesB)} onVote={() => handleVote(1)} disabled={votingState !== 'idle'} showStats={votingState === 'voted'} isChosen={userChoice === movies[1]?.id} />
            </div>

            {/* --- MODAL DE CRIAÇÃO OTIMIZADO --- */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-gray-900 w-full max-w-5xl rounded-3xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                                <div><h2 className="text-lg font-black text-white uppercase tracking-wider">Criar Batalha</h2><p className="text-[10px] text-gray-400">Escolha dois filmes</p></div>
                                <button onClick={() => setShowCreate(false)}><CloseIcon className="w-6 h-6 text-gray-400 hover:text-white" /></button>
                            </div>
                            <div className="px-4 py-4 md:px-6 md:py-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                                <div className="flex gap-4 md:gap-8 mb-5 justify-center items-center shrink-0">
                                    {['A', 'B'].map((slot) => {
                                        const movie = createSelection[slot];
                                        return (
                                            <div key={slot} onClick={() => setActiveSlot(slot)} className={`w-32 md:w-44 aspect-[2/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden group shadow-lg ${activeSlot === slot ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/50 scale-105' : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'}`}>
                                                {movie ? (
                                                    <>
                                                        <img src={`${TMDB_IMAGE_SMALL}${movie.poster_path}`} className="w-full h-full object-cover" alt="" />
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity"><div className="bg-gray-200 text-black p-2 rounded-full mb-2"><SearchIcon className="w-4 h-4"/></div><span className="text-xs font-bold uppercase tracking-wider text-white">Trocar</span></div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className={`p-3 rounded-full mb-2 transition-colors ${activeSlot === slot ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-400'}`}><PlusIcon className="w-5 h-5" /></div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filme {slot}</span>
                                                    </>
                                                )}
                                            </div>
                                        )
                                    })}
                                    <div className="flex flex-col justify-center"><span className="text-2xl font-black text-gray-700 italic opacity-50">VS</span></div>
                                </div>
                                <AnimatePresence>
                                    {activeSlot && (
                                        <motion.div initial={{ flexGrow: 0, opacity: 0 }} animate={{ flexGrow: 1, opacity: 1 }} exit={{ flexGrow: 0, opacity: 0 }} className="flex flex-col overflow-hidden min-h-0">
                                            <div className="relative mb-3 shrink-0">
                                                <SearchIcon className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                                                <input type="text" autoFocus placeholder={`Digite o nome do filme para o lado ${activeSlot}...`} value={searchTerm} onChange={(e) => handleSearchMovie(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-xl py-3 pl-12 pr-4 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"/>
                                                {isSearching && <div className="absolute right-4 top-3.5"><Spinner size="sm"/></div>}
                                            </div>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-6 p-2 overflow-y-auto custom-scrollbar flex-1 max-h-[50vh]">
                                                {searchResults.map(movie => (
                                                    <div key={movie.id} onClick={() => handleSelectMovieForSlot(movie)} className="group cursor-pointer flex flex-col gap-2">
                                                        <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-indigo-500 transition-all shadow-md hover:shadow-indigo-500/20 transform hover:-translate-y-1">
                                                            <img src={`${TMDB_IMAGE_SMALL}${movie.poster_path}`} className="w-full h-full object-cover" alt={movie.title} />
                                                            <div className="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><PlusIcon className="w-8 h-8 text-white drop-shadow-md" /></div>
                                                        </div>
                                                        <div><p className="text-[11px] font-bold text-gray-200 leading-tight line-clamp-1 group-hover:text-indigo-400 transition-colors">{movie.title}</p>{movie.release_date && <p className="text-[10px] text-gray-500 mt-0.5">{movie.release_date.split('-')[0]}</p>}</div>
                                                    </div>
                                                ))}
                                                {searchResults.length === 0 && searchTerm.length > 2 && !isSearching && <div className="col-span-full text-center py-8 text-gray-500">Nenhum filme encontrado.</div>}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="p-4 border-t border-gray-800 bg-gray-800/30 shrink-0">
                                <button disabled={!createSelection.A || !createSelection.B || createSelection.A.id === createSelection.B.id} onClick={confirmCustomBattle} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:shadow-none transform hover:-translate-y-0.5 disabled:translate-y-0"><FireIcon className="w-5 h-5" /> Iniciar Duelo</button>
                                {createSelection.A && createSelection.B && createSelection.A.id === createSelection.B.id && <p className="text-red-400 text-xs text-center mt-2 font-bold animate-pulse">Ei! Escolha filmes diferentes para o duelo.</p>}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- MODAL DE RANKING (Mantido Igual) --- */}
            <AnimatePresence>
                {showRanking && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4">
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-gray-900 w-full md:max-w-2xl h-[90vh] md:h-[85vh] rounded-t-3xl md:rounded-3xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center sticky top-0 z-10">
                                <div><h2 className="text-xl font-black text-white flex items-center gap-2"><FireIcon className="w-5 h-5 text-orange-500" /> Batalhas Quentes</h2><p className="text-[10px] text-gray-400 mt-0.5">Os duelos mais votados da comunidade</p></div>
                                <button onClick={() => setShowRanking(false)} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors"><CloseIcon className="w-5 h-5 text-gray-400" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-950/50">
                                {loadingRanking ? <div className="py-20 flex flex-col items-center text-gray-500 gap-3"><Spinner /><p>Carregando placar...</p></div> : 
                                    rankingData.map((battle, index) => {
                                        const total = battle.totalVotes || 0;
                                        const percentA = total > 0 ? Math.round((battle.votesA / total) * 100) : 0;
                                        const percentB = 100 - percentA;
                                        const winnerA = percentA >= percentB;
                                        const isTop1 = index === 0;
                                        const rankColor = isTop1 ? 'text-yellow-400' : (index === 1 ? 'text-gray-300' : (index === 2 ? 'text-orange-400' : 'text-gray-600'));
                                        return (
                                            <div key={battle.id} onClick={() => handleSelectFromRanking(battle)} className={`group bg-gray-900/80 rounded-2xl p-4 border cursor-pointer transition-all hover:bg-gray-800 active:scale-95 ${isTop1 ? 'border-yellow-500/30 shadow-lg shadow-yellow-900/10' : 'border-gray-800'}`}>
                                                <div className="flex justify-between items-center mb-3">
                                                    <div className={`text-lg font-black ${rankColor} flex items-center gap-2`}>#{index + 1}{isTop1 && <CrownIcon className="w-4 h-4 text-yellow-400" />}</div>
                                                    <div className="flex items-center gap-2"><div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-black/40 px-2 py-1 rounded border border-white/5">{total} Votos</div><PlayIcon className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" /></div>
                                                </div>
                                                <div className="flex items-stretch gap-3 h-48 md:h-56">
                                                    <div className="flex-1 rounded-lg overflow-hidden border border-gray-800 relative bg-black"><RankingImage path={battle.movieA_Poster} alt={battle.movieA_Title} percentage={percentA} isWinner={winnerA} /></div>
                                                    <div className="flex flex-col items-center justify-center w-6"><div className="w-px h-full bg-gray-700/30"></div><span className="text-[10px] font-black text-gray-600 italic my-2">VS</span><div className="w-px h-full bg-gray-700/30"></div></div>
                                                    <div className="flex-1 rounded-lg overflow-hidden border border-gray-800 relative bg-black"><RankingImage path={battle.movieB_Poster} alt={battle.movieB_Title} percentage={percentB} isWinner={!winnerA} /></div>
                                                </div>
                                                <div className="flex justify-between text-[10px] text-gray-400 font-medium mt-2 px-1"><span className="w-[45%] truncate text-left">{battle.movieA_Title}</span><span className="w-[45%] truncate text-right">{battle.movieB_Title}</span></div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CineBattlePage;