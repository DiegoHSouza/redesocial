import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { SendIcon, DotsVerticalIcon, PencilIcon, TrashIcon, CheckIcon, CloseIcon } from './Icons';
import { getAvatarUrl } from './Common';
import ConfirmModal from './ConfirmModal';

const MAX_COMMENT_LENGTH = 1000; // SECURITY: limit payload size to reduce abuse and storage bloat

const CommentItem = memo(({ comment, reviewId, onEdit, onDelete }) => {
	// PERFORMANCE: memoize derived values to avoid causing re-renders in memoized component
	const navigate = useNavigate();
	const { currentUser } = useAuth();

	const isOwner = useMemo(() => currentUser && currentUser.uid === comment.uidAutor, [currentUser, comment.uidAutor]);
	const avatarSrc = useMemo(() => getAvatarUrl(comment.authorInfo?.foto, comment.authorInfo?.nome), [comment.authorInfo]);

	const [isEditing, setIsEditing] = useState(false);
	const [editedText, setEditedText] = useState(comment.text);
	const [showOptions, setShowOptions] = useState(false);
	const optionsRef = useRef(null);

	// SECURITY: click-outside handler is stable and only used for UI state; keep minimal footprint.
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (optionsRef.current && !optionsRef.current.contains(event.target)) {
				setShowOptions(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleUpdate = useCallback(() => {
		const sanitized = (editedText || '').trim().slice(0, MAX_COMMENT_LENGTH);
		if (!sanitized) return;
		onEdit(comment.id, sanitized);
		setIsEditing(false);
	}, [editedText, onEdit, comment.id]);

	const handleStartEdit = useCallback(() => {
		setIsEditing(true);
		setShowOptions(false);
	}, []);

	// ACCESSIBILITY: allow opening menu via keyboard and expose expanded state
	const toggleOptions = useCallback(() => setShowOptions(prev => !prev), []);

	return (
		<div className="flex items-start space-x-3 group">
			<img
				src={avatarSrc}
				alt={comment.authorInfo?.nome || 'User'}
				className="w-8 h-8 rounded-full object-cover cursor-pointer"
				onClick={() => navigate(`/profile/${comment.uidAutor}`)}
				onError={(e) => { e.target.onerror = null; e.target.src = getAvatarUrl(null, comment.authorInfo?.nome); }}
			/>
			<div className="flex-1 bg-gray-700/40 p-3 rounded-xl relative">
				{isEditing ? (
					<div className="flex items-center gap-2">
						<input
							type="text"
							value={editedText}
							onChange={(e) => setEditedText(e.target.value)}
							className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded focus:outline-none text-sm text-gray-100"
							autoFocus
							aria-label="Edit comment"
							maxLength={MAX_COMMENT_LENGTH}
							onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
						/>
						<button onClick={handleUpdate} aria-label="Confirm edit"><CheckIcon className="w-4 h-4 text-green-400" /></button>
						<button onClick={() => setIsEditing(false)} aria-label="Cancel edit"><CloseIcon className="w-4 h-4 text-red-400" /></button>
					</div>
				) : (
					<>
						<div className="flex justify-between items-start">
							<p className="font-semibold text-gray-100 cursor-pointer hover:underline text-sm" onClick={() => navigate(`/profile/${comment.uidAutor}`)}>
								{comment.authorInfo?.nome || 'User'}
							</p>
							{isOwner && (
								<div className="relative" ref={optionsRef}>
									<button
										onClick={toggleOptions}
										className="text-gray-400 hover:text-white p-2 group-hover:opacity-100 transition-opacity"
										aria-haspopup="menu"
										aria-expanded={showOptions}
										aria-controls={`comment-options-${comment.id}`}
										aria-label="Comment options"
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												toggleOptions();
											}
										}}
									>
										<DotsVerticalIcon className="w-4 h-4" />
									</button>
									{showOptions && (
										<div id={`comment-options-${comment.id}`} role="menu" className="absolute right-0 mt-2 w-40 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
											<button
												onClick={handleStartEdit}
												role="menuitem"
												tabIndex={0}
												className="w-full text-left flex items-center px-4 py-2 text-xs text-gray-300 hover:bg-indigo-600 hover:text-white"
												onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStartEdit(); } }}
											>
												<PencilIcon className="w-3 h-3 mr-2" /> Edit
											</button>
											<button
												onClick={() => onDelete(comment.id)}
												role="menuitem"
												tabIndex={0}
												className="w-full text-left flex items-center px-4 py-2 text-xs text-red-400 hover:bg-red-500 hover:text-white"
												onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDelete(comment.id); } }}
											>
												<TrashIcon className="w-3 h-3 mr-2" /> Delete
											</button>
										</div>
									)}
								</div>
							)}
						</div>
						{/* SECURITY: React escapes rendered strings by default; keep rendering as text to avoid XSS. */}
						<p className="text-gray-300 mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{comment.text}</p>
					</>
				)}
			</div>
		</div>
	);
});

