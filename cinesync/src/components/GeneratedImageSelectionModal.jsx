import React, { useState, useEffect } from 'react';
import { tmdbApi } from '../services/tmdbApi';
import { Spinner } from './Common';
import { CloseIcon } from './Icons';

const GeneratedImageSelectionModal = ({ media, targetType, onSelectImage, onBack, onClose }) => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchImages = async () => {
            setLoading(true);
            try {
                if (targetType === 'avatar') {
                    // Para Avatar: BuscAamos o Elenco (Cast)
                    const credits = await tmdbApi.get(`${media.media_type}/${media.id}/credits`);
                    // Pegamos os top 15 atores que tenham foto
                    const castWithPhotos = credits.cast
                        .filter(person => person.profile_path)
                        .slice(0, 15)
                        .map(person => ({
                            id: person.id,
                            url: `https://image.tmdb.org/t/p/w500${person.profile_path}`,
                            label: person.character // Nome do personagem como legenda
                        }));
                    setImages(castWithPhotos);
                } else {
                    // Para Capa: Buscamos Backdrops (Cenas)
                    const imageData = await tmdbApi.get(`${media.media_type}/${media.id}/images`, { include_image_language: 'en,pt,null' });
                    // Pegamos os top 15 backdrops
                    const backdrops = imageData.backdrops
                        .slice(0, 15)
                        .map((img, index) => ({
                            id: index,
                            url: `https://image.tmdb.org/t/p/original${img.file_path}`,
                            label: 'Cena Oficial'
                        }));
                    setImages(backdrops);
                }
            } catch (error) {
                console.error("Erro ao buscar imagens:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchImages();
    }, [media, targetType]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[90] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800/90 backdrop-blur-lg border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">
                            Escolher {targetType === 'avatar' ? 'Personagem' : 'Capa'}
                        </h3>
                        <p className="text-sm text-gray-400">De: {media.title || media.name}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={onBack} className="text-sm text-indigo-400 hover:text-indigo-300 px-3 py-1 rounded border border-indigo-500/30">Voltar</button>
                        <button onClick={onClose}><CloseIcon className="w-6 h-6 text-gray-400 hover:text-white"/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? <Spinner /> : (
                        images.length > 0 ? (
                            <div className={`grid gap-4 ${targetType === 'avatar' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                {images.map(img => (
                                    <div 
                                        key={img.id} 
                                        onClick={() => onSelectImage(img.url)}
                                        className="group cursor-pointer flex flex-col"
                                    >
                                        <div className={`relative overflow-hidden rounded-lg border-2 border-transparent group-hover:border-indigo-500 transition-all ${targetType === 'avatar' ? 'aspect-[2/3]' : 'aspect-video'}`}>
                                            <img 
                                                src={img.url} 
                                                alt={img.label}
                                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                        </div>
                                        {img.label && <p className="text-xs text-gray-400 mt-2 text-center truncate group-hover:text-white">{img.label}</p>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 mt-10">Nenhuma imagem encontrada para este conteúdo.</p>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeneratedImageSelectionModal;