import React, { useEffect, useRef } from 'react';

const AdSenseBlock = ({ 
    adSlot, 
    style = { display: 'block' }, 
    adFormat = 'auto', // 'auto' para responsivo, 'fluid' para in-feed
    layoutKey = ''     // Chave do layout para anúncios in-feed
}) => {
    const adRef = useRef(null);
    const hasPushedAd = useRef(false);

    useEffect(() => {
        const adElement = adRef.current;
        if (!adElement) return;

        // Usamos ResizeObserver para garantir que o anúncio só seja carregado
        // quando o contêiner tiver uma largura válida.
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                // Se o contêiner tiver largura e o anúncio ainda não foi carregado
                if (entry.contentRect.width > 0 && !hasPushedAd.current) {
                    try {
                        (window.adsbygoogle = window.adsbygoogle || []).push({});
                        hasPushedAd.current = true; // Marca como carregado
                        observer.disconnect(); // Para de observar após o sucesso
                    } catch (e) {
                        console.error("Erro ao carregar anúncio do AdSense:", e);
                    }
                }
            }
        });

        observer.observe(adElement);
        return () => observer.disconnect(); // Limpa o observer ao desmontar
    }, [adSlot]); // Re-executa se o adSlot mudar

    return (
        <div className="my-8 w-full flex justify-center min-h-[100px]">
            <ins 
                ref={adRef}
                className="adsbygoogle"
                style={style}
                data-ad-client="ca-pub-9862724529882534"
                data-ad-slot={adSlot}
                data-ad-format={adFormat}
                data-ad-layout-key={layoutKey}
                data-full-width-responsive="true"
            ></ins>
        </div>
    );
};

export default AdSenseBlock;