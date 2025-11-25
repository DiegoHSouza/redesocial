import React from 'react';
import ContentCard from './ContentCard';

const ContentCarousel = ({ title, content, mediaType = 'movie' }) => (
    <div className="mb-8">
        <h3 className="text-xl md:text-2xl font-bold mb-4 px-4 md:px-0">{title}</h3>
        <div className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0">
            {content.map((item) => (
                <div key={item.id} className="w-32 md:w-48 flex-shrink-0">
                    <ContentCard content={item} mediaType={mediaType} />
                </div>
            ))}
        </div>
    </div>
);

export default ContentCarousel;