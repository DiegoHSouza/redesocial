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
    REVIEW: 20,
    COMMENT: 5,
    LIKE_RECEIVED: 2,
    FOLLOW_RECEIVED: 5,
    CREATE_LIST: 10,
    USE_RANDOM_PICKER: 1,
    CREATE_CLUB_POST: 15,
};

// --- NOVAS MEDALHAS (SISTEMA DE TIERS) ---
const BADGES = {
    // Crítico (Reviews)
    CRITIC_BRONZE: "critic_bronze", // 1 Review
    CRITIC_SILVER: "critic_silver", // 10 Reviews
    CRITIC_GOLD:   "critic_gold",   // 50 Reviews

    // Maratonista (Listas)
    MARATHON_BRONZE: "marathon_bronze", // 1 Lista
    MARATHON_SILVER: "marathon_silver", // 5 Listas
    MARATHON_GOLD:   "marathon_gold",   // 10 Listas

    // Popular (Likes)
    POPULAR_BRONZE: "popular_bronze", // 1 Like
    POPULAR_SILVER: "popular_silver", // 10 Likes
    POPULAR_GOLD:   "popular_gold",   // 100 Likes

    // Social (Seguidores)
    SOCIAL_BRONZE: "social_bronze", // 5 Seguidores
    SOCIAL_SILVER: "social_silver", // 20 Seguidores
    SOCIAL_GOLD:   "social_gold",   // 50 Seguidores

    // Comunidade
    COMMUNITY_STARTER: "community_starter", // 1 Post
};

const STATS_MAP = {
    REVIEW: "reviews",
    COMMENT: "comments",
    CREATE_LIST: "lists",
    FOLLOW_RECEIVED: "followers",
    LIKE_RECEIVED: "likes",
    CREATE_CLUB_POST: "club_posts",
};

// --- LÓGICA DE NÍVEIS ---
function calculateLevel(totalXP) {
    if (totalXP < 100) return 1;
    if (totalXP < 300) return 2;
    if (totalXP < 600) return 3;
    if (totalXP < 1000) return 4;
    return Math.floor(totalXP / 500) + 3; 
}

