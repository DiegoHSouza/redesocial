import { getFunctions, httpsCallable } from "firebase/functions";
import firebase from 'firebase/compat/app';

// --- CONFIGURAÇÃO DE PONTOS ---
export const XP_POINTS = {
    REVIEW: 20,
    COMMENT: 5,
    LIKE_RECEIVED: 2,
    FOLLOW_RECEIVED: 5,
    CREATE_LIST: 10,
    USE_RANDOM_PICKER: 1,
    CREATE_CLUB_POST: 15,
};

// --- CONFIGURAÇÃO DE MEDALHAS (VISUAL) ---
// Os IDs devem bater exatamente com o backend
export const BADGES = {
    // --- CRÍTICO (Reviews) ---
    'critic_bronze': { id: 'critic_bronze', name: 'Crítico Iniciante', icon: '📝', desc: 'Fez sua primeira avaliação.' },
    'critic_silver': { id: 'critic_silver', name: 'Crítico Respeitado', icon: '✒️', desc: 'Escreveu 10 avaliações.' },
    'critic_gold':   { id: 'critic_gold',   name: 'Lenda da Crítica', icon: '🖋️', desc: 'Escreveu 50 avaliações. Sua opinião é lei!' },

    // --- POPULAR (Likes) ---
    'popular_bronze': { id: 'popular_bronze', name: 'Notado', icon: '👍', desc: 'Recebeu seu primeiro like.' },
    'popular_silver': { id: 'popular_silver', name: 'Famosinho', icon: '🌟', desc: 'Recebeu 10 curtidas somadas.' },
    'popular_gold':   { id: 'popular_gold',   name: 'Viral', icon: '🔥', desc: 'Recebeu 100 curtidas. Você está pegando fogo!' },

    // --- MARATONISTA (Listas) ---
    'marathon_bronze': { id: 'marathon_bronze', name: 'Organizado', icon: '📜', desc: 'Criou sua primeira lista.' },
    'marathon_silver': { id: 'marathon_silver', name: 'Curador', icon: '📂', desc: 'Criou 5 listas de filmes/séries.' },
    'marathon_gold':   { id: 'marathon_gold',   name: 'Bibliotecário', icon: '📚', desc: 'Criou 10 listas. Um acervo incrível!' },

    // --- SOCIAL (Seguidores) ---
    'social_bronze': { id: 'social_bronze', name: 'Sociável', icon: '👋', desc: 'Conquistou 5 seguidores.' },
    'social_silver': { id: 'social_silver', name: 'Influente', icon: '📢', desc: 'Conquistou 20 seguidores.' },
    'social_gold':   { id: 'social_gold',   name: 'Celebridade', icon: '👑', desc: 'Conquistou 50 seguidores. Todos te adoram!' },

    // --- COMUNIDADE ---
    'community_starter': { id: 'community_starter', name: 'Pioneiro', icon: '🏛️', desc: 'Criou seu primeiro post em um CineClub.' },
    
    // Mantendo IDs antigos para compatibilidade caso algum usuário antigo não recálcule
    'first_review': { id: 'first_review', name: 'Crítico Iniciante (Legado)', icon: '📝', desc: 'Medalha antiga de primeira avaliação.' },
};

// --- LÓGICA DE NÍVEIS (Sincronizada com o Backend) ---

export const calculateLevel = (xp) => {
    if (xp < 100) return 1;
    if (xp < 300) return 2;
    if (xp < 600) return 3;
    if (xp < 1000) return 4;
    // Fórmula para níveis infinitos após o nível 4
    return Math.floor((xp - 1000) / 500) + 5; 
};

export const getNextLevelXp = (currentLevel) => {
    if (currentLevel === 1) return 100;
    if (currentLevel === 2) return 300;
    if (currentLevel === 3) return 600;
    if (currentLevel === 4) return 1000;
    // Fórmula reversa para saber o XP do próximo nível
    return (currentLevel - 4) * 500 + 1000;
};

// Mantemos a função vazia apenas para não quebrar imports antigos
export const awardXP = async (userId, actionType) => {
    return; 
};

// --- ACIONADOR DO BACKEND ---
export const triggerUserRecalculation = async () => {
    try {
        const functions = getFunctions(firebase.app(), "southamerica-east1");
        const recalculateFunction = httpsCallable(functions, 'recalculateUserXP');
        
        console.log("Iniciando sincronização...");
        const result = await recalculateFunction();
        
        console.log("Sucesso:", result.data.message);
        return result.data;
    } catch (error) {
        console.error("Erro na sincronização:", error);
        throw error;
    }
};