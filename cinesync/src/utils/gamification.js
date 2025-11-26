import { db } from '../services/firebaseConfig';
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

// Configuração de Níveis
export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5000, 6500, 8000, 10000];

// Configuração de Medalhas
export const BADGES = {
    'FIRST_REVIEW': { id: 'first_review', name: 'Crítico Iniciante', icon: '📝', desc: 'Fez sua primeira avaliação' },
    'POPULAR': { id: 'popular', name: 'Famosinho', icon: '🌟', desc: 'Recebeu 10 curtidas em suas avaliações' },
    'MARATHON': { id: 'marathon', name: 'Maratonista', icon: '🍿', desc: 'Criou 3 listas de filmes/séries' },
    'SOCIAL': { id: 'social', name: 'Sociável', icon: '👋', desc: 'Seguiu 5 pessoas' },
    'COMMUNITY_STARTER': { id: 'community_starter', name: 'Pioneiro', icon: '🏛️', desc: 'Criou seu primeiro post em um CineClub' },
};

// Calcula nível baseado no XP total
export const calculateLevel = (xp) => {
    let level = 0;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
        else break;
    }
    return level;
};

// Pega quanto XP precisa para o próximo nível
export const getNextLevelXp = (currentLevel) => {
    return LEVEL_THRESHOLDS[currentLevel] || 10000;
};

// Dá XP para o usuário (Transação segura)
export const awardXP = async (userId, actionType, context = {}) => {
    if (!userId) return;
    
    const amount = XP_POINTS[actionType];
    if (!amount) {
        console.warn(`Tipo de ação de XP desconhecido: ${actionType}`);
        return;
    }

    const userRef = db.collection('users').doc(userId);
    
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            if (!doc.exists) return;

            const data = doc.data();
            const currentXP = data.xp || 0;
            const currentBadges = data.badges || [];

            let newXP = currentXP + amount;
            let newBadges = [...currentBadges];

            // --- LÓGICA DE MEDALHAS EM TEMPO REAL ---
            // context.reviewCount é o número de reviews ANTES desta nova.
            if (actionType === 'REVIEW' && context.reviewCount === 0 && !newBadges.includes(BADGES.FIRST_REVIEW.id)) {
                newBadges.push(BADGES.FIRST_REVIEW.id);
            }
            // context.listCount é o número de listas ANTES desta nova.
            if (actionType === 'CREATE_LIST' && context.listCount === 2 && !newBadges.includes(BADGES.MARATHON.id)) {
                newBadges.push(BADGES.MARATHON.id);
            }
            // context.clubPostCount é o número de posts ANTES deste novo.
            if (actionType === 'CREATE_CLUB_POST' && context.clubPostCount === 0 && !newBadges.includes(BADGES.COMMUNITY_STARTER.id)) {
                newBadges.push(BADGES.COMMUNITY_STARTER.id);
            }
            // context.followingCount é o número de pessoas que o usuário seguia ANTES desta nova.
            if (actionType === 'FOLLOW_GIVEN' && context.followingCount === 4 && !newBadges.includes(BADGES.SOCIAL.id)) {
                newBadges.push(BADGES.SOCIAL.id);
            }
            // Medalhas como 'POPULAR' e 'SOCIAL' são mais fáceis de gerenciar em Cloud Functions ou na ação que as dispara (seguir, curtir).

            transaction.update(userRef, { 
                xp: newXP,
                badges: newBadges,
            });
        });
    } catch (error) {
        console.error("Erro ao dar XP:", error);
    }
};

// --- A FUNÇÃO QUE ESTAVA FALTANDO ---
// Recalcula todo o XP do zero baseado no histórico (para corrigir contas antigas)
export const recalculateUserXP = async (userId) => {
    if (!userId) return;

    try {
        // --- 1. BUSCAR DADOS ATUAIS DO USUÁRIO ---
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) throw new Error("Usuário não encontrado para recalcular.");
        const currentXP = userDoc.data().xp || 0;

        // 1. Conta todas as reviews feitas por este usuário
        let reviewsSnap;
        try {
            reviewsSnap = await db.collection('reviews').where('uidAutor', '==', userId).get();
        } catch (err) {
            console.error("Erro ao ler reviews:", err);
            throw new Error("Permissão insuficiente para ler reviews.");
        }
        const reviewCount = reviewsSnap.size;

        // 2. Conta todas as listas criadas
        let listsSnap;
        try {
            listsSnap = await db.collection('lists').where('uidAutor', '==', userId).get();
        } catch (err) {
            console.error("Erro ao ler lists:", err);
            throw new Error("Permissão insuficiente para ler lists.");
        }
        const listsCount = listsSnap.size;

        // 3. Conta seguidores (usuários que seguem este user)
        let followersSnap;
        try {
            followersSnap = await db.collection('followers').where('followedId', '==', userId).get();
        } catch (err) {
            console.error("Erro ao ler followers:", err);
            throw new Error("Permissão insuficiente para ler followers.");
        }
        const followersCount = followersSnap.size;

        // 4. Conta curtidas recebidas em posts/reviews
        let likesCount = 0;
        let postsSnap;
        try {
            postsSnap = await db.collection('reviews').where('uidAutor', '==', userId).get();
        } catch (err) {
            console.error("Erro ao ler posts para likes:", err);
            throw new Error("Permissão insuficiente para ler posts/reviews.");
        }
        postsSnap.forEach(doc => {
            likesCount += doc.data().likes ? doc.data().likes.length : 0;
        });

        // 5. Calcula XP (20 pontos por review, 10 por lista, 5 por seguidor, 2 por curtida)
        const totalXP = (reviewCount * 20) + (listsCount * 10) + (followersCount * 5) + (likesCount * 2);

        // 6. Define Badges iniciais
        let newBadges = [];
        if (reviewCount > 0) newBadges.push(BADGES.FIRST_REVIEW.id);
        if (listsCount >= 3) newBadges.push(BADGES.MARATHON.id);
        if (likesCount >= 10) newBadges.push(BADGES.POPULAR.id);
        if (followersCount >= 5) newBadges.push(BADGES.SOCIAL.id);

        // 7. Atualiza o usuário com o valor CORRETO
        // --- 2. COMPARAÇÃO: SÓ ATUALIZA SE O NOVO XP FOR MAIOR ---
        if (totalXP <= currentXP) {
            console.log("Recálculo não necessário. XP atual é maior ou igual.");
            return currentXP; // Retorna o XP atual sem fazer alterações
        }

        console.log(`Atualizando XP de ${currentXP} para ${totalXP}`);
        try {
            await db.collection('users').doc(userId).update({
                xp: totalXP,
                badges: newBadges,
                'stats.reviews': reviewCount,
                'stats.lists': listsCount,
                'stats.followers': followersCount,
                'stats.likes': likesCount
            });
        } catch (err) {
            console.error("Erro ao atualizar usuário:", err);
            throw new Error("Permissão insuficiente para atualizar usuário.");
        }

        return totalXP;
    } catch (error) {
        console.error("Erro ao recalcular XP:", error);
        throw error;
    }
};
