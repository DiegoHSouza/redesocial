import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore'; // Atualizado para sintaxe modular v9
import { BADGES } from '../utils/gamification';
import { Spinner, ErrorMessage } from '../components/Common';
import { ArrowLeftIcon, LockIcon, TrophyIcon, StarIcon } from '../components/Icons'; // Certifique-se de ter esses ícones
import { motion } from 'framer-motion'; // Requer: npm install framer-motion

const BadgeCard = ({ badge, isEarned, index }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`relative group rounded-2xl p-[1px] overflow-hidden transition-all duration-300 ${
                isEarned 
                ? 'hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/20' 
                : 'opacity-70'
            }`}
        >
            {/* Borda Gradiente Animada (Apenas para Conquistados) */}
            <div className={`absolute inset-0 ${
                isEarned 
                ? 'bg-gradient-to-br from-yellow-400 via-orange-500 to-yellow-600 opacity-100' 
                : 'bg-gray-800 border border-gray-700'
            }`} />

            {/* Conteúdo do Card */}
            <div className={`relative h-full flex flex-col items-center text-center p-6 rounded-2xl ${
                isEarned 
                ? 'bg-gray-900/95 backdrop-blur-xl' 
                : 'bg-gray-950/95 grayscale'
            }`}>
                
                {/* Ícone com Glow */}
                <div className="relative mb-4">
                    <div className={`text-6xl filter drop-shadow-lg transition-transform duration-500 ${isEarned ? 'group-hover:scale-110 group-hover:rotate-3' : ''}`}>
                        {badge.icon}
                    </div>
                    
                    {/* Overlay de Cadeado para Bloqueados */}
                    {!isEarned && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/60 backdrop-blur-[2px] rounded-full">
                            <LockIcon className="w-8 h-8 text-gray-400" />
                        </div>
                    )}
                </div>

                <h3 className={`font-bold text-lg mb-1 ${isEarned ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500' : 'text-gray-500'}`}>
                    {badge.name}
                </h3>
                
                <p className="text-xs text-gray-400 leading-relaxed max-w-[180px]">
                    {badge.desc}
                </p>

                {/* Efeito de Brilho no Topo */}
                {isEarned && (
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />
                )}
            </div>
        </motion.div>
    );
};

const AchievementsPage = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Atualizado para sintaxe modular do Firestore v9+ para consistência
        const userRef = doc(db, "users", userId);
        const unsubscribe = onSnapshot(
            userRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    setUserData({ id: docSnap.id, ...docSnap.data() });
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
    if (error) return <div className="p-8 flex justify-center"><ErrorMessage message={error} /></div>;

    const allBadges = Object.values(BADGES);
    const earnedBadges = userData?.badges || [];
    const progressPercentage = Math.round((earnedBadges.length / allBadges.length) * 100);

    // Calcular Nível baseado em badges (Exemplo simples: 1 badge = 100xp)
    const currentLevel = Math.floor(earnedBadges.length / 3) + 1;
    const nextLevelBadges = currentLevel * 3;
    const badgesNeeded = nextLevelBadges - earnedBadges.length;

    return (
        <div className="min-h-screen bg-gray-950 text-white font-sans pb-20 overflow-x-hidden">
            
            {/* --- HERO SECTION COM BACKGROUND --- */}
            <div className="relative bg-gray-900 border-b border-gray-800 pb-12 pt-24 px-4 overflow-hidden">
                {/* Efeitos de Fundo (Glows) */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] pointer-events-none" />
                <div className="absolute top-10 right-1/4 w-64 h-64 bg-yellow-500/10 rounded-full blur-[96px] pointer-events-none" />

                <div className="container mx-auto max-w-5xl relative z-10">
                    <button 
                        onClick={() => navigate(`/profile/${userId}`)} 
                        className="absolute top-0 left-0 p-2 text-gray-400 hover:text-white transition-colors flex items-center gap-2 group"
                    >
                        <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-bold">Voltar ao Perfil</span>
                    </button>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 mt-8">
                        {/* Info do Usuário */}
                        <div className="text-center md:text-left">
                            <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">
                                Sala de <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Troféus</span>
                            </h1>
                            <p className="text-gray-400 text-lg">
                                Conquistas de <span className="text-white font-bold">{userData?.nome}</span>
                            </p>
                        </div>

                        {/* Card de Nível (Stats) */}
                        <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700 p-6 rounded-2xl flex items-center gap-6 min-w-[300px] shadow-xl">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center bg-gray-900">
                                    <span className="text-3xl font-black text-white">{currentLevel}</span>
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
                                    LVL
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-300 font-bold">Progresso Total</span>
                                    <span className="text-yellow-400 font-bold">{progressPercentage}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercentage}%` }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-600"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {badgesNeeded > 0 
                                        ? `Faltam ${badgesNeeded} badges para o próximo nível` 
                                        : "Nível Máximo Atingido!"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- GRID DE BADGES --- */}
            <div className="container mx-auto max-w-5xl px-4 py-12">
                
                {/* Filtros / Tabs (Visual apenas por enquanto) */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
                    <button className="px-4 py-2 rounded-full bg-gray-800 text-white font-bold text-sm border border-gray-700 whitespace-nowrap">
                        Todas ({allBadges.length})
                    </button>
                    <button className="px-4 py-2 rounded-full bg-gray-900 text-gray-400 hover:text-white font-bold text-sm border border-transparent hover:border-gray-700 whitespace-nowrap transition-all">
                        Desbloqueadas ({earnedBadges.length})
                    </button>
                    <button className="px-4 py-2 rounded-full bg-gray-900 text-gray-400 hover:text-white font-bold text-sm border border-transparent hover:border-gray-700 whitespace-nowrap transition-all">
                        Raras
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {allBadges.map((badge, index) => (
                        <BadgeCard 
                            key={badge.id}
                            badge={badge}
                            index={index}
                            isEarned={earnedBadges.includes(badge.id)}
                        />
                    ))}
                </div>

                {earnedBadges.length === 0 && (
                    <div className="text-center py-16 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                        <TrophyIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">Nenhuma conquista ainda</h3>
                        <p className="text-gray-500 mt-2">Interaja com o app, avalie filmes e crie listas para ganhar troféus!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AchievementsPage;