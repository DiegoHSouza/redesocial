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

// --- CONSTANTES & CONFIGURAÇÕES ---

const XP_POINTS = {
    REVIEW: 30,
    COMMENT: 10,
    LIKE_RECEIVED: 4,
    FOLLOW_RECEIVED: 5,
    CREATE_LIST: 10,
    USE_RANDOM_PICKER: 5,
    CREATE_CLUB_POST: 15,
};

const BADGES_IDS = {
    CRITIC:   { B: "critic_bronze", S: "critic_silver", G: "critic_gold" },
    POPULAR:  { B: "popular_bronze", S: "popular_silver", G: "popular_gold" },
    MARATHON: { B: "marathon_bronze", S: "marathon_silver", G: "marathon_gold" },
    SOCIAL:   { B: "social_bronze", S: "social_silver", G: "social_gold" },
    COMMUNITY:{ B: "community_bronze", S: "community_silver", G: "community_gold" },
};

// Centralização das Regras de Medalhas (Source of Truth)
const BADGE_RULES = {
    REVIEW: [
        { limit: 50, id: BADGES_IDS.CRITIC.G },
        { limit: 10, id: BADGES_IDS.CRITIC.S },
        { limit: 1,  id: BADGES_IDS.CRITIC.B }
    ],
    CREATE_LIST: [
        { limit: 10, id: BADGES_IDS.MARATHON.G },
        { limit: 5,  id: BADGES_IDS.MARATHON.S },
        { limit: 1,  id: BADGES_IDS.MARATHON.B }
    ],
    LIKE_RECEIVED: [
        { limit: 100, id: BADGES_IDS.POPULAR.G },
        { limit: 10,  id: BADGES_IDS.POPULAR.S },
        { limit: 1,   id: BADGES_IDS.POPULAR.B }
    ],
    FOLLOW_RECEIVED: [
        { limit: 50, id: BADGES_IDS.SOCIAL.G },
        { limit: 20, id: BADGES_IDS.SOCIAL.S },
        { limit: 5,  id: BADGES_IDS.SOCIAL.B }
    ],
    CREATE_CLUB_POST: [
        { limit: 20, id: BADGES_IDS.COMMUNITY.G },
        { limit: 5,  id: BADGES_IDS.COMMUNITY.S },
        { limit: 1,  id: BADGES_IDS.COMMUNITY.B }
    ]
};

const STATS_MAP = {
    REVIEW: "reviews",
    COMMENT: "comments",
    CREATE_LIST: "lists",
    FOLLOW_RECEIVED: "followers",
    LIKE_RECEIVED: "likes",
    CREATE_CLUB_POST: "club_posts",
    USE_RANDOM_PICKER: "random_picks",
};

// --- FUNÇÕES AUXILIARES ---

function calculateLevel(totalXP) {
    if (totalXP < 100) return 1;
    if (totalXP < 300) return 2;
    if (totalXP < 600) return 3;
    if (totalXP < 1000) return 4;
    return Math.floor((totalXP - 1000) / 500) + 5; 
}

/**
 * Lógica pura de atualização de tiers de medalhas.
 * Retorna as medalhas atualizadas e flag de mudança.
 */
function updateBadgeTier(currentBadges, currentValue, tiers) {
    let updatedBadges = [...currentBadges];
    let hasChanged = false;

    // Tiers devem estar ordenados do MAIOR para o MENOR nas regras
    for (const tier of tiers) {
        if (currentValue >= tier.limit) {
            // Adiciona a nova se não tiver
            if (!updatedBadges.includes(tier.id)) {
                updatedBadges.push(tier.id);
                hasChanged = true;
            }

            // Remove inferiores da mesma categoria
            tiers.forEach(t => {
                if (t.id !== tier.id && updatedBadges.includes(t.id)) {
                    updatedBadges = updatedBadges.filter(b => b !== t.id);
                    hasChanged = true;
                }
            });
            break; // Tier mais alto encontrado
        }
    }
    return { newBadges: updatedBadges, changed: hasChanged };
}

