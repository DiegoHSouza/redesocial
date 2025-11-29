import { getFunctions, httpsCallable } from "firebase/functions";
import firebase from 'firebase/compat/app';

// --- CONFIGURAÇÃO DE PONTOS (Referência Visual apenas) ---
export const XP_POINTS = {
    REVIEW: 30,
    COMMENT: 10,
    LIKE_RECEIVED: 4,
    FOLLOW_RECEIVED: 5,
    CREATE_LIST: 10,
    USE_RANDOM_PICKER: 5,
    CREATE_CLUB_POST: 15,
};

// --- CONFIGURAÇÃO DE MEDALHAS (METADADOS VISUAIS) ---
// IMPORTANTE: Os campos 'limit' DEVEM ser idênticos ao 'BADGE_RULES' do Backend.
// Se mudar lá, tem que mudar aqui para a barra de progresso bater certo.
export const BADGES = {
    // --- CRÍTICO (Reviews) ---
    'critic_bronze': { 
        id: 'critic_bronze', 
        type: 'CRITIC', 
        rank: 1, 
        statField: 'reviews', // Deve bater com stats.reviews do Firestore
        limit: 1,            
        name: 'Crítico Iniciante', 
        icon: '📝', 
        desc: 'Deu o primeiro passo! 1 review feita.' 
    },
    'critic_silver': { 
        id: 'critic_silver', 
        type: 'CRITIC', 
        rank: 2, 
        statField: 'reviews',
        limit: 10,
        name: 'Crítico Respeitado', 
        icon: '✒️', 
        desc: 'Sua voz ecoa! 10 reviews feitas.' 
    },
    'critic_gold': { 
        id: 'critic_gold', 
        type: 'CRITIC', 
        rank: 3, 
        statField: 'reviews',
        limit: 50,
        name: 'Lenda da Crítica', 
        icon: '🖋️', 
        desc: 'Um ícone do cinema! 50 reviews feitas.' 
    },

    // --- POPULAR (Likes) ---
    'popular_bronze': { 
        id: 'popular_bronze', 
        type: 'POPULAR', 
        rank: 1, 
        statField: 'likes',
        limit: 1,
        name: 'Notado', 
        icon: '👍', 
        desc: 'Alguém gostou do que você disse! 1 like.' 
    },
    'popular_silver': { 
        id: 'popular_silver', 
        type: 'POPULAR', 
        rank: 2, 
        statField: 'likes',
        limit: 10,
        name: 'Famosinho', 
        icon: '🌟', 
        desc: 'Você tem fãs! 10 likes recebidos.' 
    },
    'popular_gold': { 
        id: 'popular_gold', 
        type: 'POPULAR', 
        rank: 3, 
        statField: 'likes',
        limit: 100,
        name: 'Viral', 
        icon: '🔥', 
        desc: 'A internet te ama! 100 likes recebidos.' 
    },

    // --- MARATONISTA (Listas) ---
    'marathon_bronze': { 
        id: 'marathon_bronze', 
        type: 'MARATHON', 
        rank: 1, 
        statField: 'lists',
        limit: 1,
        name: 'Organizado', 
        icon: '📜', 
        desc: 'Começou a organizar a bagunça. 1 lista.' 
    },
    'marathon_silver': { 
        id: 'marathon_silver', 
        type: 'MARATHON', 
        rank: 2, 
        statField: 'lists',
        limit: 5,
        name: 'Curador', 
        icon: '📂', 
        desc: 'Uma coleção invejável. 5 listas.' 
    },
    'marathon_gold': { 
        id: 'marathon_gold', 
        type: 'MARATHON', 
        rank: 3, 
        statField: 'lists',
        limit: 10,
        name: 'Bibliotecário', 
        icon: '📚', 
        desc: 'Um acervo histórico. 10 listas.' 
    },

    // --- SOCIAL (Seguidores) ---
    'social_bronze': { 
        id: 'social_bronze', 
        type: 'SOCIAL', 
        rank: 1, 
        statField: 'followers',
        limit: 5,
        name: 'Sociável', 
        icon: '👋', 
        desc: 'Fazendo amigos. 5 seguidores.' 
    },
    'social_silver': { 
        id: 'social_silver', 
        type: 'SOCIAL', 
        rank: 2, 
        statField: 'followers',
        limit: 20,
        name: 'Influente', 
        icon: '📢', 
        desc: 'As pessoas te escutam. 20 seguidores.' 
    },
    'social_gold': { 
        id: 'social_gold', 
        type: 'SOCIAL', 
        rank: 3, 
        statField: 'followers',
        limit: 50,
        name: 'Celebridade', 
        icon: '👑', 
        desc: 'Tapete vermelho para você! 50 seguidores.' 
    },

    // --- COMUNIDADE (Club Posts) ---
    'community_bronze': { 
        id: 'community_bronze', 
        type: 'COMMUNITY', 
        rank: 1, 
        statField: 'club_posts',
        limit: 1,
        name: 'Pioneiro', 
        icon: '🏛️', 
        desc: 'Fundou sua primeira discussão.' 
    },
    'community_silver': { 
        id: 'community_silver', 
        type: 'COMMUNITY', 
        rank: 2, 
        statField: 'club_posts',
        limit: 5,
        name: 'Debatedor', 
        icon: '💬', 
        desc: 'Agitando a comunidade! 5 posts criados.' 
    },
    'community_gold': { 
        id: 'community_gold', 
        type: 'COMMUNITY', 
        rank: 3, 
        statField: 'club_posts',
        limit: 20,
        name: 'Líder', 
        icon: '📢', 
        desc: 'Uma voz essencial nos clubes. 20 posts criados.' 
    },
    
    // Legado
    'first_review': { 
        id: 'first_review', 
        type: 'LEGACY', 
        rank: 0, 
        name: 'Crítico (Antigo)', 
        icon: '📝', 
        desc: 'Medalha legada.' 
    },
};

