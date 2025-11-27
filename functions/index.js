const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ 
    region: "southamerica-east1", 
    memory: "256MiB", 
    maxInstances: 10
});

const XP_POINTS = {
    REVIEW: 30,
    COMMENT: 10,
    LIKE_RECEIVED: 4,
    FOLLOW_RECEIVED: 5,
    CREATE_LIST: 10,
    USE_RANDOM_PICKER: 5,
    CREATE_CLUB_POST: 15,
};

// --- CONFIGURAÇÃO DE MEDALHAS (COM TIERS) ---
const BADGES = {
    // Crítico (Reviews)
    CRITIC_BRONZE: "critic_bronze",
    CRITIC_SILVER: "critic_silver",
    CRITIC_GOLD:   "critic_gold",

    // Popular (Likes)
    POPULAR_BRONZE: "popular_bronze",
    POPULAR_SILVER: "popular_silver",
    POPULAR_GOLD:   "popular_gold",

    // Maratonista (Listas)
    MARATHON_BRONZE: "marathon_bronze",
    MARATHON_SILVER: "marathon_silver",
    MARATHON_GOLD:   "marathon_gold",

    // Social (Seguidores)
    SOCIAL_BRONZE: "social_bronze",
    SOCIAL_SILVER: "social_silver",
    SOCIAL_GOLD:   "social_gold",

    // Comunidade (Posts em Clubes)
    COMMUNITY_BRONZE: "community_bronze",
    COMMUNITY_SILVER: "community_silver",
    COMMUNITY_GOLD:   "community_gold",
    
    // Legado
    FIRST_REVIEW: "first_review" 
};

const STATS_MAP = {
    REVIEW: "reviews",
    COMMENT: "comments",
    CREATE_LIST: "lists",
    FOLLOW_RECEIVED: "followers",
    LIKE_RECEIVED: "likes",
    CREATE_CLUB_POST: "club_posts",
    USE_RANDOM_PICKER: "random_picks", // CORREÇÃO APLICADA: Mapeamento adicionado
};

// --- LÓGICA DE NÍVEIS ---
function calculateLevel(totalXP) {
    if (totalXP < 100) return 1;
    if (totalXP < 300) return 2;
    if (totalXP < 600) return 3;
    if (totalXP < 1000) return 4;
    return Math.floor((totalXP - 1000) / 500) + 5; // Pequena correção: variável era 'xp', mudei para 'totalXP' para bater com o argumento
}

/**
 * Função Auxiliar: EVOLUÇÃO DE MEDALHA
 * Verifica se o usuário atingiu um novo tier, adiciona o novo e remove os inferiores.
 */
function updateBadgeTier(currentBadges, currentValue, tiers) {
    let updatedBadges = [...currentBadges];
    let hasChanged = false;

    // Tiers devem vir ordenados do MAIOR para o MENOR (Gold -> Silver -> Bronze)
    for (const tier of tiers) {
        if (currentValue >= tier.limit) {
            // 1. Se ele ainda não tem essa medalha superior, adiciona
            if (!updatedBadges.includes(tier.id)) {
                updatedBadges.push(tier.id);
                hasChanged = true;
            }

            // 2. REMOVE todas as outras medalhas inferiores desta mesma família
            tiers.forEach(t => {
                if (t.id !== tier.id && updatedBadges.includes(t.id)) {
                    updatedBadges = updatedBadges.filter(b => b !== t.id);
                    hasChanged = true;
                }
            });

            // Já achamos o nível mais alto que ele tem direito, paramos o loop.
            break; 
        }
    }

    return { newBadges: updatedBadges, changed: hasChanged };
}

/**
 * Função Core de Gamificação (Transacional)
 */