const CommentSection = ({ review, onCountChange: onCountChangeProp, renderConfirmModal }) => {
	const navigate = useNavigate();
	const { currentUser, userData } = useAuth();
	const [comments, setComments] = useState([]);
	const [newComment, setNewComment] = useState("");
	const [loading, setLoading] = useState(true);
	const [isPosting, setIsPosting] = useState(false);

	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [commentToDelete, setCommentToDelete] = useState(null);

	const isPostingRef = useRef(false);

	// PERFORMANCE: stabilize callback identity to avoid unnecessary downstream effects
	const onCountChange = useCallback(onCountChangeProp, [onCountChangeProp]);

	useEffect(() => {
		let isMounted = true; // Flag para controlar se o componente está montado
		const q = db.collection("reviews").doc(review.id).collection("comments").orderBy("timestamp", "asc");

		const unsubscribe = q.onSnapshot(async (snapshot) => {
			const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
			// Garante que não tentaremos atualizar o estado se o componente já foi desmontado
			if (isMounted) onCountChange(commentsData.length);

			// DATA CONSISTENCY: If stored counter drifts, correct it. Avoid interfering during active posts.
			if (review.commentCount !== commentsData.length && !isPostingRef.current) {
				// Adicionada verificação para evitar chamadas em background ou desnecessárias
				if (document.hasFocus() && navigator.onLine) {
					db.collection("reviews").doc(review.id).update({ commentCount: commentsData.length })
						.catch(err => console.error("Erro ao auto-corrigir contador:", err));
				}
			}

			// PERFORMANCE: fetch missing author profiles only when necessary
			const authorIds = [...new Set(commentsData.map(c => c.uidAutor))];
			const authors = {};
			const authorsToFetch = authorIds.filter(id => !commentsData.some(c => c.uidAutor === id && c.authorInfo));

			if (authorsToFetch.length > 0) {
				const authorPromises = authorsToFetch.map(id => db.collection('users').doc(id).get());
				const authorDocs = await Promise.all(authorPromises);
				authorDocs.forEach(doc => {
					if (doc.exists) authors[doc.id] = doc.data();
				});
			}

			const commentsWithAuthors = commentsData.map(c => ({ ...c, authorInfo: c.authorInfo || authors[c.uidAutor] }));

			if (isMounted) {
				setComments(commentsWithAuthors);
				setLoading(false);
			}
		});
		return () => { isMounted = false; unsubscribe(); };
	}, [review.id, review.commentCount, onCountChange]);

	// SECURITY: sanitize and enforce length limit before attempting a write
	const handlePostComment = useCallback(async (e) => {
		e.preventDefault();
		if (!newComment || !newComment.trim() || !currentUser) return;

		const sanitized = newComment.trim().slice(0, MAX_COMMENT_LENGTH);

		setIsPosting(true);
		isPostingRef.current = true;

		const batch = db.batch();
		const reviewRef = db.collection("reviews").doc(review.id);
		const commentRef = reviewRef.collection("comments").doc();

		batch.set(commentRef, {
			text: sanitized,
			uidAutor: currentUser.uid,
			authorInfo: { nome: userData?.nome || 'User', foto: userData?.foto || null },
			timestamp: firebase.firestore.FieldValue.serverTimestamp(),
		});

		batch.update(reviewRef, { commentCount: firebase.firestore.FieldValue.increment(1) });
		const userRef = db.collection("users").doc(currentUser.uid);
		batch.update(userRef, { 'stats.comments': firebase.firestore.FieldValue.increment(1) });

		try {
			await batch.commit();
			// UX: clear input on success; snapshot listener will deliver the authoritative comment object.
			setNewComment("");
			if (review.uidAutor !== currentUser.uid) {
				db.collection("notifications").add({
					recipientId: review.uidAutor,
					senderId: currentUser.uid,
					type: 'comment',
					mediaId: review.movieId,
					mediaType: review.mediaType || 'movie',
					read: false,
					timestamp: firebase.firestore.FieldValue.serverTimestamp(),
				}).catch(err => console.error("Failed to send notification:", err));
			}
		} catch (error) {
			console.error("Erro ao postar comentário:", error);
		} finally {
			setIsPosting(false);
			isPostingRef.current = false;
		}
	}, [newComment, currentUser, review, userData]);

	const handleUpdateComment = useCallback(async (commentId, newText) => {
		try {
			const sanitized = (newText || '').trim().slice(0, MAX_COMMENT_LENGTH);
			if (!sanitized) return;
			await db.collection("reviews").doc(review.id).collection("comments").doc(commentId).update({ text: sanitized });
		} catch (error) {
			console.error("Error updating comment:", error);
		}
	}, [review.id]);

	const requestDelete = useCallback((commentId) => {
		setCommentToDelete(commentId);
		setDeleteModalOpen(true);
	}, []);

	const confirmDeleteComment = useCallback(async () => {
		if (!commentToDelete) return;

		const originalComments = comments;
		// OPTIMISTIC UI: remove immediately for responsive feeling; rollback if DB fails
		const updatedList = comments.filter(c => c.id !== commentToDelete);
		setComments(updatedList);
		onCountChange(updatedList.length);

		const batch = db.batch();
		const reviewRef = db.collection("reviews").doc(review.id);
		const commentRef = reviewRef.collection("comments").doc(commentToDelete);
		const userRef = db.collection("users").doc(currentUser.uid);

		batch.delete(commentRef);
		batch.update(reviewRef, { commentCount: firebase.firestore.FieldValue.increment(-1) });
		batch.update(userRef, { 'stats.comments': firebase.firestore.FieldValue.increment(-1) });

		try {
			await batch.commit();
		} catch (error) {
			console.error("Erro ao excluir comentário:", error);
			// ROLLBACK
			setComments(originalComments);
			onCountChange(originalComments.length);
		} finally {
			setDeleteModalOpen(false);
			setCommentToDelete(null);
		}
	}, [commentToDelete, comments, review.id, currentUser, onCountChange]);

	return (
		<>
			<div className="space-y-4">
				{loading && <p className="text-xs text-gray-400">Carregando...</p>}

				{!loading && comments.length === 0 && (
					<p className="text-xs text-gray-500 italic text-center py-2">Seja o primeiro a comentar!</p>
				)}

				{!loading && comments.length > 0 && (
					<div className="space-y-4">
						{comments.map(comment => (
							<CommentItem
								key={comment.id}
								comment={comment}
								reviewId={review.id}
								onEdit={handleUpdateComment}
								onDelete={requestDelete}
							/>
						))}
					</div>
				)}
				{currentUser && (
					<form onSubmit={handlePostComment} className="flex items-start space-x-3 pt-4">
						<img
							src={getAvatarUrl(userData?.foto, userData?.nome)}
							alt="Your avatar"
							className="w-8 h-8 rounded-full object-cover"
							onError={(e) => { e.target.onerror = null; e.target.src = getAvatarUrl(null, userData?.nome); }}
						/>
						<div className="relative flex-1">
							<input
								type="text"
								value={newComment}
								onChange={(e) => setNewComment(e.target.value)}
								placeholder="Adicionar um comentário..."
								className="w-full px-4 py-2 bg-gray-900/70 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100 text-sm pr-12"
								aria-label="Add a comment"
								maxLength={MAX_COMMENT_LENGTH}
							/>
							{newComment && (
								<button
									type="submit"
									disabled={isPosting}
									className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
									aria-label="Send comment"
								>
									<SendIcon className="w-5 h-5" />
								</button>
							)}
						</div>
					</form>
				)}
			</div>

			{/* O modal agora é renderizado pelo componente pai através desta função */}
			{renderConfirmModal(
				<ConfirmModal
					isOpen={deleteModalOpen}
					onClose={() => setDeleteModalOpen(false)}
					onConfirm={confirmDeleteComment}
					title="Apagar Comentário"
					message="Tem certeza que deseja apagar este comentário?"
					confirmText="Apagar"
					isDanger={true}
				/>
			)}
		</>
	);
};

export default CommentSection;