/**
 * Função Core de Gamificação
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
            const currentBadges = userData.badges || [];
            let newBadges = [...currentBadges];
            let badgeAwarded = false;

            // 1. Incrementa XP e Estatística Local
            const newXP = (userData.xp || 0) + amount;
            
            const statField = STATS_MAP[actionType];
            const currentStatValue = (currentStats[statField] || 0) + 1;

            // --- FUNÇÃO AUXILIAR DE TIERS ---
            const checkTiers = (value, tiers) => {
                tiers.forEach(tier => {
                    if (value >= tier.limit && !newBadges.includes(tier.id)) {
                        newBadges.push(tier.id);
                        badgeAwarded = true;
                    }
                });
            };

            // 2. Verifica Badges por Categoria
            
            // CRÍTICO (Reviews)
            if (actionType === "REVIEW") {
                checkTiers(currentStatValue, [
                    { limit: 1,  id: BADGES.CRITIC_BRONZE },
                    { limit: 10, id: BADGES.CRITIC_SILVER },
                    { limit: 50, id: BADGES.CRITIC_GOLD }
                ]);
            }

            // MARATONISTA (Listas)
            if (actionType === "CREATE_LIST") {
                checkTiers(currentStatValue, [
                    { limit: 1,  id: BADGES.MARATHON_BRONZE },
                    { limit: 5,  id: BADGES.MARATHON_SILVER },
                    { limit: 10, id: BADGES.MARATHON_GOLD }
                ]);
            }

            // POPULAR (Likes)
            if (actionType === "LIKE_RECEIVED") {
                checkTiers(currentStatValue, [
                    { limit: 1,   id: BADGES.POPULAR_BRONZE },
                    { limit: 10,  id: BADGES.POPULAR_SILVER },
                    { limit: 100, id: BADGES.POPULAR_GOLD }
                ]);
            }

            // SOCIAL (Seguidores)
            // Nota: A lógica de followers no trigger soma 1, então usamos currentStatValue
            if (actionType === "FOLLOW_RECEIVED") {
                checkTiers(currentStatValue, [
                    { limit: 5,  id: BADGES.SOCIAL_BRONZE },
                    { limit: 20, id: BADGES.SOCIAL_SILVER },
                    { limit: 50, id: BADGES.SOCIAL_GOLD }
                ]);
            }

            // COMMUNITY STARTER (Post único)
            if (actionType === "CREATE_CLUB_POST" && !newBadges.includes(BADGES.COMMUNITY_STARTER)) {
                if (currentStatValue >= 1) {
                    newBadges.push(BADGES.COMMUNITY_STARTER);
                    badgeAwarded = true;
                }
            }

            // Badges de Contexto (Genérico)
            if (context.newBadge && !newBadges.includes(context.newBadge)) {
                newBadges.push(context.newBadge);
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
                updateData.badges = newBadges;
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

// --- TRIGGERS (Mantidos iguais, pois a lógica está na função acima) ---

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

// 7. Recalcular XP (ATUALIZADO COM A NOVA LÓGICA DE TIERS)
exports.recalculateUserXP = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const userId = request.auth.uid;

    try {
        console.log("--- INICIANDO RECÁLCULO V2 (TIERS) ---");

        // 1. REVIEWS
        const reviewsSnapshot = await db.collection("reviews")
            .where("uidAutor", "==", userId).select("uidAutor").get();
        const reviewCount = reviewsSnapshot.size;

        // 2. LISTAS
        const listsSnapshot = await db.collection("lists")
            .where("uidAutor", "==", userId).select("uidAutor").get();
        const listsCount = listsSnapshot.size;

        // 3. POSTS (Requer o índice de Isenção que você criou)
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

        // 6. COMENTÁRIOS
        const commentsCount = 0;

        // CÁLCULO
        const totalXP =
            (reviewCount * XP_POINTS.REVIEW) +
            (listsCount * XP_POINTS.CREATE_LIST) +
            (followersCount * XP_POINTS.FOLLOW_RECEIVED) +
            (likesCount * XP_POINTS.LIKE_RECEIVED) +
            (clubPostsCount * XP_POINTS.CREATE_CLUB_POST) +
            (commentsCount * XP_POINTS.COMMENT);

        // --- REGRAS DE BADGES (REFEITAS PARA TIERS) ---
        let newBadges = [];

        // Função auxiliar local
        const addBadge = (id) => { if (!newBadges.includes(id)) newBadges.push(id); };

        // Crítico
        if (reviewCount >= 1) addBadge(BADGES.CRITIC_BRONZE);
        if (reviewCount >= 10) addBadge(BADGES.CRITIC_SILVER);
        if (reviewCount >= 50) addBadge(BADGES.CRITIC_GOLD);

        // Maratonista
        if (listsCount >= 1) addBadge(BADGES.MARATHON_BRONZE);
        if (listsCount >= 5) addBadge(BADGES.MARATHON_SILVER);
        if (listsCount >= 10) addBadge(BADGES.MARATHON_GOLD);

        // Popular
        if (likesCount >= 1) addBadge(BADGES.POPULAR_BRONZE);
        if (likesCount >= 10) addBadge(BADGES.POPULAR_SILVER);
        if (likesCount >= 100) addBadge(BADGES.POPULAR_GOLD);

        // Social
        if (followersCount >= 5) addBadge(BADGES.SOCIAL_BRONZE);
        if (followersCount >= 20) addBadge(BADGES.SOCIAL_SILVER);
        if (followersCount >= 50) addBadge(BADGES.SOCIAL_GOLD);

        // Pioneiro
        if (clubPostsCount >= 1) addBadge(BADGES.COMMUNITY_STARTER);

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
        });

        return { success: true, totalXP, newLevel };

    } catch (error) {
        console.error("Erro recalculo:", error);
        throw new HttpsError("internal", error.message);
    }
});