// --- LÓGICA DE NÍVEIS (Visualização) ---
export const calculateLevel = (xp) => {
    if (xp < 100) return 1;
    if (xp < 300) return 2;
    if (xp < 600) return 3;
    if (xp < 1000) return 4;
    return Math.floor((xp - 1000) / 500) + 5; 
};

export const getNextLevelXp = (currentLevel) => {
    if (currentLevel === 1) return 100;
    if (currentLevel === 2) return 300;
    if (currentLevel === 3) return 600;
    if (currentLevel === 4) return 1000;
    return (currentLevel - 4) * 500 + 1000;
};

// --- ACIONADORES BACKEND ---

/**
 * Aciona o sorteador e gerencia erros de Spam (Debounce)
 * Retorna { success: true, ... } ou lança erro tratado.
 */
export const registerRandomPickerXP = async () => {
    try {
        const functions = getFunctions(firebase.app(), "southamerica-east1");
        const pickerFunction = httpsCallable(functions, 'registerRandomPickerUsage');
        
        console.log("Registrando uso do sorteador...");
        const result = await pickerFunction();
        
        console.log("XP do sorteador atribuído com sucesso.");
        return result.data;

    } catch (error) {
        // Tratamento do erro específico de "Muitas tentativas"
        if (error.code === 'resource-exhausted') {
            console.warn("Spam detectado no sorteador. XP não computado.");
            throw new Error("WAIT_COOLDOWN"); // Identificador para o Front exibir Toast específico
        }
        
        console.error("Erro desconhecido no sorteador:", error);
        return null; 
    }
};

export const triggerUserRecalculation = async () => {
    try {
        const functions = getFunctions(firebase.app(), "southamerica-east1");
        const recalculateFunction = httpsCallable(functions, 'recalculateUserXP');
        
        console.log("Iniciando sincronização forçada...");
        const result = await recalculateFunction();
        
        console.log("Sincronização concluída:", result.data);
        return result.data;
    } catch (error) {
        console.error("Erro crítico na sincronização:", error);
        throw error;
    }
};