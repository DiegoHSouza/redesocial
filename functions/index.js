const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

// --- CONFIGURAÇÃO DE PONTOS E MEDALHAS (COPIADO DE gamification.js) ---
const XP_POINTS = {
  REVIEW: 20,
  COMMENT: 5,
  LIKE_RECEIVED: 2,
  FOLLOW_RECEIVED: 5,
  CREATE_LIST: 10,
  USE_RANDOM_PICKER: 1, // Este pode continuar no cliente por ser de baixo risco
  CREATE_CLUB_POST: 15,
};

const BADGES = {
  FIRST_REVIEW: {id: "first_review"},
  MARATHON: {id: "marathon"},
  SOCIAL: {id: "social"},
  POPULAR: {id: "popular"},
  COMMUNITY_STARTER: {id: "community_starter"},
};

/**
 * Função auxiliar reutilizável para dar XP e verificar medalhas.
 * Executada dentro de uma transação para garantir consistência.
 * @param {string} userId - O ID do usuário a ser recompensado.
 * @param {string} actionType - A chave da ação de XP_POINTS.
 * @param {object} context - Dados adicionais para lógica de medalhas.
 */
async function awardPointsAndCheckBadges(userId, actionType, context = {}) {
  const amount = XP_POINTS[actionType];
  if (!userId || !amount) return;

  const userRef = db.collection("users").doc(userId);

  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const currentXP = userData.xp || 0;
    const currentBadges = userData.badges || [];
    let newBadges = [...currentBadges];

    // --- LÓGICA DE MEDALHAS ---
    // Cada verificação só ocorre se a medalha ainda não foi ganha.
    if (actionType === "REVIEW" && !newBadges.includes(BADGES.FIRST_REVIEW.id)) {
      const reviewsSnap = await db.collection("reviews").where("uidAutor", "==", userId).limit(1).get();
      if (reviewsSnap.size === 1) newBadges.push(BADGES.FIRST_REVIEW.id);
    }

    if (actionType === "CREATE_LIST" && !newBadges.includes(BADGES.MARATHON.id)) {
      const listsSnap = await db.collection("lists").where("uidAutor", "==", userId).limit(3).get();
      if (listsSnap.size === 3) newBadges.push(BADGES.MARATHON.id);
    }

    if (actionType === "CREATE_CLUB_POST" && !newBadges.includes(BADGES.COMMUNITY_STARTER.id)) {
        const postsSnap = await db.collectionGroup("posts").where("authorId", "==", userId).limit(1).get();
        if (postsSnap.size === 1) newBadges.push(BADGES.COMMUNITY_STARTER.id);
    }

    // Para 'seguir' e 'curtir', a lógica está no gatilho onUpdate.
    if (context.newBadge) {
        if (!newBadges.includes(context.newBadge)) {
            newBadges.push(context.newBadge);
        }
    }

    transaction.update(userRef, {
      xp: admin.firestore.FieldValue.increment(amount),
      badges: newBadges,
      [`stats.${actionType.toLowerCase()}`]: admin.firestore.FieldValue.increment(1),
    });
  });
}

// --- GATILHOS (TRIGGERS) DO FIRESTORE ---

// 1. Gatilho para quando uma NOVA AVALIAÇÃO é criada
exports.onReviewCreated = functions.region("southamerica-east1").firestore
    .document("reviews/{reviewId}")
    .onCreate(async (snap, context) => {
      const reviewData = snap.data();
      return awardPointsAndCheckBadges(reviewData.uidAutor, "REVIEW");
    });

// 2. Gatilho para quando uma NOVA LISTA é criada
exports.onListCreated = functions.region("southamerica-east1").firestore
    .document("lists/{listId}")
    .onCreate(async (snap, context) => {
      const listData = snap.data();
      return awardPointsAndCheckBadges(listData.uidAutor, "CREATE_LIST");
    });

// 3. Gatilho para quando um NOVO POST em um clube é criado
exports.onClubPostCreated = functions.region("southamerica-east1").firestore
    .document("groups/{groupId}/posts/{postId}")
    .onCreate(async (snap, context) => {
        const postData = snap.data();
        return awardPointsAndCheckBadges(postData.authorId, "CREATE_CLUB_POST");
    });

// 4. Gatilho para quando um usuário é ATUALIZADO (ex: ganha seguidor)
exports.onUserUpdated = functions.region("southamerica-east1").firestore
    .document("users/{userId}")
    .onUpdate(async (change, context) => {
      const before = change.before.data();
      const after = change.after.data();

      // Lógica para SEGUIDORES
      const beforeFollowers = before.seguidores?.length || 0;
      const afterFollowers = after.seguidores?.length || 0;
      if (afterFollowers > beforeFollowers) {
        const contextData = {};
        if (afterFollowers === 5 && !after.badges?.includes(BADGES.SOCIAL.id)) {
            contextData.newBadge = BADGES.SOCIAL.id;
        }
        // Dá XP para cada novo seguidor
        const diff = afterFollowers - beforeFollowers;
        for (let i = 0; i < diff; i++) {
            await awardPointsAndCheckBadges(context.params.userId, "FOLLOW_RECEIVED", contextData);
        }
      }
    });

// 5. Gatilho para quando uma avaliação é ATUALIZADA (ex: ganha curtida)
exports.onReviewUpdated = functions.region("southamerica-east1").firestore
    .document("reviews/{reviewId}")
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Lógica para CURTIDAS RECEBIDAS
        const beforeLikes = before.curtidas?.length || 0;
        const afterLikes = after.curtidas?.length || 0;
        if (afterLikes > beforeLikes) {
            const contextData = {};
            if (afterLikes === 10 && !after.authorInfo?.badges?.includes(BADGES.POPULAR.id)) {
                contextData.newBadge = BADGES.POPULAR.id;
            }
            return awardPointsAndCheckBadges(after.uidAutor, "LIKE_RECEIVED", contextData);
        }
        return null;
    });