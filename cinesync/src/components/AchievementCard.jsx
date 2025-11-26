import React from 'react';
import { Link } from 'react-router-dom';
import { BADGES } from '../utils/gamification'; 
import { getAvatarUrl } from './Common'; // Importamos APENAS getAvatarUrl

// Função auxiliar local para formatar data (substitui a que estava faltando)
const formatDate = (timestamp) => {
    if (!timestamp) return 'Recentemente';
    // Verifica se é um Timestamp do Firebase (tem .seconds) ou uma data normal
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const AchievementCard = ({ achievement }) => {
    const { authorInfo, badgeId, timestamp } = achievement;
    
    // Busca os dados visuais da medalha (ícone, nome, descrição)
    const badgeData = Object.values(BADGES).find(b => b.id === badgeId) || {
        icon: '🏆',
        name: 'Nova Conquista',
        desc: 'O usuário desbloqueou uma nova medalha!'
    };

    return (
        <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700 hover:border-yellow-500/30 transition-colors">
            {/* Cabeçalho do Card (Usuário) */}
            <div className="flex items-center mb-4">
                <Link to={`/profile/${achievement.uidAutor}`}>
                    <img 
                        src={getAvatarUrl(authorInfo?.foto, authorInfo?.nome)} 
                        alt={authorInfo?.nome || "Usuário"} 
                        className="w-10 h-10 rounded-full object-cover border border-gray-600 mr-3"
                    />
                </Link>
                <div>
                    <p className="text-sm text-gray-300">
                        <Link to={`/profile/${achievement.uidAutor}`} className="font-bold text-white hover:underline">
                            {authorInfo?.nome || "Usuário"}
                        </Link>
                        <span className="mx-1">desbloqueou uma conquista</span>
                    </p>
                    <p className="text-xs text-gray-500">
                        {formatDate(timestamp)}
                    </p>
                </div>
            </div>

            {/* Corpo do Card (A Medalha) */}
            <div className="bg-gradient-to-br from-gray-700/50 to-gray-900/50 rounded-lg p-6 flex flex-col items-center text-center border border-gray-600/50 relative overflow-hidden group">
                {/* Efeito de brilho ao fundo */}
                <div className="absolute inset-0 bg-yellow-500/5 blur-3xl rounded-full transform scale-0 group-hover:scale-150 transition-transform duration-700"></div>
                
                <div className="text-6xl mb-3 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">
                    {badgeData.icon}
                </div>
                
                <h3 className="text-xl font-bold text-yellow-400 mb-1">
                    {badgeData.name}
                </h3>
                
                <p className="text-gray-400 text-sm max-w-xs">
                    {badgeData.desc}
                </p>
            </div>
        </div>
    );
};

export default AchievementCard;