async function awardPointsAndCheckBadges(userId, actionType, context = {}) {
    const amount = XP_POINTS[actionType];
    if (!userId || !amount) return;

    const userRef = db.collection("users").doc(userId);

    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) return; 

            const userData = userDoc.data();
            const currentStats = userData.stats || {};
            let currentBadges = userData.badges || [];
            let badgeAwarded = false;

            // 1. Incrementa XP e Estatística Local
            const newXP = (userData.xp || 0) + amount;
            const statField = STATS_MAP[actionType];
            
            // Segurança: Se não houver mapeamento, não quebra, só não salva stat
            let currentStatValue = 0;
            if (statField) {
                currentStatValue = (currentStats[statField] || 0) + 1;
            }

            // 2. Verifica Badges (Com Lógica de Evolução)
            let result;

            // --- CRÍTICO (Reviews) ---
            if (actionType === "REVIEW") {
                result = updateBadgeTier(currentBadges, currentStatValue, [
                    { limit: 50, id: BADGES.CRITIC_GOLD },
                    { limit: 10, id: BADGES.CRITIC_SILVER },
                    { limit: 1,  id: BADGES.CRITIC_BRONZE }
                ]);
                if (result.changed) { currentBadges = result.newBadges; badgeAwarded = true; }
            }

            // --- MARATONISTA (Listas) ---
            if (actionType === "CREATE_LIST") {
                result = updateBadgeTier(currentBadges, currentStatValue, [
                    { limit: 10, id: BADGES.MARATHON_GOLD },
                    { limit: 5,  id: BADGES.MARATHON_SILVER },
                    { limit: 1,  id: BADGES.MARATHON_BRONZE }
                ]);
                if (result.changed) { currentBadges = result.newBadges; badgeAwarded = true; }
            }

            // --- POPULAR (Likes) ---
            if (actionType === "LIKE_RECEIVED") {
                result = updateBadgeTier(currentBadges, currentStatValue, [
                    { limit: 100, id: BADGES.POPULAR_GOLD },
                    { limit: 10,  id: BADGES.POPULAR_SILVER },
                    { limit: 1,   id: BADGES.POPULAR_BRONZE }
                ]);
                if (result.changed) { currentBadges = result.newBadges; badgeAwarded = true; }
            }

            // --- SOCIAL (Seguidores) ---
            if (actionType === "FOLLOW_RECEIVED") {
                result = updateBadgeTier(currentBadges, currentStatValue, [
                    { limit: 50, id: BADGES.SOCIAL_GOLD },
                    { limit: 20, id: BADGES.SOCIAL_SILVER },
                    { limit: 5,  id: BADGES.SOCIAL_BRONZE }
                ]);
                if (result.changed) { currentBadges = result.newBadges; badgeAwarded = true; }
            }

            // --- COMUNIDADE (Posts) ---
            if (actionType === "CREATE_CLUB_POST") {
                result = updateBadgeTier(currentBadges, currentStatValue, [
                    { limit: 20, id: BADGES.COMMUNITY_GOLD },
                    { limit: 5,  id: BADGES.COMMUNITY_SILVER },
                    { limit: 1,  id: BADGES.COMMUNITY_BRONZE }
                ]);
                if (result.changed) { currentBadges = result.newBadges; badgeAwarded = true; }
            }

            // Badges de Contexto (Ex: Verificado, Admin)
            if (context.newBadge && !currentBadges.includes(context.newBadge)) {
                currentBadges.push(context.newBadge);
                badgeAwarded = true;
            }

            // 3. Verifica Level Up
            const newLevel = calculateLevel(newXP);
            
            // 4. Prepara Update
            const updateData = {
                xp: newXP, 
                level: newLevel
            };

            if (badgeAwarded) {
                updateData.badges = currentBadges;
            }

            if (statField) {
                updateData[`stats.${statField}`] = currentStatValue;
            }
            
            transaction.update(userRef, updateData);
        });
    } catch (error) {
        console.error(`Erro na transação para user ${userId}:`, error);
    }
}

// --- TRIGGERS ---

