import React from 'react';

export const Spinner = () => (
    <div className="flex justify-center items-center h-full w-full py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
);

export const ErrorMessage = ({ message }) => (
    <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg relative my-4" role="alert">
        <strong className="font-bold">Ocorreu um erro: </strong>
        <span className="block sm:inline">{message}</span>
    </div>
);

export const ContentCardSkeleton = () => (
    <div className="animate-pulse">
        <div className="bg-gray-700/50 rounded-lg aspect-[2/3]"></div>
        <div className="h-4 bg-gray-700/50 rounded mt-2 w-3/4"></div>
    </div>
);

// VERIFIQUE SE ESTA FUNÇÃO EXISTE E ESTÁ EXPORTADA:
export const getAvatarUrl = (url, name) => {
    if (!url || (typeof url === 'string' && url.startsWith('blob:'))) {
        return `https://ui-avatars.com/api/?name=${name || 'User'}&background=4f46e5&color=fff`;
    }
    return url;
};