import React, { memo, useMemo, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import ContentCard from './ContentCard';

const ContentCarousel = ({ title, content = [], mediaType = 'movie' }) => {
	// SECURITY: Create a deterministic, safe DOM id from title to avoid invalid characters and potential DOM id injection.
	const titleId = useMemo(() => {
		const base = String(title || 'carousel')
			.trim()
			.toLowerCase();
		// Keep only alphanumerics, dash and underscore to produce valid id tokens.
		return `carousel-title-${base.replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '')}`;
	}, [title]);

	// EARLY RETURN: Avoid rendering when there's no content.
	if (!Array.isArray(content) || content.length === 0) {
		return null;
	}

	// ACCESSIBILITY: Provide keyboard support for horizontal scrolling; ref points to the scroll container.
	const listRef = useRef(null);

	// PERFORMANCE: Stable handler prevents re-creation on every render and allows memoized children to benefit.
	const onKeyDown = useCallback((e) => {
		const node = listRef.current;
		if (!node) return;

		// UX: Scroll by a fraction of the visible width for predictable navigation.
		const scrollAmount = Math.max(Math.floor(node.clientWidth * 0.8), 160);

		switch (e.key) {
			case 'ArrowRight':
				node.scrollBy({ left: scrollAmount, behavior: 'smooth' });
				e.preventDefault();
				break;
			case 'ArrowLeft':
				node.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
				e.preventDefault();
				break;
			case 'Home':
				node.scrollTo({ left: 0, behavior: 'smooth' });
				e.preventDefault();
				break;
			case 'End':
				node.scrollTo({ left: node.scrollWidth, behavior: 'smooth' });
				e.preventDefault();
				break;
			default:
				// no-op for other keys
				break;
		}
	}, []);

	// PERFORMANCE: Memoize the rendered list items to avoid recreating JSX when content/mediaType references are stable.
	const items = useMemo(() => {
		return content.map((item) => {
			// CONTRACT: Ensure each item has an id; if absent, fall back to a stable JSON hash could be used.
			const key = item && (item.id ?? `${mediaType}-${Math.abs(JSON.stringify(item).length)}`);
			return (
				<li key={key} className="w-32 md:w-48 flex-shrink-0" role="listitem">
					<ContentCard content={item} mediaType={mediaType} />
				</li>
			);
		});
	}, [content, mediaType]);

	return (
		<section className="mb-8" aria-labelledby={titleId}>
			<h3 id={titleId} className="text-xl md:text-2xl font-bold mb-4 px-4 md:px-0">
				{title}
			</h3>

			{/* ACCESSIBILITY: make the list focusable for keyboard users and attach the keyboard handler for horizontal navigation */}
			<ul
				ref={listRef}
				className="flex overflow-x-auto space-x-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0"
				tabIndex={0}
				onKeyDown={onKeyDown}
				role="list"
				aria-label={title}
			>
				{items}
			</ul>
		</section>
	);
};

ContentCarousel.propTypes = {
	title: PropTypes.string.isRequired,
	// RELIABILITY: Require an array of objects where each object has an id to stabilize list keys.
	content: PropTypes.arrayOf(
		PropTypes.shape({
			id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
			// other known properties exist on the item but are validated closer to their consumers (ContentCard).
		})
	),
	mediaType: PropTypes.string,
};

export default memo(ContentCarousel);