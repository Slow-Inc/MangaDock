"use client";

import { useCallback, useContext, useEffect, useState, type MouseEvent } from "react";
import {
  CACHE_EVENT,
  type CachedBook,
  isFavorited,
  isLiked,
  toggleFavorite,
  toggleLiked,
} from "../lib/userCache";
import { AuthContext } from "../contexts/AuthContext";

/**
 * Reactive hook for a single book's favorite + liked state.
 * Subscribes to the CACHE_EVENT so all cards sharing the same bookId
 * stay in sync across the UI.
 *
 * When not logged in, toggles are blocked and `showLoginPrompt` is called.
 */
export function useBookActions(book: CachedBook) {
  const { user, showLoginPrompt } = useContext(AuthContext);
  const [favorited, setFavorited] = useState(false);
  const [liked, setLikedState] = useState(false);

  const sync = useCallback(() => {
    setFavorited(isFavorited(book.id));
    setLikedState(isLiked(book.id));
  }, [book.id]);

  useEffect(() => {
    sync();
    window.addEventListener(CACHE_EVENT, sync);
    return () => window.removeEventListener(CACHE_EVENT, sync);
  }, [sync]);

  const handleToggleFavorite = useCallback(
    (e?: MouseEvent) => {
      e?.stopPropagation();
      if (!user) { showLoginPrompt(); return; }
      toggleFavorite(book);
    },
    [book, user, showLoginPrompt]
  );

  const handleToggleLiked = useCallback(
    (e?: MouseEvent) => {
      e?.stopPropagation();
      if (!user) { showLoginPrompt(); return; }
      toggleLiked(book.id);
    },
    [book.id, user, showLoginPrompt]
  );

  return { favorited, liked, handleToggleFavorite, handleToggleLiked };
}
