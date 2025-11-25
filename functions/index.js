const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendPushNotification = onDocumentCreated("notifications/{notificationId}", async (event) => {
    // Na v2, os dados estão dentro de event.data
    const snapshot = event.data;
    if (!snapshot) {
        console.log("Nenhum dado associado ao evento");
        return;
    }

    const notification = snapshot.data();
    const recipientId = notification.recipientId;

    // 1. Busca o Token FCM do usuário destino
    const userDoc = await admin.firestore().collection("users").doc(recipientId).get();
    
    if (!userDoc.exists) {
        console.log("Usuário destino não encontrado.");
        return;
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
        console.log("Usuário não tem token de notificação (fcmToken).");
        return;
    }

    // 2. Monta a mensagem
    let title = "CineSync";
    let body = "Nova interação!";
    let clickAction = "/"; // URL relativa

    // Busca info do remetente para personalizar a mensagem
    const senderDoc = await admin.firestore().collection("users").doc(notification.senderId).get();
    const senderName = senderDoc.exists ? senderDoc.data().nome : "Alguém";

    if (notification.type === "like") {
        title = "Nova curtida!";
        body = `${senderName} curtiu sua avaliação.`;
        clickAction = `/detail/${notification.mediaType}/${notification.mediaId}`;
    } else if (notification.type === "comment") {
        title = "Novo comentário!";
        body = `${senderName} comentou na sua avaliação.`;
        clickAction = `/detail/${notification.mediaType}/${notification.mediaId}`;
    } else if (notification.type === "follow") {
        title = "Novo seguidor!";
        body = `${senderName} começou a seguir você.`;
        clickAction = `/profile/${notification.senderId}`;
    }

    // Payload da mensagem
    const message = {
        notification: {
            title: title,
            body: body,
        },
        data: {
            url: clickAction, // Usado pelo Service Worker para abrir a URL correta
            click_action: clickAction 
        },
        token: fcmToken,
    };

    // 3. Envia
    try {
        await admin.messaging().send(message);
        console.log("Notificação enviada com sucesso para:", recipientId);
    } catch (error) {
        console.error("Erro ao enviar notificação:", error);
        // Se o token for inválido (usuário deslogou/trocou de cel), limpa do banco
        if (error.code === 'messaging/registration-token-not-registered') {
             await admin.firestore().collection("users").doc(recipientId).update({
                 fcmToken: admin.firestore.FieldValue.delete()
             });
        }
    }
});