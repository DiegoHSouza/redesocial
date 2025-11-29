// src/hooks/useShareCard.js
import { useState } from 'react';
import html2canvas from 'html2canvas';

export const useShareCard = () => {
    const [isSharing, setIsSharing] = useState(false);

    const shareContent = async (elementRef, title, text, url) => {
        if (!elementRef.current) return;
        setIsSharing(true);

        try {
            // Configuração otimizada para alta resolução
            const canvas = await html2canvas(elementRef.current, {
                useCORS: true,
                scale: 1, // Como já definimos o tamanho em 1080px, scale 1 é suficiente. Se ficar pixelado, aumente para 2.
                width: 1080, // Força a largura
                height: 1080, // Força a altura
                backgroundColor: '#000000', // Fundo preto para evitar transparências indesejadas
                logging: false,
                onclone: (clonedDoc) => {
                    // Truque: Garante que o elemento clonado esteja visível para o print
                    const element = clonedDoc.querySelector('[data-html2canvas-ignore="true"]')?.parentNode;
                     if(element) {
                         element.style.position = 'static';
                         element.style.top = 'auto';
                         element.style.left = 'auto';
                     }
                }
            });

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0)); // Qualidade máxima
            const file = new File([blob], 'cinesync-battle.png', { type: 'image/png' });

            const shareData = {
                title: title,
                text: text,
                url: url,
            };

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ ...shareData, files: [file] });
            } else if (navigator.share) {
                await navigator.share(shareData);
            } else {
                 // Fallback para desktop (opcional, pode remover se focar só em mobile)
                 console.log("Compartilhamento nativo não suportado, imagem gerada no console.");
                 console.log(canvas.toDataURL());
            }

        } catch (error) {
            console.error("Erro ao compartilhar:", error);
        } finally {
            setIsSharing(false);
        }
    };

    return { shareContent, isSharing };
};