import React, { useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { BADGES } from '../utils/gamification';
import { getAvatarUrl } from './Common';

const AchievementCard = memo(({ achievement, loading }) => {
    if (loading) {
        return <AchievementCardSkeleton />;
    }

    // ROBUSTNESS: Destructure with default values to prevent runtime errors
    // if the `achievement` prop or its nested properties are null/undefined.
    // This makes the component more resilient to inconsistent API responses.
    const { authorInfo, badgeId, timestamp, uidAutor } = achievement;

    // PERFORMANCE: Memoize the badge data and date formatting.
    // This avoids re-calculating on every render, ensuring the logic only runs
    // when `badgeId` or `timestamp` actually change.
    const { badgeData, formattedDate } = useMemo(() => {
        const foundBadge = Object.values(BADGES).find(b => b.id === badgeId) || {
            icon: '🏆',
            name: 'New Achievement',
            desc: 'The user unlocked a new badge!'
        };

        let dateStr = 'recently';
        if (timestamp) {
            const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
            dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        return { badgeData: foundBadge, formattedDate: dateStr };
    }, [badgeId, timestamp]);

    // ROBUSTNESS: If essential data like `uidAutor` is missing, render nothing.
    // This prevents a broken or incomplete component from appearing in the UI.
    if (!uidAutor || !authorInfo) {
        return null;
    }

    return (
        <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700 hover:border-yellow-500/30 transition-colors" role="article" aria-labelledby={`achievement-title-${badgeId}`}>
            <div className="flex items-center mb-4">
                <Link to={`/profile/${uidAutor}`}>
                    <img
                        src={getAvatarUrl(authorInfo.foto, authorInfo.nome)}
                        // ACCESSIBILITY & SEO: Provide a descriptive alt text.
                        alt={`Profile picture of ${authorInfo.nome || "User"}`}
                        className="w-10 h-10 rounded-full object-cover border border-gray-600 mr-3"
                        // UI/UX: Provides a fallback for broken images, maintaining UI consistency.
                        onError={(e) => { e.target.onerror = null; e.target.src = getAvatarUrl(null, authorInfo.nome); }}
                    />
                </Link>
                <div>
                    <p className="text-sm text-gray-300">
                        <Link to={`/profile/${uidAutor}`} className="font-bold text-white hover:underline">
                            {authorInfo.nome || "User"}
                        </Link>
                        <span className="mx-1">unlocked an achievement</span>
                    </p>
                    <p className="text-xs text-gray-500">
                        {formattedDate}
                    </p>
                </div>
            </div>
            <div className="bg-gradient-to-br from-gray-700/50 to-gray-900/50 rounded-lg p-6 flex flex-col items-center text-center border border-gray-600/50 relative overflow-hidden group">
                <div className="absolute inset-0 bg-yellow-500/5 blur-3xl rounded-full transform scale-0 group-hover:scale-150 transition-transform duration-700"></div>
                <div className="text-6xl mb-3 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">
                    {/* SECURITY: React automatically escapes string content, preventing XSS.
                        If `badgeData.icon` were an HTML string, it would require sanitization
                        (e.g., using a library like DOMPurify) before rendering. */}
                    {badgeData.icon}
                </div>
                <h3 id={`achievement-title-${badgeId}`} className="text-xl font-bold text-yellow-400 mb-1">
                    {badgeData.name}
                </h3>
                <p className="text-gray-400 text-sm max-w-xs">
                    {badgeData.desc}
                </p>
            </div>
        </div>
    );
});

const AchievementCardSkeleton = () => (
    <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700 animate-pulse">
        <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-700 mr-3"></div>
            <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-1.5"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            </div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-6 h-48"></div>
    </div>
);

export default AchievementCard;