exports.onReviewCreated = onDocumentCreated("reviews/{reviewId}", async (event) => {
    const reviewData = event.data.data();
    if (!reviewData) return;
    return awardPointsAndCheckBadges(reviewData.uidAutor, "REVIEW");
});

exports.onCommentCreated = onDocumentCreated("reviews/{reviewId}/comments/{commentId}", async (event) => {
    const commentData = event.data.data();
    if (!commentData) return;
    const authorId = commentData.userId || commentData.uidAutor; 
    return awardPointsAndCheckBadges(authorId, "COMMENT");
});

exports.onListCreated = onDocumentCreated("lists/{listId}", async (event) => {
    const listData = event.data.data();
    if (!listData) return;
    return awardPointsAndCheckBadges(listData.uidAutor, "CREATE_LIST");
});

exports.onClubPostCreated = onDocumentCreated("groups/{groupId}/posts/{postId}", async (event) => {
    const postData = event.data.data();
    if (!postData) return;
    return awardPointsAndCheckBadges(postData.authorId, "CREATE_CLUB_POST");
});

// CORREÇÃO APLICADA: Nova função para o Sorteador
exports.registerRandomPickerUsage = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Auth required.");
    }
    const userId = request.auth.uid;
    try {
        await awardPointsAndCheckBadges(userId, "USE_RANDOM_PICKER");
        return { success: true };
    } catch (error) {
        console.error("Erro no sorteador:", error);
        throw new HttpsError("internal", "Erro ao processar XP.");
    }
});

