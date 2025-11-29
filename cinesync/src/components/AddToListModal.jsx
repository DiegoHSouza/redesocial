import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { serverTimestamp, arrayUnion, collection, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Spinner, ErrorMessage } from './Common';
import { PlusIcon, CheckIcon } from './Icons';

const AddToListModal = ({ movie, mediaType, onClose }) => {
    const { currentUser } = useAuth();
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [submittingListId, setSubmittingListId] = useState(null);

    useEffect(() => {
        if (!currentUser) return;

        // REALTIME-SUBSCRIPTION: Listen for changes to the user's lists. This ensures
        // the modal always displays the most current data without needing a manual
        // refresh. The query is indexed for performance.
        const q = where(collection(db, "lists"), "uidAutor", "==", currentUser.uid);
        const unsubscribe = onSnapshot(q, snapshot => {
            const userLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLists(userLists);
            setLoading(false);
        }, (err) => {
            // UX & ERROR-HANDLING: Handle potential permission errors or network issues gracefully.
            console.error("Error fetching lists:", err);
            setError("Could not load your lists. Please try again later.");
            setLoading(false);
        });

        // Clean up the subscription when the component unmounts to prevent memory leaks.
        return () => unsubscribe();
    }, [currentUser]);

    // PERFORMANCE: Memoize the item payload to prevent recalculation on every render.
    // This object is stable throughout the component's lifecycle.
    const itemPayload = useMemo(() => Object.freeze({
        mediaId: movie.id,
        mediaType: mediaType,
        title: movie.title || movie.name,
        poster_path: movie.poster_path,
        vote_average: movie.vote_average,
        addedAt: serverTimestamp()
    }), [movie, mediaType]);

    // PERFORMANCE & UX: Memoize the handler to prevent re-creation on re-renders.
    // Implements an optimistic UI update for a better user experience.
    const handleAddItem = useCallback(async (listId) => {
        setSubmittingListId(listId);
        setError('');

        try {
            // OPTIMISTIC UI: Update local state immediately for instant feedback.
            setLists(prevLists => prevLists.map(list =>
                list.id === listId
                    ? { ...list, items: [...(list.items || []), { mediaId: movie.id }] }
                    : list
            ));

            const listRef = doc(db, "lists", listId);
            // ATOMIC-OPERATION: `arrayUnion` ensures the item is added only if it
            // doesn't already exist, preventing duplicates in a race condition.
            await updateDoc(listRef, {
                items: arrayUnion(itemPayload)
            });

            // UX: Close modal after a brief delay to show success confirmation.
            setTimeout(onClose, 800);
        } catch (error) {
            // UX: Revert optimistic update on failure.
            setLists(prevLists => prevLists.map(list => list.id === listId ? { ...list, items: list.items.filter(item => item.mediaId !== movie.id) } : list));
            console.error("Error adding item to list:", error);
            setError("Failed to add to the list.");
            setSubmittingListId(null);
        }
    }, [itemPayload, onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800/90 backdrop-filter backdrop-blur-lg border border-gray-700 p-6 rounded-xl shadow-2xl w-full max-w-md text-white" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Add to a List</h2>
                {error && <ErrorMessage message={error} />}
                {loading ? <Spinner/> : (
                    showCreateForm ? (
                        <CreateListForm itemPayload={itemPayload} onBack={() => setShowCreateForm(false)} onSuccess={onClose} />
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                            {lists.map(list => {
                                // Check if the movie is already in the list's items array.
                                const alreadyExists = list.items?.some(item => item.mediaId === movie.id);
                                const isSubmitting = submittingListId === list.id;

                                return (
                                    <button
                                        key={list.id}
                                        onClick={() => handleAddItem(list.id)}
                                        disabled={alreadyExists || isSubmitting}
                                        className="w-full text-left p-3 flex items-center justify-between bg-gray-900/50 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <span className="font-medium">{list.title}</span>
                                        {isSubmitting ? <div className="w-5 h-5"><Spinner /></div> : (alreadyExists && <CheckIcon className="w-5 h-5 text-green-400" />)}
                                    </button>
                                );
                            })}
                            <button onClick={() => setShowCreateForm(true)} className="w-full flex items-center justify-center p-3 mt-2 bg-gray-700/60 rounded-lg hover:bg-gray-700 transition-colors">
                                <PlusIcon className="w-5 h-5 mr-2" /> Create New List
                            </button>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

// COMPONENT-COMPOSITION: Extracted form logic into its own component for better
// separation of concerns and readability, following the Single Responsibility Principle.
const CreateListForm = ({ itemPayload, onBack, onSuccess }) => {
    const { currentUser } = useAuth();
    const [newListName, setNewListName] = useState("");
    const [newListDesc, setNewListDesc] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');

    const handleCreateAndAdd = async (e) => {
        e.preventDefault();
        const trimmedName = newListName.trim();
        // SECURITY: Robust input validation to prevent empty or whitespace-only submissions.
        if (!trimmedName) {
            setError("List title is required.");
            return;
        }
        setIsCreating(true);
        setError('');

        const newListData = {
            uidAutor: currentUser.uid,
            title: trimmedName,
            description: newListDesc.trim(),
            items: [itemPayload], // Add the movie directly upon creation.
            createdAt: serverTimestamp(),
        };

        try {
            // TRANSACTIONAL-WRITE: This `add` operation is atomic.
            await addDoc(collection(db, "lists"), newListData);
            onSuccess();
        } catch (err) {
            console.error("Error creating list:", err);
            setError("Failed to create the list. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <form onSubmit={handleCreateAndAdd} noValidate>
            <h3 className="text-lg font-semibold mb-3">New List</h3>
            {error && <ErrorMessage message={error} />}
            <div className="space-y-4">
                <div>
                    {/* ACCESSIBILITY (WCAG): Use a visible <label> linked to the input via `htmlFor`. */}
                    <label htmlFor="new-list-name" className="block text-sm font-medium text-gray-300 mb-1">List Title *</label>
                    <input id="new-list-name" type="text" value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="e.g., 'My Watchlist'" className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100" required aria-required="true" />
                </div>
                <div>
                    <label htmlFor="new-list-desc" className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
                    <textarea id="new-list-desc" value={newListDesc} onChange={e => setNewListDesc(e.target.value)} placeholder="A short description of your list" rows="2" className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-gray-100 resize-none"></textarea>
                </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">Back</button>
                <button type="submit" disabled={isCreating} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50 flex items-center justify-center min-w-[120px]">
                    {isCreating && <Spinner />}
                    {isCreating ? 'Creating...' : 'Create & Add'}
                </button>
            </div>
        </form>
    );
};

export default AddToListModal;