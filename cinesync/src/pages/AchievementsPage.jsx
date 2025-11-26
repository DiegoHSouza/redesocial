import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { BADGES } from '../utils/gamification';
import { Spinner, ErrorMessage } from '../components/Common';
import { ArrowLeftIcon } from '../components/Icons';

const BadgeCard = ({ badge, isEarned }) => {
    const cardClasses = isEarned
        ? "bg-gray-800/50 border-yellow-500/30 shadow-lg shadow-yellow-900/20"
        : "bg-gray-800/20 border-gray-700/50 opacity-60 filter grayscale";

    const textClasses = isEarned ? "text-yellow-100" : "text-gray-400";
    const descClasses = isEarned ? "text-yellow-200/70" : "text-gray-500";

    return (
        <div className={`border rounded-xl p-4 flex flex-col items-center text-center transition-all duration-300 ${cardClasses}`}>
            <div className={`text-5xl mb-3 transition-transform duration-300 ${isEarned ? 'transform scale-110' : ''}`}>
                {badge.icon}
            </div>
            <h3 className={`font-bold text-base ${textClasses}`}>{badge.name}</h3>
            <p className={`text-xs mt-1 ${descClasses}`}>{badge.desc}</p>
        </div>
    );
};

const AchievementsPage = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const userRef = db.collection("users").doc(userId);
        const unsubscribe = userRef.onSnapshot(
            (doc) => {
                if (doc.exists) {
                    setUserData({ id: doc.id, ...doc.data() });
                } else {
                    setError("Usuário não encontrado.");
                }
                setLoading(false);
            },
            (err) => {
                console.error("Erro ao buscar usuário:", err);
                setError("Não foi possível carregar as conquistas.");
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, [userId]);

    if (loading) return <Spinner />;
    if (error) return <div className="p-8"><ErrorMessage message={error} /></div>;

    const allBadges = Object.values(BADGES);
    const earnedBadges = userData?.badges || [];

    return (
        <div className="container mx-auto p-4 md:p-8 text-white">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center mb-6">
                    <button 
                        onClick={() => navigate(`/profile/${userId}`)} 
                        className="p-2 rounded-full hover:bg-gray-700 transition-colors mr-4" 
                        aria-label="Voltar para o Perfil"
                    >
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold">Conquistas</h1>
                        <p className="text-gray-400">de {userData?.nome || 'Usuário'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {allBadges.map(badge => (
                        <BadgeCard 
                            key={badge.id}
                            badge={badge}
                            isEarned={earnedBadges.includes(badge.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AchievementsPage;