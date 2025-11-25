import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from './Common';

const UserListModal = ({ title, users, loading, onClose }) => {
    const navigate = useNavigate();

    const handleNavigate = (userId) => {
        onClose();
        navigate(`/profile/${userId}`);
    };

    useEffect(() => {
        const handleEsc = (event) => {
           if (event.keyCode === 27) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800/80 backdrop-filter backdrop-blur-lg border border-gray-700 p-6 rounded-xl shadow-lg w-full max-w-md text-white max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="overflow-y-auto">
                    {loading ? (
                        <Spinner />
                    ) : users.length > 0 ? (
                        <div className="space-y-3">
                            {users.map(user => (
                                <div key={user.id} onClick={() => handleNavigate(user.id)} className="bg-gray-900/50 p-3 rounded-lg flex items-center space-x-4 cursor-pointer hover:bg-gray-700 transition-colors">
                                    <img 
                                        src={user.foto || `https://ui-avatars.com/api/?name=${user.nome}`} 
                                        alt={user.nome} 
                                        className="w-12 h-12 rounded-full object-cover"
                                        onError={(e) => { e.target.onerror = null; e.target.src=`https://ui-avatars.com/api/?name=${user.nome}`; }}
                                    />
                                    <div>
                                        <p className="font-bold">{user.nome} {user.sobrenome}</p>
                                        <p className="text-sm text-gray-400 truncate">{user.bio}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-4">Nenhum usuário para mostrar.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserListModal;