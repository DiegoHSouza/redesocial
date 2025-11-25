import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';

// Configuração de Níveis
export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5000];

// Configuração de Medalhas
export const BADGES = {
    'FIRST_REVIEW': { id: 'first_review', name: 'Crítico Iniciante', icon: '📝', desc: 'Fez a primeira avaliação' },
    'POPULAR': { id: 'popular', name: 'Famosinho', icon: '🌟', desc: 'Teve 10 curtidas em um post' },
    'MARATHON': { id: 'marathon', name: 'Maratonista', icon: '🍿', desc: 'Criou 3 listas' },
    'SOCIAL': { id: 'social', name: 'Sociável', icon: '👋', desc: 'Seguiu 5 pessoas' }
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
export const awardXP = async (userId, amount, actionType) => {
    if (!userId) return;
    
    const userRef = db.collection('users').doc(userId);
    
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            if (!doc.exists) return;

            const currentXP = doc.data().xp || 0;
            const currentBadges = doc.data().badges || [];
            let newXP = currentXP + amount;
            let newBadges = [...currentBadges];

            // Exemplo de lógica de badge: Primeira review
            if (actionType === 'review' && !currentBadges.includes(BADGES.FIRST_REVIEW.id)) {
                newBadges.push(BADGES.FIRST_REVIEW.id);
            }

            transaction.update(userRef, { 
                xp: newXP,
                badges: newBadges
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



