import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, requestNotificationPermission, messaging } from '../services/firebaseConfig';

const AuthContext = createContext(null);

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {    
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            setCurrentUser(user);
            if (user) {
                // --- NOVIDADE: Ativa Push Notifications ao logar ---
                requestNotificationPermission(user.uid);
                
                if (messaging) {
                    messaging.onMessage((payload) => {
                        console.log('Mensagem recebida no foreground:', payload);
                    });
                }
                // --------------------------------------------------

                const userRef = db.collection("users").doc(user.uid);
                const unsubDoc = userRef.onSnapshot((docSnap) => {
                    if (docSnap.exists) {
                        setUserData({ uid: docSnap.id, ...docSnap.data() });
                    } else {
                        // --- SEU CÓDIGO ORIGINAL (Mantido para segurança) ---
                        // Se o documento não existir, cria um perfil padrão completo
                        const [nome, ...sobrenomeParts] = user.displayName?.split(' ') || ["Novo", "Usuário"];
                        const sobrenome = sobrenomeParts.join(' ') || '';
                        const nomeCompleto = `${nome} ${sobrenome}`.trim();
                        
                        const newUserDoc = {
                            nome: nome,
                            sobrenome: sobrenome,
                            username: `user_${Date.now().toString().slice(-6)}`,
                            nome_lowercase: nome.trim().toLowerCase(),
                            sobrenome_lowercase: sobrenome.trim().toLowerCase(),
                            nome_completo_lowercase: nomeCompleto.toLowerCase(),
                            email: user.email,
                            bio: "Olá! Sou novo(a) no CineSync.",
                            foto: user.photoURL || `https://ui-avatars.com/api/?name=${nome}&background=4f46e5&color=fff`,
                            fotoCapa: `https://source.unsplash.com/random/1200x400/?cinema`,
                            localizacao: "",
                            seguidores: [],
                            seguindo: [],
                            stats: { reviews: 0, likes: 0, comments: 0 },
                            favoriteStreaming: '',
                            favoriteGenre: ''
                        };
                        
                        userRef.set(newUserDoc)
                            .then(() => setUserData({ uid: user.uid, ...newUserDoc }))
                            .catch(err => console.error("Erro ao criar perfil automático:", err));
                        // --------------------------------------------------
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Erro no listener do usuário:", error);
                    setLoading(false);
                });
                return () => unsubDoc();
            } else {
                setUserData(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const value = { currentUser, userData, loading };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};