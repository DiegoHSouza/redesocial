import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import ReviewCard from '../components/ReviewCard';
import AdSenseBlock from '../components/AdSenseBlock'; // 1. Importe o componente de anúncio
import { Spinner } from '../components/Common';
import { motion, AnimatePresence } from 'framer-motion';

const FeedPage = () => {
    const navigate = useNavigate();
    const { userData, currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('paraVoce'); // 1. Mudar a aba padrão para 'paraVoce'
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDoc, setLastDoc] = useState(null);
    const observer = useRef();
    const POSTS_PER_PAGE = 10; // Aumentado para 10, como solicitado

    useEffect(() => {
        setLoading(true);
        setFeed([]);
        setLastDoc(null);
        setHasMore(true);

        let query;
        if (activeTab === 'seguindo') {
            if (!userData || !userData.seguindo || userData.seguindo.length === 0) {
                setFeed([]);
                setHasMore(false);
                setLoading(false);
                return;
            }
            // 2. Se não estiver logado na aba 'seguindo', não mostre nada.
            if (!currentUser) {
                setFeed([]);
                setLoading(false);
                return;
            }
            query = db.collection("reviews").where("uidAutor", "in", userData.seguindo.slice(0, 30));
        } else {
            query = db.collection("reviews");
        }
        
        const finalQuery = query.orderBy("timestamp", "desc").limit(POSTS_PER_PAGE);
        
        const unsubscribe = finalQuery.onSnapshot(async (snapshot) => {
            if (snapshot.empty) {
                setFeed([]);
                setHasMore(false);
                setLoading(false);
                return;
            }
        
            const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // FILTRO DE SEGURANÇA: Remove reviews sem ID de autor ou filme
            const validReviews = reviewsData.filter(r => r.uidAutor && r.movieId);

            const authorIds = [...new Set(validReviews.map(r => r.uidAutor))];
            const authors = {};
            
            if (authorIds.length > 0) {
                try {
                    const authorPromises = authorIds.map(id => db.collection('users').doc(id).get());
                    const authorDocs = await Promise.all(authorPromises);
                    authorDocs.forEach(doc => {
                        if (doc.exists) authors[doc.id] = doc.data();
                    });
                } catch (e) { console.error(e); }
            }
            
            // Mapeia e filtra novamente: Se não achou o autor no banco, não mostra a review
            const reviewsWithAuthors = validReviews
                .map(r => ({ ...r, authorInfo: authors[r.uidAutor] }))
                .filter(r => r.authorInfo); // <--- O PULO DO GATO: Remove reviews de usuários deletados

            setFeed(reviewsWithAuthors);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === POSTS_PER_PAGE);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar feed:", error);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [activeTab, userData, currentUser]);

    const loadMore = useCallback(() => {
        if (loadingMore || !hasMore || !lastDoc) return;
        setLoadingMore(true);

        let query;
        if (activeTab === 'seguindo') {
            if (!userData || !userData.seguindo || userData.seguindo.length === 0) {
                setLoadingMore(false); return;
            }
            query = db.collection("reviews").where("uidAutor", "in", userData.seguindo.slice(0, 30));
        } else {
            query = db.collection("reviews");
        }

        const finalQuery = query.orderBy("timestamp", "desc").startAfter(lastDoc).limit(POSTS_PER_PAGE);

         finalQuery.get().then(async (snapshot) => {
             if (snapshot.empty) {
                 setHasMore(false);
                 setLoadingMore(false);
                 return;
             }
             const newReviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
             
             // MESMO FILTRO DE SEGURANÇA AQUI
             const validReviews = newReviewsData.filter(r => r.uidAutor && r.movieId);
             
             const authorIds = [...new Set(validReviews.map(r => r.uidAutor))];
             const authors = {};
             if (authorIds.length > 0) {
                 const authorPromises = authorIds.map(id => db.collection('users').doc(id).get());
                 const authorDocs = await Promise.all(authorPromises);
                 authorDocs.forEach(doc => {
                     if (doc.exists) authors[doc.id] = doc.data();
                 });
             }
             
             const newReviewsWithAuthors = validReviews
                .map(r => ({ ...r, authorInfo: authors[r.uidAutor] }))
                .filter(r => r.authorInfo); // Remove órfãos

             setFeed(prev => [...prev, ...newReviewsWithAuthors]);
             setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
             setHasMore(snapshot.docs.length === POSTS_PER_PAGE);
             setLoadingMore(false);
         }).catch(error => {
             console.error("Erro ao carregar mais:", error);
             setLoadingMore(false);
         });
    }, [loadingMore, hasMore, lastDoc, activeTab, userData]);

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
                                <div className="space-y-8 max-w-2xl mx-auto">
                                    {feed.map((review, index) => {
                                        const showAd = (index + 1) % 5 === 0; // Mostra um anúncio a cada 5 posts
                                        return (
                                            <React.Fragment key={`${review.id}-${index}`}>
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: (index % POSTS_PER_PAGE) * 0.1 }}
                                                    ref={feed.length === index + 1 ? lastPostElementRef : null} 
                                                >
                                                    <ReviewCard review={review} />
                                                </motion.div>
                                                {showAd && (
                                                    <AdSenseBlock adSlot="YOUR_AD_SLOT_ID" /> // 2. Insira o anúncio
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