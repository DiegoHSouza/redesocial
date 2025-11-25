import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { tmdbApi, TMDB_IMAGE_URL } from '../services/tmdbApi';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, ErrorMessage } from '../components/Common';
import { StarIcon, PlusIcon } from '../components/Icons';
import ReviewCard from '../components/ReviewCard';
import ReviewModal from '../components/ReviewModal';
import AddToListModal from '../components/AddToListModal';

const DetailPage = () => {
    const { mediaType, mediaId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    const [details, setDetails] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showAddToListModal, setShowAddToListModal] = useState(false);
    const [existingReview, setExistingReview] = useState(null);
    
    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            setError('');
            setExistingReview(null);
            try {
                const data = await tmdbApi.getDetails(mediaType, mediaId);
                setDetails(data);
                
                const reviewsQuery = db.collection("reviews").where("movieId", "==", mediaId.toString());
                const unsubscribe = reviewsQuery.onSnapshot((snapshot) => {
                     const fetchedReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                     fetchedReviews.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
                     setReviews(fetchedReviews);

                     if (currentUser) {
                        const userReview = fetchedReviews.find(r => r.uidAutor === currentUser.uid);
                        setExistingReview(userReview || null);
                     }
                });

                setLoading(false);
                return () => unsubscribe();

            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };
        fetchDetails();
    }, [mediaId, mediaType, currentUser]);
    
    if (loading) return <Spinner/>;
    if (error) return <div className="p-8"><ErrorMessage message={error} /></div>;
    if (!details) return <div className="p-8"><ErrorMessage message="Não foi possível carregar os detalhes." /></div>;
    
    const title = details.title || details.name;
    const providers = details['watch/providers']?.results?.BR?.flatrate;
    const streamingProvider = providers && providers.length > 0 ? providers[0] : null;

    return (
        <div className="text-white">
            <div className="relative h-96 md:h-[500px]">
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent z-10"></div>
                <img src={`https://image.tmdb.org/t/p/original${details.backdrop_path}`} alt={title} className="w-full h-full object-cover"/>
                <div className="absolute bottom-0 left-0 p-4 md:p-8 z-20 container mx-auto w-full">
                    <h1 className="text-3xl md:text-5xl font-bold text-shadow">{title}</h1>
                     <div className="flex items-center space-x-4 mt-2 text-sm md:text-base">
                        <span className="text-yellow-400 font-bold text-lg flex items-center gap-1"><StarIcon className="w-5 h-5"/> {details.vote_average.toFixed(1)} / 10</span>
                        <span className="text-gray-200">{details.genres.map(g => g.name).join(', ')}</span>
                    </div>
                </div>
            </div>
            
            <div className="container mx-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <img src={`${TMDB_IMAGE_URL}${details.poster_path}`} alt={title} className="rounded-lg shadow-lg w-full"/>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                        {currentUser && (
                            <button onClick={() => setShowAddToListModal(true)} className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center">
                                <PlusIcon className="w-5 h-5 mr-2" /> Adicionar à Lista
                            </button>
                        )}
                    </div>
                     {streamingProvider && (
                        <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg flex items-center justify-center space-x-3">
                            <img src={`${TMDB_IMAGE_URL}${streamingProvider.logo_path}`} alt={streamingProvider.provider_name} className="h-8 w-8 object-contain rounded-md" title={streamingProvider.provider_name}/>
                            <div>
                                 <p className="text-xs text-gray-400">Disponível em:</p>
                                 <p className="font-semibold text-white">{streamingProvider.provider_name}</p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="md:col-span-2">
                    <h2 className="text-2xl font-bold">Sinopse</h2>
                    <p className="text-gray-300 mt-2 leading-relaxed">{details.overview || "Sinopse não disponível."}</p>
                    
                     <div className="mt-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold">Avaliações</h2>
                             {currentUser && (
                                <button onClick={() => setShowReviewModal(true)} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-opacity hover:opacity-90 text-sm">
                                    {existingReview ? 'Editar sua Avaliação' : 'Fazer uma avaliação'}
                                </button>
                            )}
                        </div>
                        <div className="space-y-4">
                            {reviews.length > 0 ? reviews.map(review => (
                                <ReviewCard key={review.id} review={review} isCompact={true} />
                            )) : <p className="text-gray-400">Ainda não há avaliações para este conteúdo.</p>}
                        </div>
                    </div>
                </div>
            </div>
            {showReviewModal && currentUser && (
                <ReviewModal movie={details} mediaType={mediaType} onClose={() => setShowReviewModal(false)} existingReview={existingReview} />
            )}
            {showAddToListModal && currentUser && (
                <AddToListModal movie={details} mediaType={mediaType} onClose={() => setShowAddToListModal(false)} />
            )}
        </div>
    );
};

export default DetailPage;