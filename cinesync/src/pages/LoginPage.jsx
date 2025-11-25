import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { GoogleIcon } from '../components/Icons'; 
import { ErrorMessage } from '../components/Common'; // CORREÇÃO: Importando do local certo

const LoginPage = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nome, setNome] = useState('');
    const [sobrenome, setSobrenome] = useState('');
    const [error, setError] = useState('');
    
    const handleEmailPassword = async (e) => {
        e.preventDefault();
        setError('');
        if (isLogin) {
            try {
                await auth.signInWithEmailAndPassword(email, password);
                navigate('/feed');
            } catch (err) {
                if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    setError("E-mail ou senha inválidos. Por favor, tente novamente.");
                } else {
                    setError("Falha no login. Verifique seu e-mail e senha.");
                }
            }
        } else {
                if (!nome || !sobrenome) {
                setError("Nome e sobrenome são obrigatórios.");
                return;
            }
            try {
                const { user } = await auth.createUserWithEmailAndPassword(email, password);
                await user.updateProfile({ displayName: `${nome} ${sobrenome}` });
                const nomeCompleto = `${nome} ${sobrenome}`.trim();
                await db.collection("users").doc(user.uid).set({
                    nome: nome,
                    sobrenome: sobrenome,
                    username: `user_${Date.now().toString().slice(-6)}`,
                    nome_lowercase: nome.trim().toLowerCase(),
                    sobrenome_lowercase: sobrenome.trim().toLowerCase(),
                    nome_completo_lowercase: nomeCompleto.toLowerCase(),
                    email: user.email,
                    bio: "Olá! Sou novo(a) no CineSync.",
                    foto: user.photoURL || `https://ui-avatars.com/api/?name=${nome}+${sobrenome}&background=4f46e5&color=fff`,
                    fotoCapa: `https://source.unsplash.com/random/1200x400/?cinema,movie`,
                    localizacao: "",
                    seguidores: [],
                    seguindo: [],
                    stats: { reviews: 0, likes: 0, comments: 0 },
                    favoriteStreaming: '',
                    favoriteGenre: ''
                });
                navigate('/feed');
            } catch (err) {
                setError("Falha no cadastro. O e-mail pode já estar em uso.");
            }
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const { user } = await auth.signInWithPopup(provider);
            
            const userDoc = await db.collection("users").doc(user.uid).get();
            if (!userDoc.exists) {
                const [firstName, ...lastNameParts] = user.displayName.split(' ');
                const finalFirstName = firstName || "Usuário";
                const finalLastName = lastNameParts.join(' ') || "Google";
                const nomeCompleto = `${finalFirstName} ${finalLastName}`.trim();
                await db.collection("users").doc(user.uid).set({
                    nome: finalFirstName,
                    sobrenome: finalLastName,
                    username: `user_${Date.now().toString().slice(-6)}`,
                    nome_lowercase: finalFirstName.trim().toLowerCase(),
                    sobrenome_lowercase: finalLastName.trim().toLowerCase(),
                    nome_completo_lowercase: nomeCompleto.toLowerCase(),
                    email: user.email,
                    bio: "Olá! Sou novo(a) no CineSync.",
                    foto: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=4f46e5&color=fff`,
                    fotoCapa: `https://source.unsplash.com/random/1200x400/?abstract`,
                    localizacao: "",
                    seguidores: [],
                    seguindo: [],
                    stats: { reviews: 0, likes: 0, comments: 0 },
                    favoriteStreaming: '',
                    favoriteGenre: ''
                });
            }
            navigate('/feed');
        } catch (err) {
            if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                setError("Falha ao entrar com Google. Verifique se pop-ups estão permitidos.");
            }
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4" style={{background: 'radial-gradient(circle, rgba(17,24,39,1) 0%, rgba(10,10,18,1) 100%)'}}>
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800/50 backdrop-filter backdrop-blur-sm border border-gray-700 rounded-2xl shadow-2xl shadow-indigo-500/10">
                <h2 className="text-3xl font-bold text-center tracking-tight text-shadow">{isLogin ? 'Bem-vindo(a) de volta' : 'Crie sua Conta'}</h2>
                {error && <ErrorMessage message={error}/>}
                <form onSubmit={handleEmailPassword} className="space-y-4">
                    {!isLogin && (
                        <div className="flex space-x-4">
                            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="input-style" required />
                            <input type="text" placeholder="Sobrenome" value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} className="input-style" required />
                        </div>
                    )}
                    <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100" required />
                    <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100" required />
                    <button type="submit" className="w-full py-3 text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-md hover:opacity-90 transition-all font-semibold transform hover:scale-105">{isLogin ? 'Entrar' : 'Cadastrar'}</button>
                </form>
                <div className="flex items-center justify-center space-x-2">
                    <hr className="w-full border-gray-600"/>
                    <span className="text-gray-400 text-sm">ou</span>
                    <hr className="w-full border-gray-600"/>
                </div>
                <button onClick={handleGoogleSignIn} className="w-full py-3 flex items-center justify-center space-x-3 bg-gray-200 text-gray-800 rounded-md hover:bg-white transition-colors font-semibold transform hover:scale-105">
                    <GoogleIcon />
                    <span>Continuar com Google</span>
                </button>
                <p className="text-sm text-center text-gray-400">
                    {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                    <button onClick={() => setIsLogin(!isLogin)} className="ml-1 font-semibold text-indigo-400 hover:underline">
                        {isLogin ? 'Cadastre-se' : 'Faça login'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;