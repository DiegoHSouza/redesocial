import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

// Componentes
import ReviewCard from '../components/ReviewCard';
import ListCard from '../components/ListCard';
// CORREÇÃO: Importando da pasta components em vez de ./ (pasta atual)
import AchievementCard from '../components/AchievementCard'; 
import AdSenseBlock from '../components/AdSenseBlock';
import { Spinner } from '../components/Common';

const FeedPage = () => {
    const navigate = useNavigate();
    const { userData, currentUser } = useAuth();
    
    // Estados
    const [activeTab, setActiveTab] = useState('paraVoce');
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState(null); // Armazena o Timestamp para paginação
    
    const observer = useRef();
    const POSTS_PER_PAGE = 5;

    // --- CARREGAMENTO INICIAL ---
    useEffect(() => {
        setLoading(true);
        setFeed([]);
        setLastDoc(null);
        setHasMore(true);
    
        const fetchInitialFeed = async () => {
            let followedUsers = [];
            
            // Lógica da aba "Seguindo"
            if (activeTab === 'seguindo') {
                if (!currentUser || !userData?.seguindo || userData.seguindo.length === 0) {
                    setFeed([]);
                    setHasMore(false);
                    setLoading(false);
                    return;
                }
                followedUsers = userData.seguindo.slice(0, 30); // Limite do Firestore para operador 'in'
            }
    
            // 1. Buscar Reviews
            let reviewsQuery = db.collection("reviews");
            if (activeTab === 'seguindo') reviewsQuery = reviewsQuery.where("uidAutor", "in", followedUsers);
            const reviewsSnap = await reviewsQuery.orderBy("timestamp", "desc").limit(POSTS_PER_PAGE).get();
            const reviewsData = reviewsSnap.docs.map(doc => ({ id: doc.id, type: 'review', timestamp: doc.data().timestamp, ...doc.data() }));
    
            // 2. Buscar Listas
            let listsQuery = db.collection("lists");
            if (activeTab === 'seguindo') listsQuery = listsQuery.where("uidAutor", "in", followedUsers);
            const listsSnap = await listsQuery.orderBy("createdAt", "desc").limit(POSTS_PER_PAGE).get();
            // Normaliza 'createdAt' para 'timestamp' para ordenação unificada
            const listsData = listsSnap.docs.map(doc => ({ id: doc.id, type: 'list', timestamp: doc.data().createdAt, ...doc.data() }));
    
            // 3. Buscar Conquistas
            let achievementsQuery = db.collection("achievements");
            if (activeTab === 'seguindo') achievementsQuery = achievementsQuery.where("uidAutor", "in", followedUsers);
            const achievementsSnap = await achievementsQuery.orderBy("timestamp", "desc").limit(POSTS_PER_PAGE).get();
            const achievementsData = achievementsSnap.docs.map(doc => ({ id: doc.id, type: 'achievement', ...doc.data() }));

            // 4. Combinar e Ordenar
            let combinedFeed = [...reviewsData, ...listsData, ...achievementsData];
            combinedFeed.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            combinedFeed = combinedFeed.slice(0, POSTS_PER_PAGE);
    
            if (combinedFeed.length === 0) {
                 setFeed([]);
                 setHasMore(false);
                 setLoading(false);
                 return;
            }
    
            // 5. Popular autores (Populate)
            const authorIds = [...new Set(combinedFeed.map(item => item.uidAutor))];
            const authors = {};
            if (authorIds.length > 0) {
                try {
                    const authorPromises = authorIds.map(id => db.collection('users').doc(id).get());
                    const authorDocs = await Promise.all(authorPromises);
                    authorDocs.forEach(doc => { if (doc.exists) authors[doc.id] = doc.data(); });
                } catch (e) { console.error(e); }
            }
    
            const feedWithAuthors = combinedFeed
                .map(item => ({ ...item, authorInfo: authors[item.uidAutor] }))
                .filter(item => item.authorInfo); // Remove itens sem autor (segurança)
    
            setFeed(feedWithAuthors);
            
            // Define o cursor para a próxima página (Timestamp do último item)
            if (feedWithAuthors.length > 0) {
                setLastDoc(feedWithAuthors[feedWithAuthors.length - 1].timestamp);
            }
            setHasMore(feedWithAuthors.length === POSTS_PER_PAGE);
            setLoading(false);
        };
    
        fetchInitialFeed().catch(error => {
            console.error("Erro ao buscar feed:", error);
            setLoading(false);
        });

    }, [activeTab, userData, currentUser]);

    // --- CARREGAR MAIS (PAGINAÇÃO) ---
    const loadMore = useCallback(() => {
        if (loadingMore || !hasMore || !lastDoc) return;
        setLoadingMore(true);

        const fetchMoreData = async () => {
            let followedUsers = [];
            if (activeTab === 'seguindo') {
                if (!userData || !userData.seguindo || userData.seguindo.length === 0) {
                    setLoadingMore(false); return;
                }
                followedUsers = userData.seguindo.slice(0, 30);
            }

            // O cursor é o Timestamp do último item carregado
            const cursor = lastDoc;

            // 1. Mais Reviews
            let reviewsQuery = db.collection("reviews").orderBy("timestamp", "desc").startAfter(cursor).limit(POSTS_PER_PAGE);
            if (activeTab === 'seguindo') reviewsQuery = reviewsQuery.where("uidAutor", "in", followedUsers);
            const reviewsSnap = await reviewsQuery.get();
            const newReviews = reviewsSnap.docs.map(doc => ({ id: doc.id, type: 'review', timestamp: doc.data().timestamp, ...doc.data() }));

            // 2. Mais Listas
            let listsQuery = db.collection("lists").orderBy("createdAt", "desc").startAfter(cursor).limit(POSTS_PER_PAGE);
            if (activeTab === 'seguindo') listsQuery = listsQuery.where("uidAutor", "in", followedUsers);
            const listsSnap = await listsQuery.get();
            const newLists = listsSnap.docs.map(doc => ({ id: doc.id, type: 'list', timestamp: doc.data().createdAt, ...doc.data() }));

            // 3. Mais Conquistas
            let achievementsQuery = db.collection("achievements").orderBy("timestamp", "desc").startAfter(cursor).limit(POSTS_PER_PAGE);
            if (activeTab === 'seguindo') achievementsQuery = achievementsQuery.where("uidAutor", "in", followedUsers);
            const achievementsSnap = await achievementsQuery.get();
            const newAchievements = achievementsSnap.docs.map(doc => ({ id: doc.id, type: 'achievement', ...doc.data() }));

            // 4. Combinar
            let combinedNewFeed = [...newReviews, ...newLists, ...newAchievements];
            combinedNewFeed.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            combinedNewFeed = combinedNewFeed.slice(0, POSTS_PER_PAGE);

             if (combinedNewFeed.length === 0) {
                 setHasMore(false);
                 setLoadingMore(false);
                 return;
             }
             
             // 5. Popular Autores
             const authorIds = [...new Set(combinedNewFeed.map(item => item.uidAutor))];
             const authors = {};
             if (authorIds.length > 0) {
                 const authorPromises = authorIds.map(id => db.collection('users').doc(id).get());
                 const authorDocs = await Promise.all(authorPromises);
                 authorDocs.forEach(doc => {
                     if (doc.exists) authors[doc.id] = doc.data();
                 });
             }
             
             const newFeedWithAuthors = combinedNewFeed
                .map(item => ({ ...item, authorInfo: authors[item.uidAutor] }))
                .filter(item => item.authorInfo);

             setFeed(prev => [...prev, ...newFeedWithAuthors]);
             
             if (newFeedWithAuthors.length > 0) {
                setLastDoc(newFeedWithAuthors[newFeedWithAuthors.length - 1].timestamp);
             }
             setHasMore(newFeedWithAuthors.length === POSTS_PER_PAGE);
             setLoadingMore(false);
        };

        fetchMoreData().catch(error => { console.error("Erro ao carregar mais:", error); setLoadingMore(false); });
    }, [loadingMore, hasMore, lastDoc, activeTab, userData]);

    // Intersection Observer para Infinite Scroll
    const lastPostElementRef = useCallback(node => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) loadMore();
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore, loadMore]);

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
                    {loading ? (
                        <Spinner />
                    ) : (
                        <>
                            {feed.length > 0 ? (
                                <div className="max-w-2xl mx-auto">
                                    {feed.map((item, index) => {
                                        const showAd = (index + 1) % 5 === 0; // Mostra um anúncio a cada 5 posts
                                        return (
                                            <React.Fragment key={`${item.id}-${index}`}>
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: (index % POSTS_PER_PAGE) * 0.1 }}
                                                    ref={feed.length === index + 1 ? lastPostElementRef : null}
                                                    className={item.type === 'review' ? 'mb-8' : 'mb-6'}
                                                >
                                                    {item.type === 'review' && <ReviewCard review={item} activeTab={activeTab} />}
                                                    {item.type === 'list' && <ListCard list={item} />}
                                                    {item.type === 'achievement' && <AchievementCard achievement={item} />}
                                                </motion.div>
                                                {showAd && (
                                                    <AdSenseBlock adSlot="YOUR_AD_SLOT_ID" />
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </div>
                            ) : (
                                activeTab === 'seguindo' ? (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                        className="text-center text-gray-400 bg-gray-800/50 border border-gray-700 p-12 rounded-2xl max-w-lg mx-auto"
                                    >
                                        <h3 className="text-xl font-bold mb-2 text-white">Seu feed está vazio!</h3>
                                        <p className="leading-relaxed mb-6">Siga seus amigos para ver o que eles estão assistindo e avaliando.</p>
                                        <button onClick={() => navigate('/friends')} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-500 transition-all shadow-lg hover:shadow-indigo-500/20">
                                            Descobrir Pessoas
                                        </button>
                                    </motion.div>
                                ) : (
                                     <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                        className="text-center text-gray-400 bg-gray-800/50 border border-gray-700 p-12 rounded-2xl max-w-lg mx-auto"
                                    >
                                        <h3 className="text-xl font-bold mb-2 text-white">Nada por aqui.</h3>
                                        <p className="leading-relaxed mb-6">Parece que não há novas avaliações na plataforma. Que tal ser o primeiro?</p>
                                         <button onClick={() => navigate('/home')} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all shadow-lg">
                                            Explorar Filmes
                                        </button>
                                    </motion.div>
                                )
                            )}
                            
                            {loadingMore && <div className="py-8"><Spinner /></div>}
                            
                            {!loading && !hasMore && feed.length > 0 && (
                                <p className="text-center text-gray-600 mt-8 text-sm">Isso é tudo por enquanto.</p>
                            )}
                        </>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default FeedPage;