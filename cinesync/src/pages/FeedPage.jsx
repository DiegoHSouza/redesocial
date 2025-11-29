import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';

// Hooks
import { useShareCard } from '../hooks/useShareCard';

// Componentes
import ReviewCard from '../components/ReviewCard';
import ListCard from '../components/ListCard';
import AchievementCard from '../components/AchievementCard'; 
import AdSenseBlock from '../components/AdSenseBlock';
import { Spinner, getAvatarUrl } from '../components/Common';
import { FireIcon, StarIcon, ShareIcon } from '../components/Icons';
import ShareableBattleCard from '../components/ShareableBattleCard'; // ✅ NOVO: Importe o template oculto

// Configurações
const POSTS_PER_PAGE = 15;
const TMDB_IMAGE_SMALL = 'https://image.tmdb.org/t/p/w342';
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

// --- COMPONENTE DE BATALHA NO FEED (ATUALIZADO) ---
const FeedBattleCard = ({ battle }) => {
    const { currentUser, userData } = useAuth(); // ✅ NOVO: Precisamos de userData para o nome
    const [hasVoted, setHasVoted] = useState(false);
    const [stats, setStats] = useState({ 
        votesA: battle.votesA || 0, 
        votesB: battle.votesB || 0, 
        total: battle.totalVotes || 0 
    });
    const [userChoice, setUserChoice] = useState(null);
    const [friendsWhoVoted, setFriendsWhoVoted] = useState([]);

    // ✅ NOVO: Ref específica para o card oculto de compartilhamento
    const shareRef = useRef(null); 
    const { shareContent, isSharing } = useShareCard();

    const realBattleId = battle.id || `${Math.min(battle.movieA_Id, battle.movieB_Id)}_vs_${Math.max(battle.movieA_Id, battle.movieB_Id)}`;

    useEffect(() => {
        const initCard = async () => {
            if (!currentUser || battle.isNew) return;

            const voteRef = doc(db, 'battles', realBattleId, 'votes', currentUser.uid);
            const myVoteSnap = await getDoc(voteRef);
            if (myVoteSnap.exists()) {
                setHasVoted(true);
                setUserChoice(myVoteSnap.data().choiceId);
            }

            if (userData?.seguindo && userData.seguindo.length > 0) {
                try {
                    const votesRef = collection(db, 'battles', realBattleId, 'votes');
                    const q = query(votesRef, orderBy('timestamp', 'desc'), limit(20));
                    const votesSnap = await getDocs(q);
                    
                    const foundFriends = [];
                    for (const voteDoc of votesSnap.docs) {
                        const voterId = voteDoc.id;
                        if (userData.seguindo.includes(voterId)) {
                            const userSnap = await getDoc(doc(db, 'users', voterId));
                            if (userSnap.exists()) {
                                foundFriends.push({
                                    uid: voterId,
                                    name: userSnap.data().nome,
                                    photo: userSnap.data().foto,
                                    choice: voteDoc.data().choiceId
                                });
                            }
                        }
                    }
                    setFriendsWhoVoted(foundFriends);
                } catch (e) { console.error("Erro ao buscar social proof:", e); }
            }
        };
        initCard();
    }, [realBattleId, currentUser, battle.isNew, userData]);

    // ✅ NOVO: Função de Compartilhar Atualizada com Texto Personalizado
    const handleShare = (e) => {
        e.stopPropagation(); 
        
        const battleUrl = `${window.location.origin}/battle/${realBattleId}`; // Link direto para a batalha (se houver rota)
        
        // Lógica do texto personalizado
        let shareText = "";
        const myName = userData?.nome?.split(' ')[0] || "Alguém";

        if (userChoice) {
            const votedMovieTitle = userChoice === battle.movieA_Id ? battle.movieA_Title : battle.movieB_Title;
            shareText = `🎬 ${myName} votou em "${votedMovieTitle}" neste duelo épico no CineSync! Quem você escolhe: ${battle.movieA_Title} ou ${battle.movieB_Title}?`;
        } else {
             shareText = `🔥 Duelo Épico no CineSync! Quem vence: ${battle.movieA_Title} ou ${battle.movieB_Title}? Vote agora!`;
        }

        // Chama o hook passando a REF DO TEMPLATE OCULTO
        shareContent(shareRef, "Batalha CineSync", shareText, battleUrl);
    };

    const handleVote = async (choice) => {
        if (hasVoted) return;
        
        setHasVoted(true);
        setUserChoice(choice === 'A' ? battle.movieA_Id : battle.movieB_Id);
        setStats(prev => ({
            ...prev,
            votesA: choice === 'A' ? prev.votesA + 1 : prev.votesA,
            votesB: choice === 'B' ? prev.votesB + 1 : prev.votesB,
            total: prev.total + 1
        }));

        try {
            const batch = writeBatch(db);
            const battleRef = doc(db, 'battles', realBattleId);
            const voteRef = doc(db, 'battles', realBattleId, 'votes', currentUser.uid);

            const battleData = {
                movieA_Id: battle.movieA_Id, movieA_Title: battle.movieA_Title, movieA_Poster: battle.movieA_Poster,
                movieB_Id: battle.movieB_Id, movieB_Title: battle.movieB_Title, movieB_Poster: battle.movieB_Poster,
                votesA: choice === 'A' ? increment(1) : increment(0),
                votesB: choice === 'B' ? increment(1) : increment(0),
                totalVotes: increment(1),
                lastActivity: serverTimestamp()
            };

            batch.set(battleRef, battleData, { merge: true });
            batch.set(voteRef, { choiceId: choice === 'A' ? battle.movieA_Id : battle.movieB_Id, timestamp: serverTimestamp() });

            await batch.commit();
        } catch (error) { console.error("Erro ao votar:", error); }
    };

    const getPercent = (val) => stats.total === 0 ? 0 : Math.round((val / stats.total) * 100);

    return (
        <>
            {/* ✅ NOVO: Template Oculto para Geração de Imagem Profissional */}
            {/* Ele fica fora do fluxo normal, renderizado invisível */}
            <ShareableBattleCard 
                ref={shareRef}
                battle={battle}
                userChoice={userChoice}
                userName={userData?.nome?.split(' ')[0]} // Passa o primeiro nome do usuário
            />

            {/* Card Visível no Feed (o cardRef foi removido daqui pois não vamos mais printar este) */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden mb-10 shadow-2xl relative group animate-fade-in-up">
                {/* Header */}
                <div className="bg-gray-950 px-5 py-4 flex items-center justify-between border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        {battle.isNew ? (
                            <div className="bg-yellow-500/20 border border-yellow-500/30 px-3 py-1 rounded-full flex items-center gap-2">
                                <StarIcon className="w-4 h-4 text-yellow-400 animate-pulse" />
                                <span className="text-xs font-black text-yellow-100 uppercase tracking-widest">Inédita</span>
                            </div>
                        ) : (
                            <div className="bg-orange-500/20 border border-orange-500/30 px-3 py-1 rounded-full flex items-center gap-2">
                                <FireIcon className="w-4 h-4 text-orange-500" />
                                <span className="text-xs font-black text-orange-100 uppercase tracking-widest">Duelo</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Social Proof Text */}
                        <div className="flex items-center gap-2">
                            {friendsWhoVoted.length > 0 ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex -space-x-2">
                                        {friendsWhoVoted.slice(0, 3).map(friend => (
                                            <img key={friend.uid} src={getAvatarUrl(friend.photo)} className="w-6 h-6 rounded-full border-2 border-gray-900" title={`${friend.name} votou`} alt={friend.name} />
                                        ))}
                                    </div>
                                    <span className="text-xs text-gray-400 font-bold hidden sm:inline">
                                        {friendsWhoVoted[0].name.split(' ')[0]} {friendsWhoVoted.length > 1 ? `e +${friendsWhoVoted.length - 1}` : 'votou'}
                                    </span>
                                </div>
                            ) : (
                                <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                                    {battle.isNew && !hasVoted ? 'Seja o primeiro' : `${stats.total} Votos`}
                                </div>
                            )}
                        </div>

                        {/* Botão de Compartilhar */}
                        <button 
                            onClick={handleShare}
                            disabled={isSharing}
                            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
                            title="Compartilhar Batalha"
                        >
                            {isSharing ? <Spinner size="xs" /> : <ShareIcon className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                
                {/* Arena Visual Visível */}
                <div className="flex h-72 sm:h-96 relative">
                    {/* LADO A */}
                    <div onClick={() => handleVote('A')} className="flex-1 relative cursor-pointer overflow-hidden border-r-2 border-gray-950 group/side">
                        <img src={`${TMDB_IMAGE_SMALL}${battle.movieA_Poster}`} className={`w-full h-full object-cover transition-all duration-700 transform group-hover/side:scale-110 ${hasVoted && userChoice !== battle.movieA_Id ? 'grayscale opacity-30' : ''}`} alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                        
                        {/* Avatar do Amigo Lado A */}
                        {hasVoted && friendsWhoVoted.some(f => f.choice === battle.movieA_Id) && (
                            <div className="absolute top-3 left-3 flex flex-col gap-1 animate-fade-in">
                                {friendsWhoVoted.filter(f => f.choice === battle.movieA_Id).slice(0, 2).map(f => (
                                    <div key={f.uid} className="flex items-center gap-1 bg-black/60 backdrop-blur-sm pr-2 rounded-full p-0.5 border border-white/10">
                                        <img src={getAvatarUrl(f.photo)} className="w-5 h-5 rounded-full" alt=""/>
                                        <span className="text-[9px] text-white font-bold max-w-[60px] truncate">{f.name.split(' ')[0]}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 flex flex-col justify-end h-full">
                            {hasVoted ? (
                                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="mb-2"><span className={`text-4xl md:text-5xl font-black drop-shadow-lg ${userChoice === battle.movieA_Id ? 'text-blue-400' : 'text-gray-500'}`}>{getPercent(stats.votesA)}%</span></motion.div>
                            ) : (
                                <div className="absolute inset-0 bg-blue-600/30 opacity-0 group-hover/side:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]"><span className="bg-black/80 px-6 py-2 rounded-full text-sm font-black text-white uppercase tracking-widest border border-blue-400 transform scale-110">Votar</span></div>
                            )}
                            <h3 className="text-lg md:text-2xl font-black text-white leading-tight drop-shadow-xl line-clamp-3">{battle.movieA_Title}</h3>
                        </div>
                    </div>
                    
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                        <div className="bg-gray-950 rounded-full w-12 h-12 flex items-center justify-center border-4 border-gray-800 shadow-2xl"><span className="text-sm font-black text-gray-500 italic">VS</span></div>
                    </div>
                    
                    {/* LADO B */}
                    <div onClick={() => handleVote('B')} className="flex-1 relative cursor-pointer overflow-hidden group/side">
                        <img src={`${TMDB_IMAGE_SMALL}${battle.movieB_Poster}`} className={`w-full h-full object-cover transition-all duration-700 transform group-hover/side:scale-110 ${hasVoted && userChoice !== battle.movieB_Id ? 'grayscale opacity-30' : ''}`} alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                        {/* Avatar do Amigo Lado B */}
                        {hasVoted && friendsWhoVoted.some(f => f.choice === battle.movieB_Id) && (
                            <div className="absolute top-3 right-3 flex flex-col gap-1 items-end animate-fade-in">
                                {friendsWhoVoted.filter(f => f.choice === battle.movieB_Id).slice(0, 2).map(f => (
                                    <div key={f.uid} className="flex flex-row-reverse items-center gap-1 bg-black/60 backdrop-blur-sm pl-2 p-0.5 rounded-full border border-white/10">
                                        <img src={getAvatarUrl(f.photo)} className="w-5 h-5 rounded-full" alt=""/>
                                        <span className="text-[9px] text-white font-bold max-w-[60px] truncate">{f.name.split(' ')[0]}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="absolute bottom-0 right-0 w-full p-4 md:p-6 flex flex-col justify-end h-full text-right">
                            {hasVoted ? (
                                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="mb-2"><span className={`text-4xl md:text-5xl font-black drop-shadow-lg ${userChoice === battle.movieB_Id ? 'text-red-400' : 'text-gray-500'}`}>{getPercent(stats.votesB)}%</span></motion.div>
                            ) : (
                                <div className="absolute inset-0 bg-red-600/30 opacity-0 group-hover/side:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]"><span className="bg-black/80 px-6 py-2 rounded-full text-sm font-black text-white uppercase tracking-widest border border-red-400 transform scale-110">Votar</span></div>
                            )}
                            <h3 className="text-lg md:text-2xl font-black text-white leading-tight drop-shadow-xl line-clamp-3">{battle.movieB_Title}</h3>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- FEEDPAGE (MANTIDA INTACTA, apenas fechando o componente) ---
const FeedPage = () => {
    // ... (todo o código do FeedPage que você já tinha e que eu mantive igual nas respostas anteriores)
    const navigate = useNavigate();
    const { userData, currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('paraVoce');
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDocs, setLastDocs] = useState({ review: null, list: null, achievement: null, battle: null });
    const observer = useRef();

    // Helpers e Fetchs (Mantidos iguais ao anterior)
    const generateFreshBattle = async () => {
        try {
            const genres = [28, 12, 35, 27, 878, 53];
            const randomGenre = genres[Math.floor(Math.random() * genres.length)];
            const randomPage = Math.floor(Math.random() * 20) + 1;
            
            const res = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${randomGenre}&language=pt-BR&sort_by=popularity.desc&vote_count.gte=300&page=${randomPage}`);
            const data = await res.json();
            const valid = data.results.filter(m => m.poster_path && m.backdrop_path);
            
            if (valid.length >= 2) {
                const shuffled = valid.sort(() => 0.5 - Math.random()).slice(0, 2);
                return {
                    type: 'battle',
                    isNew: true, 
                    id: null, 
                    timestamp: { seconds: Date.now() / 1000 }, 
                    movieA_Id: shuffled[0].id, movieA_Title: shuffled[0].title, movieA_Poster: shuffled[0].poster_path,
                    movieB_Id: shuffled[1].id, movieB_Title: shuffled[1].title, movieB_Poster: shuffled[1].poster_path,
                    votesA: 0, votesB: 0, totalVotes: 0
                };
            }
        } catch (e) { console.error(e); }
        return null;
    };

    const fetchCollection = async (collectionName, type, followedUsers, lastDoc = null) => {
        let queryRef = db.collection(collectionName);
        const dateField = collectionName === 'lists' ? 'createdAt' : (collectionName === 'battles' ? 'lastActivity' : 'timestamp');
        queryRef = queryRef.orderBy(dateField, "desc");

        if (activeTab === 'seguindo' && collectionName !== 'battles') {
            if (!followedUsers || followedUsers.length === 0) return { data: [], last: null };
            queryRef = queryRef.where("uidAutor", "in", followedUsers);
        }
        if (lastDoc) queryRef = queryRef.startAfter(lastDoc);

        const limitCount = collectionName === 'battles' ? 1 : POSTS_PER_PAGE;
        const snap = await queryRef.limit(limitCount).get();
        
        const data = snap.docs.map(doc => ({
            id: doc.id,
            type: type,
            timestamp: doc.data()[dateField], 
            ...doc.data(),
            _doc: doc 
        }));

        return { data, last: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null, count: snap.docs.length };
    };

    const enrichWithAuthors = async (items) => {
        const authorIds = [...new Set(items.filter(i => i.type !== 'battle').map(item => item.uidAutor))];
        const authors = {};
        if (authorIds.length > 0) {
            try {
                const authorPromises = authorIds.map(id => db.collection('users').doc(id).get());
                const authorDocs = await Promise.all(authorPromises);
                authorDocs.forEach(doc => {
                    if (doc.exists) authors[doc.id] = { uid: doc.id, ...doc.data() };
                });
            } catch (e) { console.error(e); }
        }
        return items.map(item => {
            if (item.type === 'battle') return item;
            return { ...item, authorInfo: authors[item.uidAutor] };
        }).filter(item => item.type === 'battle' || item.authorInfo);
    };

    const loadFeedData = useCallback(async (isInitialLoad = true, currentLastDocs = null) => {
        try {
            let followedUsers = [];
            if (activeTab === 'seguindo') {
                if (!currentUser || !userData?.seguindo || userData.seguindo.length === 0) {
                    if (isInitialLoad) { setFeed([]); setHasMore(false); setLoading(false); }
                    else { setLoadingMore(false); }
                    return;
                }
                followedUsers = userData.seguindo.slice(0, 30);
            }
            const cursors = currentLastDocs || { review: null, list: null, achievement: null, battle: null };
            const shouldGenerateFresh = Math.random() > 0.5; 
            const promises = [
                fetchCollection('reviews', 'review', followedUsers, cursors.review),
                fetchCollection('lists', 'list', followedUsers, cursors.list),
                fetchCollection('achievements', 'achievement', followedUsers, cursors.achievement),
            ];
            if (!shouldGenerateFresh) promises.push(fetchCollection('battles', 'battle', null, cursors.battle));

            const results = await Promise.all(promises);
            const [reviewsRes, listsRes, achvRes] = results;
            let battleRes = !shouldGenerateFresh ? results[3] : { data: [], last: cursors.battle }; 

            let mainPosts = [...reviewsRes.data, ...listsRes.data, ...achvRes.data];
            if (activeTab === 'paraVoce' && currentUser) mainPosts = mainPosts.filter(item => item.uidAutor !== currentUser.uid);
            if (!isInitialLoad) {
                const existingIds = new Set(feed.map(item => item.id));
                mainPosts = mainPosts.filter(item => !existingIds.has(item.id));
            }
            mainPosts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            const enrichedPosts = await enrichWithAuthors(mainPosts);

            let battleToInject = null;
            if (battleRes.data.length > 0) battleToInject = battleRes.data[0];
            else if (shouldGenerateFresh) battleToInject = await generateFreshBattle();

            const finalBatch = [...enrichedPosts];
            if (battleToInject) {
                if (finalBatch.length >= 10) finalBatch.splice(10, 0, battleToInject); 
                else finalBatch.push(battleToInject);
            }

            const rawHitLimit = reviewsRes.count === POSTS_PER_PAGE || listsRes.count === POSTS_PER_PAGE;
            if (isInitialLoad) setFeed(finalBatch);
            else setFeed(prev => [...prev, ...finalBatch]);

            setLastDocs({
                review: reviewsRes.last || cursors.review,
                list: listsRes.last || cursors.list,
                achievement: achvRes.last || cursors.achievement,
                battle: battleRes.last || cursors.battle 
            });
            setHasMore(rawHitLimit);

            if (finalBatch.length === 0 && rawHitLimit) {
                setTimeout(() => {
                   if(isInitialLoad) loadFeedData(false, {
                       review: reviewsRes.last, list: listsRes.last, achievement: achvRes.last, battle: battleRes.last
                   });
                }, 0);
            }
        } catch (error) { console.error("Feed error:", error); } 
        finally { setLoading(false); setLoadingMore(false); }
    }, [activeTab, currentUser, userData, feed]);

    useEffect(() => {
        setLoading(true);
        setFeed([]);
        setLastDocs({ review: null, list: null, achievement: null, battle: null });
        setHasMore(true);
        loadFeedData(true, null);
    }, [activeTab]); 

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        loadFeedData(false, lastDocs);
    };

    const lastPostElementRef = useCallback(node => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) loadMore();
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore]);

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex justify-center mb-8">
                <div className="flex space-x-1 bg-gray-800/80 p-1.5 rounded-xl relative shadow-inner border border-gray-700/50">
                    {['seguindo', 'paraVoce'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`${
                                activeTab === tab ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                            } relative z-10 px-8 py-2.5 text-sm font-bold transition-colors w-32 rounded-lg`}
                        >
                            {tab === 'seguindo' ? 'Seguindo' : 'Para Você'}
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTabPill"
                                    className="absolute inset-0 bg-indigo-600 rounded-lg -z-10 shadow-md"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                        </button>
                    ))}
                </div>
            </div>
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="min-h-[200px]"
                >
                    {loading ? <Spinner /> : (
                        <>
                            {feed.length > 0 ? (
                                <div className="max-w-2xl mx-auto">
                                    {feed.map((item, index) => {
                                        const showAd = (index + 1) % 5 === 0 && item.type !== 'battle';
                                        return (
                                            <React.Fragment key={`${item.id || 'battle'}-${index}`}>
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.1 }}
                                                    ref={feed.length === index + 1 ? lastPostElementRef : null}
                                                    className={item.type === 'review' ? 'mb-8' : 'mb-6'}
                                                >
                                                    {item.type === 'review' && <ReviewCard review={item} activeTab={activeTab} />}
                                                    {item.type === 'list' && <ListCard list={item} />}
                                                    {item.type === 'achievement' && <AchievementCard achievement={item} />}
                                                    {item.type === 'battle' && <FeedBattleCard battle={item} />}
                                                </motion.div>
                                                {showAd && <AdSenseBlock adSlot="5370707759" adFormat="fluid" layoutKey="-fb+5w+4e-db+86" />}
                                            </React.Fragment>
                                        )
                                    })}
                                </div>
                            ) : (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    className="text-center text-gray-400 bg-gray-800/50 border border-gray-700 p-12 rounded-2xl max-w-lg mx-auto"
                                >
                                    <h3 className="text-xl font-bold mb-2 text-white">{activeTab === 'seguindo' ? 'Seu feed está vazio!' : 'Ainda não há atividades.'}</h3>
                                    <p className="leading-relaxed mb-6">{activeTab === 'seguindo' ? 'Siga seus amigos para ver as atividades deles.' : 'Explore filmes e crie a primeira review!'}</p>
                                    <button onClick={() => navigate(activeTab === 'seguindo' ? '/friends' : '/home')} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-500 transition-all shadow-lg">{activeTab === 'seguindo' ? 'Descobrir Pessoas' : 'Explorar Filmes'}</button>
                                </motion.div>
                            )}
                            {loadingMore && <div className="py-8"><Spinner /></div>}
                        </>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default FeedPage;