/**
 * Core Transactional Logic
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

            // 1. Incrementa XP e Estatística
            const newXP = (userData.xp || 0) + amount;
            const statField = STATS_MAP[actionType];
            
            let currentStatValue = 0;
            if (statField) {
                // Se for LIKE ou FOLLOW, o valor atual vem do contexto ou da contagem de array, 
                // mas para manter consistência rápida, incrementamos o stat numérico.
                currentStatValue = (currentStats[statField] || 0) + 1;
            }

            // 2. Verifica Badges usando as regras centralizadas
            const rules = BADGE_RULES[actionType];
            if (rules) {
                const result = updateBadgeTier(currentBadges, currentStatValue, rules);
                if (result.changed) {
                    currentBadges = result.newBadges;
                    badgeAwarded = true;
                }
            }

            // Badge específica de contexto (ex: "Verificado")
            if (context.newBadge && !currentBadges.includes(context.newBadge)) {
                currentBadges.push(context.newBadge);
                badgeAwarded = true;
            }

            // 3. Verifica Level Up
            const newLevel = calculateLevel(newXP);
            
            // 4. Update
            const updateData = {
                xp: newXP, 
                level: newLevel
            };

            if (badgeAwarded) updateData.badges = currentBadges;
            if (statField) updateData[`stats.${statField}`] = currentStatValue;
            
            // Otimização: Só grava se houver mudança real de level para evitar writes desnecessários em update de UI
            // Mas aqui sempre grava por causa do XP.
            transaction.update(userRef, updateData);
        });
    } catch (error) {
        console.error(`Erro Transaction [${actionType}] user ${userId}:`, error);
    }
}

// --- TRIGGERS ---

exports.onReviewCreated = onDocumentCreated("reviews/{reviewId}", async (event) => {
    const data = event.data?.data();
    if (!data) return;
    return awardPointsAndCheckBadges(data.uidAutor, "REVIEW");
});

exports.onCommentCreated = onDocumentCreated("reviews/{reviewId}/comments/{commentId}", async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const authorId = data.userId || data.uidAutor; 
    return awardPointsAndCheckBadges(authorId, "COMMENT");
});

exports.onListCreated = onDocumentCreated("lists/{listId}", async (event) => {
    const data = event.data?.data();
    if (!data) return;
    return awardPointsAndCheckBadges(data.uidAutor, "CREATE_LIST");
});

exports.onClubPostCreated = onDocumentCreated("groups/{groupId}/posts/{postId}", async (event) => {
    const data = event.data?.data();
    if (!data) return;
    return awardPointsAndCheckBadges(data.authorId, "CREATE_CLUB_POST");
});

// Melhoria de Segurança: Debounce básico
exports.registerRandomPickerUsage = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const userId = request.auth.uid;
    const userRef = db.collection("users").doc(userId);

    // Checagem rápida de timestamp para evitar spam de XP (ex: máx 1x a cada 10 seg)
    const userDoc = await userRef.get();
    const lastUsage = userDoc.data()?.lastRandomPickAt?.toDate().getTime() || 0;
    const now = Date.now();

    if (now - lastUsage < 10000) { // 10 segundos
        throw new HttpsError("resource-exhausted", "Aguarde antes de gerar XP novamente.");
    }

    try {
        await awardPointsAndCheckBadges(userId, "USE_RANDOM_PICKER");
        // Atualiza timestamp fora da transação de XP para simplificar, ou dentro se preferir estrita consistência
        await userRef.update({ lastRandomPickAt: admin.firestore.FieldValue.serverTimestamp() });
        return { success: true };
    } catch (error) {
        console.error("Erro sorteador:", error);
        throw new HttpsError("internal", "Erro processar XP.");
    }
});

// TRIGGER: Seguidores (Array diff)
exports.onUserUpdated = onDocumentUpdated("users/{userId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Fail-fast
    if (!after.seguidores || after.seguidores.length <= (before.seguidores?.length || 0)) return null;

    const afterFollowers = after.seguidores;
    const beforeFollowers = before.seguidores || [];
    
    // Otimização: Sets para busca O(1)
    const beforeSet = new Set(beforeFollowers);
    const newFollowers = afterFollowers.filter(id => !beforeSet.has(id));

    // Batch de notificações para economizar writes soltos
    const batch = db.batch();
    const notificationsRef = db.collection("notifications");

    for (const newFollowerId of newFollowers) {
        if (newFollowerId === event.params.userId) continue;
        
        // Chamada da gamificação (não dá pra fazer em batch pois precisa de transaction de leitura)
        await awardPointsAndCheckBadges(event.params.userId, "FOLLOW_RECEIVED");

        const notifDoc = notificationsRef.doc();
        batch.set(notifDoc, {
            recipientId: event.params.userId,
            senderId: newFollowerId,
            type: 'follow',
            read: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    if (newFollowers.length > 0) await batch.commit();
});

// TRIGGER: Likes (Array diff)
exports.onReviewUpdated = onDocumentUpdated("reviews/{reviewId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!after.curtidas || after.curtidas.length <= (before.curtidas?.length || 0)) return null;

    const newLikerId = after.curtidas.find(id => !before.curtidas?.includes(id));
    const authorId = after.uidAutor;

    if (newLikerId && newLikerId !== authorId) {
        await awardPointsAndCheckBadges(authorId, "LIKE_RECEIVED");
        
        await db.collection("notifications").add({
            recipientId: authorId,
            senderId: newLikerId,
            type: 'like',
            reviewId: event.params.reviewId,
            read: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }
});

/**
 * RECALCULAR XP (HEAVY TASK) - Versão Otimizada com Aggregation Queries
 */