exports.onUserUpdated = onDocumentUpdated("users/{userId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.seguidores?.length === after.seguidores?.length) return null;

    const afterFollowers = after.seguidores || [];
    const beforeFollowers = before.seguidores || [];

    if (afterFollowers.length > beforeFollowers.length) {
        const contextData = {};
        const beforeSet = new Set(beforeFollowers);
        const newFollowers = afterFollowers.filter(id => !beforeSet.has(id));

        for (const newFollowerId of newFollowers) {
            if (newFollowerId === event.params.userId) continue;
            await awardPointsAndCheckBadges(event.params.userId, "FOLLOW_RECEIVED", contextData);
            await db.collection("notifications").add({
                recipientId: event.params.userId,
                senderId: newFollowerId,
                type: 'follow',
                read: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
});

exports.onReviewUpdated = onDocumentUpdated("reviews/{reviewId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.curtidas?.length === after.curtidas?.length) return null;

    const afterLikes = after.curtidas?.length || 0;
    const beforeLikes = before.curtidas?.length || 0;

    if (afterLikes > beforeLikes) {
        const authorId = after.uidAutor;
        const contextData = {};
        const newLikerId = after.curtidas.find(id => !before.curtidas?.includes(id));
        
        if (newLikerId && newLikerId !== authorId) {
            await db.collection("notifications").add({
                recipientId: authorId,
                senderId: newLikerId,
                type: 'like',
                reviewId: event.params.reviewId,
                read: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            await awardPointsAndCheckBadges(authorId, "LIKE_RECEIVED", contextData);
        }
    }
});

// 7. Recalcular XP (Otimizado, com Evolução de Medalhas e Sorteador)
exports.recalculateUserXP = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const userId = request.auth.uid;

    try {
        // 1. REVIEWS
        const reviewsSnapshot = await db.collection("reviews")
            .where("uidAutor", "==", userId).select("uidAutor").get();
        const reviewCount = reviewsSnapshot.size;

        // 2. LISTAS
        const listsSnapshot = await db.collection("lists")
            .where("uidAutor", "==", userId).select("uidAutor").get();
        const listsCount = listsSnapshot.size;

        // 3. POSTS (Collection Group - Requer Índice que você já criou)
        const clubPostsSnapshot = await db.collectionGroup("posts")
           .where("authorId", "==", userId).select("authorId").get();
        const clubPostsCount = clubPostsSnapshot.size;

        // 4. LIKES
        const reviewsForLikes = await db.collection("reviews")
            .where("uidAutor", "==", userId).select("curtidas").get();
        let likesCount = 0;
        reviewsForLikes.forEach(doc => {
            const data = doc.data();
            if (data.curtidas && Array.isArray(data.curtidas)) likesCount += data.curtidas.length;
        });

        // 5. SEGUIDORES
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) throw new HttpsError("not-found", "User not found.");
        const userData = userDoc.data();
        const followersCount = userData.seguidores?.length || 0;

        // 6. COMENTÁRIOS (Pendente de implementação de contador, mantido 0)
        const commentsCount = 0;

        // CORREÇÃO APLICADA: 7. SORTEADOR (Lê do stat salvo)
        const randomPicksCount = userData.stats?.random_picks || 0;

        // CÁLCULO XP
        const totalXP =
            (reviewCount * XP_POINTS.REVIEW) +
            (listsCount * XP_POINTS.CREATE_LIST) +
            (followersCount * XP_POINTS.FOLLOW_RECEIVED) +
            (likesCount * XP_POINTS.LIKE_RECEIVED) +
            (clubPostsCount * XP_POINTS.CREATE_CLUB_POST) +
            (randomPicksCount * XP_POINTS.USE_RANDOM_PICKER) + // Incluído
            (commentsCount * XP_POINTS.COMMENT);

        // --- CÁLCULO DE BADGES (EVOLUÇÃO) ---
        let newBadges = []; // Começamos do zero para recalcular tudo certo

        // Helper para aplicar a evolução
        const applyTier = (badges, value, tiers) => {
            const result = updateBadgeTier(badges, value, tiers);
            return result.newBadges;
        };

        // Crítico
        newBadges = applyTier(newBadges, reviewCount, [
            { limit: 50, id: BADGES.CRITIC_GOLD },
            { limit: 10, id: BADGES.CRITIC_SILVER },
            { limit: 1,  id: BADGES.CRITIC_BRONZE }
        ]);

        // Popular
        newBadges = applyTier(newBadges, likesCount, [
            { limit: 100, id: BADGES.POPULAR_GOLD },
            { limit: 10,  id: BADGES.POPULAR_SILVER },
            { limit: 1,   id: BADGES.POPULAR_BRONZE }
        ]);

        // Maratonista
        newBadges = applyTier(newBadges, listsCount, [
            { limit: 10, id: BADGES.MARATHON_GOLD },
            { limit: 5,  id: BADGES.MARATHON_SILVER },
            { limit: 1,  id: BADGES.MARATHON_BRONZE }
        ]);

        // Social
        newBadges = applyTier(newBadges, followersCount, [
            { limit: 50, id: BADGES.SOCIAL_GOLD },
            { limit: 20, id: BADGES.SOCIAL_SILVER },
            { limit: 5,  id: BADGES.SOCIAL_BRONZE }
        ]);

        // Comunidade
        newBadges = applyTier(newBadges, clubPostsCount, [
            { limit: 20, id: BADGES.COMMUNITY_GOLD },
            { limit: 5,  id: BADGES.COMMUNITY_SILVER },
            { limit: 1,  id: BADGES.COMMUNITY_BRONZE }
        ]);

        const newLevel = calculateLevel(totalXP);

        // UPDATE FINAL
        await db.collection("users").doc(userId).update({
            xp: totalXP,
            level: newLevel,
            badges: newBadges, 
            "stats.reviews": reviewCount,
            "stats.lists": listsCount,
            "stats.followers": followersCount,
            "stats.likes": likesCount,
            "stats.club_posts": clubPostsCount
            // Não sobrescrevemos random_picks aqui pois ele não é recontado do banco, apenas lido
        });

        return { success: true, totalXP, newLevel };

    } catch (error) {
        console.error("Erro recalculo:", error);
        throw new HttpsError("internal", error.message);
    }
});