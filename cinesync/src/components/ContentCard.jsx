import React, { memo, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { StarIcon } from './Icons';
import { TMDB_IMAGE_URL } from '../services/tmdbApi';

// PERFORMANCE: Extract comparable snapshot of `content` to avoid re-renders from object identity changes.
// SECURITY: Only whitelist relevant fields used for rendering/navigation to reduce attack surface.
const snapshot = (c = {}) => ({
	media_type: c.media_type,
	mediaId: c.mediaId,
	id: c.id,
	title: c.title,
	name: c.name,
	poster_path: c.poster_path,
	vote_average: c.vote_average,
});

const ContentCard = ({ content, mediaType }) => {
	const navigate = useNavigate();

	// PERFORMANCE: Memoize derived card data; keeps inexpensive memo and guards against unstable upstream props.
	// SECURITY: Validate poster_path to ensure it is a relative path (starts with '/') before concatenation.
	const cardData = useMemo(() => {
		const type = mediaType || content?.media_type || 'movie';
		const idRaw = content?.id ?? content?.mediaId;
		const id = idRaw !== undefined && idRaw !== null ? String(idRaw) : '';
		const title = content?.title || content?.name || 'Untitled';

		// CORRECTNESS: treat numeric 0 vote_average as valid
		const rating = typeof content?.vote_average === 'number' ? content.vote_average.toFixed(1) : 'N/A';

		const posterPath = typeof content?.poster_path === 'string' ? content.poster_path : null;
		const posterIsRelative = posterPath && posterPath.startsWith('/');

		// SECURITY: Allow only trusted TMDB relative paths; fallback to Controlled placeholder to avoid external injection.
		const imageUrl = posterIsRelative
			? `${TMDB_IMAGE_URL}${posterPath}`
			: `https://via.placeholder.com/500x750?text=${encodeURIComponent(title)}`;

		return { type, id, title, rating, imageUrl };
	}, [content, mediaType]);

	// STABILITY: keep handler stable and only depend on the primitives required for navigation.
	const handleClick = useCallback(() => {
		if (!cardData.id || !cardData.type) return;
		// SECURITY: Encode route segments to prevent malformed URLs and path injection.
		navigate(`/detail/${encodeURIComponent(cardData.type)}/${encodeURIComponent(cardData.id)}`);
	}, [navigate, cardData.id, cardData.type]);

	// ACCESSIBILITY: handle Enter and Space activation; preventDefault on Space to avoid page scroll.
	const handleKeyDown = useCallback(
		(e) => {
			const key = e.key || e.keyIdentifier || '';
			if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
				// Prevent page from scrolling when Space is used to activate the control.
				if (key === ' ' || key === 'Spacebar') e.preventDefault();
				handleClick();
			}
		},
		[handleClick]
	);

	// STABILITY: stable image error handler to avoid recreating fallback logic each render.
	const handleImageError = useCallback((e) => {
		// SECURITY: Use a deterministic, encoded placeholder (no user-provided content interpolated unchecked).
		e.currentTarget.onerror = null;
		e.currentTarget.src = `https://via.placeholder.com/500x750?text=${encodeURIComponent(cardData.title)}`;
	}, [cardData.title]);

	return (
		<div
			className="cursor-pointer group min-h-12" // MOBILE: enforce minimum touch target height (48px)
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={0}
			aria-label={`View details for ${cardData.title}`}
		>
			<div className="relative">
				<img
					src={cardData.imageUrl}
					alt={`Poster for ${cardData.title}`}
					className="rounded-lg shadow-lg transform group-hover:scale-105 transition-transform duration-300 w-full aspect-[2/3] object-cover bg-gray-700"
					onError={handleImageError}
					loading="lazy"
				/>
				<div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300 rounded-lg"></div>
				<div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center space-x-1 backdrop-blur-sm">
					<StarIcon className="w-3 h-3 text-yellow-400" />
					<span>{cardData.rating}</span>
				</div>
			</div>
			<h3 className="text-sm font-semibold mt-2 group-hover:text-indigo-400 transition-colors truncate">
				{cardData.title}
			</h3>
		</div>
	);
};

// RELIABILITY: define prop contract to catch shape regressions early
ContentCard.propTypes = {
	content: PropTypes.shape({
		id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
		mediaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
		media_type: PropTypes.string,
		title: PropTypes.string,
		name: PropTypes.string,
		poster_path: PropTypes.string,
		vote_average: PropTypes.number,
	}),
	mediaType: PropTypes.string,
};

// PERFORMANCE: Avoid re-render when only unrelated object identity changes occur on `content`.
// Compare only the fields that influence rendering and navigation.
function areEqual(prevProps, nextProps) {
	const sameMediaType = prevProps.mediaType === nextProps.mediaType;
	const prevSnap = snapshot(prevProps.content);
	const nextSnap = snapshot(nextProps.content);

	// Shallow compare the snapshot fields
	for (const key of Object.keys(prevSnap)) {
		if (prevSnap[key] !== nextSnap[key]) return false;
	}
	return sameMediaType;
}

export default memo(ContentCard, areEqual);