exports.recalculateUserXP = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const userId = request.auth.uid;

    try {
        // Queries de Agregação (Muito mais barato e rápido que .get().size)
        // Custo: 1 leitura a cada 1000 docs indexados.
        
        const countQuery = async (query) => {
            const snapshot = await query.count().get();
            return snapshot.data().count;
        };

        // 1. Paralelizar as promessas para velocidade
        const [reviewCount, listsCount, clubPostsCount, userDoc] = await Promise.all([
            countQuery(db.collection("reviews").where("uidAutor", "==", userId)),
            countQuery(db.collection("lists").where("uidAutor", "==", userId)),
            countQuery(db.collectionGroup("posts").where("authorId", "==", userId)),
            db.collection("users").doc(userId).get()
        ]);

        if (!userDoc.exists) throw new HttpsError("not-found", "User not found.");
        const userData = userDoc.data();

        // 4. Likes (Complexo: Likes estão dentro de arrays nos reviews)
        // Infelizmente, aggregation query não soma array length.
        // Opção B: Confiar no 'stats.reviews' * média, OU fazer query pesada.
        // Vamos manter a query pesada para PRECISÃO, mas limitar os campos retornados.
        const reviewsForLikes = await db.collection("reviews")
            .where("uidAutor", "==", userId)
            .select("curtidas") // Traz APENAS esse campo para economizar banda
            .get();
        
        let likesCount = 0;
        reviewsForLikes.forEach(doc => {
            const d = doc.data();
            if (d.curtidas && Array.isArray(d.curtidas)) likesCount += d.curtidas.length;
        });

        // 5. Seguidores (Length do array local)
        const followersCount = userData.seguidores?.length || 0;

        // 6. Random Picker (Dado local apenas)
        const randomPicksCount = userData.stats?.random_picks || 0;
        const commentsCount = 0; // Ainda não implementado contador real

        // CÁLCULO XP
        const totalXP =
            (reviewCount * XP_POINTS.REVIEW) +
            (listsCount * XP_POINTS.CREATE_LIST) +
            (followersCount * XP_POINTS.FOLLOW_RECEIVED) +
            (likesCount * XP_POINTS.LIKE_RECEIVED) +
            (clubPostsCount * XP_POINTS.CREATE_CLUB_POST) +
            (randomPicksCount * XP_POINTS.USE_RANDOM_PICKER) +
            (commentsCount * XP_POINTS.COMMENT);

        // --- CÁLCULO DE BADGES (Usando regras centralizadas) ---
        let newBadges = []; 
        const applyRule = (val, type) => {
             const result = updateBadgeTier(newBadges, val, BADGE_RULES[type]);
             if(result.changed) newBadges = result.newBadges;
        };

        applyRule(reviewCount, "REVIEW");
        applyRule(listsCount, "CREATE_LIST");
        applyRule(likesCount, "LIKE_RECEIVED");
        applyRule(followersCount, "FOLLOW_RECEIVED");
        applyRule(clubPostsCount, "CREATE_CLUB_POST");

        const newLevel = calculateLevel(totalXP);

        // UPDATE
        await db.collection("users").doc(userId).update({
            xp: totalXP,
            level: newLevel,
            badges: newBadges,
            "stats.reviews": reviewCount,
            "stats.lists": listsCount,
            "stats.followers": followersCount,
            "stats.likes": likesCount,
            "stats.club_posts": clubPostsCount
            // random_picks não é sobrescrito
        });

        return { success: true, totalXP, newLevel };

    } catch (error) {
        console.error("Erro recalculo:", error);
        throw new HttpsError("internal", error.message);
    }
});