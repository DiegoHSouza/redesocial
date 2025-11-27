import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

// Componentes
import ReviewCard from '../components/ReviewCard';
import ListCard from '../components/ListCard';
import AchievementCard from '../components/AchievementCard'; 
import AdSenseBlock from '../components/AdSenseBlock';
import { Spinner } from '../components/Common';

// Aumentamos para 15 para garantir que a tela sempre tenha scroll suficiente
const POSTS_PER_PAGE = 15;

const FeedPage = () => {
    const navigate = useNavigate();
    const { userData, currentUser } = useAuth();
    
    // Estados
    const [activeTab, setActiveTab] = useState('paraVoce');
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    
    // Armazena o último doc para paginação correta do Firestore
    const [lastDocs, setLastDocs] = useState({ review: null, list: null, achievement: null });
    
    const observer = useRef();

    // --- HELPER: Busca dados de uma coleção específica ---
    const fetchCollection = async (collectionName, type, followedUsers, lastDoc = null) => {
        let query = db.collection(collectionName);
        
        const dateField = collectionName === 'lists' ? 'createdAt' : 'timestamp';
        query = query.orderBy(dateField, "desc");

        if (activeTab === 'seguindo') {
            if (!followedUsers || followedUsers.length === 0) return { data: [], last: null };
            query = query.where("uidAutor", "in", followedUsers);
        }

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snap = await query.limit(POSTS_PER_PAGE).get();
        
        const data = snap.docs.map(doc => ({
            id: doc.id,
            type: type,
            timestamp: doc.data()[dateField], 
            ...doc.data(),
            _doc: doc // Guardamos a referência do doc para paginação precisa
        }));

        return { 
            data, 
            last: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
            count: snap.docs.length
        };
    };

    // --- HELPER: Popula autores ---
    const enrichWithAuthors = async (items) => {
        const authorIds = [...new Set(items.map(item => item.uidAutor))];
        const authors = {};

        if (authorIds.length > 0) {
            try {
                const authorPromises = authorIds.map(id => db.collection('users').doc(id).get());
                const authorDocs = await Promise.all(authorPromises);
                authorDocs.forEach(doc => {
                    if (doc.exists) authors[doc.id] = { uid: doc.id, ...doc.data() };
                });
            } catch (e) {
                console.error("Erro autores:", e);
            }
        }

        return items
            .map(item => ({ ...item, authorInfo: authors[item.uidAutor] }))
            .filter(item => item.authorInfo);
    };

    // --- CORE: Carregamento Inteligente ---
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

            // Pega os cursores atuais (ou null se for inicio)
            const cursors = currentLastDocs || { review: null, list: null, achievement: null };

            // 1. Busca Paralela
            const [reviewsRes, listsRes, achvRes] = await Promise.all([
                fetchCollection('reviews', 'review', followedUsers, cursors.review),
                fetchCollection('lists', 'list', followedUsers, cursors.list),
                fetchCollection('achievements', 'achievement', followedUsers, cursors.achievement)
            ]);

            // 2. Combina tudo
            let combinedFeed = [...reviewsRes.data, ...listsRes.data, ...achvRes.data];

            // 3. Filtro de "Para Você" (Esconde posts do próprio user)
            if (activeTab === 'paraVoce' && currentUser) {
                combinedFeed = combinedFeed.filter(item => item.uidAutor !== currentUser.uid);
            }

            // Filtro de duplicatas (segurança)
            if (!isInitialLoad) {
                const existingIds = new Set(feed.map(item => item.id));
                combinedFeed = combinedFeed.filter(item => !existingIds.has(item.id));
            }

            // 4. Ordenação
            combinedFeed.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            // CORREÇÃO CRÍTICA DO SCROLL INFINITO:
            // Verificamos se ALGUMA das coleções retornou o lote cheio. 
            // Se sim, significa que ainda tem lenha pra queimar no banco.
            const rawHitLimit = 
                reviewsRes.count === POSTS_PER_PAGE || 
                listsRes.count === POSTS_PER_PAGE || 
                achvRes.count === POSTS_PER_PAGE;

            // 5. Autores
            const finalFeed = await enrichWithAuthors(combinedFeed);

            // 6. Atualização de Estado
            if (isInitialLoad) {
                setFeed(finalFeed);
            } else {
                setFeed(prev => [...prev, ...finalFeed]);
            }

            // Atualiza os cursores para a próxima chamada
            setLastDocs({
                review: reviewsRes.last || cursors.review, // Se não veio nada novo, mantém o antigo
                list: listsRes.last || cursors.list,
                achievement: achvRes.last || cursors.achievement
            });
            
            // Define se tem mais com base no retorno RAW do banco, não no filtrado
            setHasMore(rawHitLimit);

            // AUTO-RECOVERY: Se filtramos tudo e sobrou 0 na tela, mas tem mais no banco, carrega de novo automaticamente
            if (finalFeed.length === 0 && rawHitLimit) {
                // Recursividade segura: chama loadMore (que chamará essa função novamente)
                // Usamos timeout 0 para jogar para o fim da pilha de execução e evitar travamento
                setTimeout(() => {
                   if(isInitialLoad) loadFeedData(false, {
                       review: reviewsRes.last, list: listsRes.last, achievement: achvRes.last
                   });
                }, 0);
            }

        } catch (error) {
            console.error("Feed error:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [activeTab, currentUser, userData, feed]);

    // --- EFFECT: Init ---
    useEffect(() => {
        setLoading(true);
        setFeed([]);
        setLastDocs({ review: null, list: null, achievement: null });
        setHasMore(true);
        loadFeedData(true, null);
    }, [activeTab]); 

    // --- HANDLER ---
    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        loadFeedData(false, lastDocs);
    };

    // --- OBSERVER ---
    const lastPostElementRef = useCallback(node => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore();
            }
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
                    {loading ? (
                        <Spinner />
                    ) : (
                        <>
                            {feed.length > 0 ? (
                                <div className="max-w-2xl mx-auto">
                                    {feed.map((item, index) => {
                                        const showAd = (index + 1) % 5 === 0;
                                        return (
                                            <React.Fragment key={`${item.id}-${index}`}>
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
                                                </motion.div>
                                                {showAd && <AdSenseBlock adSlot="YOUR_AD_SLOT_ID" />}
                                            </React.Fragment>
                                        )
                                    })}
                                </div>
                            ) : (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    className="text-center text-gray-400 bg-gray-800/50 border border-gray-700 p-12 rounded-2xl max-w-lg mx-auto"
                                >
                                    <h3 className="text-xl font-bold mb-2 text-white">
                                        {activeTab === 'seguindo' ? 'Seu feed está vazio!' : 'Ainda não há atividades.'}
                                    </h3>
                                    <p className="leading-relaxed mb-6">
                                        {activeTab === 'seguindo' 
                                            ? 'Siga seus amigos para ver as atividades deles.'
                                            : 'Explore filmes e crie a primeira review!'}
                                    </p>
                                    <button 
                                        onClick={() => navigate(activeTab === 'seguindo' ? '/friends' : '/home')} 
                                        className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-500 transition-all shadow-lg"
                                    >
                                        {activeTab === 'seguindo' ? 'Descobrir Pessoas' : 'Explorar Filmes'}
                                    </button>
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