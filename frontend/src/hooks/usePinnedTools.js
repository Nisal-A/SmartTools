import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../app/AuthContext.jsx';
import { apiClient } from '../services/apiClient.js';
import {
  MAX_PINNED_TOOLS,
  getDefaultPinnedToolIds,
  getToolById,
  isToolLaunchable,
  sanitizePinnedToolIds,
} from '../config/toolsRegistry.js';

/**
 * Pinned Tools state shared by the Sidebar and Tools Hub.
 *
 * - Authenticated: persisted to `PATCH /api/v1/auth/me/pinned-tools` (optimistic, reverts on failure).
 * - Guest: persisted to `localStorage` (`smarttools_guest_pinned_tools`).
 * Max 5 pins; only launchable registry tools can be pinned.
 */

const GUEST_PINS_KEY = 'smarttools_guest_pinned_tools';
const PINS_CHANGED_EVENT = 'smarttools:pinned-tools-changed';

function readGuestPins() {
  try {
    const raw = window.localStorage.getItem(GUEST_PINS_KEY);
    if (!raw) return getDefaultPinnedToolIds();
    return sanitizePinnedToolIds(JSON.parse(raw));
  } catch {
    return getDefaultPinnedToolIds();
  }
}

export function usePinnedTools() {
  const { user, isAuthenticated, updateUser } = useAuth();
  const [guestPins, setGuestPins] = useState(readGuestPins);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const sync = () => setGuestPins(readGuestPins());
    window.addEventListener(PINS_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PINS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const pinnedIds = useMemo(() => {
    if (!isAuthenticated) return guestPins;
    return sanitizePinnedToolIds(
      Array.isArray(user?.pinnedToolIds) ? user.pinnedToolIds : getDefaultPinnedToolIds()
    );
  }, [isAuthenticated, user?.pinnedToolIds, guestPins]);

  const persist = useCallback(
    async (nextIds) => {
      const next = sanitizePinnedToolIds(nextIds);
      setError('');

      if (!isAuthenticated) {
        window.localStorage.setItem(GUEST_PINS_KEY, JSON.stringify(next));
        setGuestPins(next);
        window.dispatchEvent(new Event(PINS_CHANGED_EVENT));
        return { ok: true };
      }

      const previous = user?.pinnedToolIds;
      updateUser({ pinnedToolIds: next });
      setIsSaving(true);
      try {
        const res = await apiClient.patch('/auth/me/pinned-tools', { pinnedToolIds: next });
        const serverIds = res.data?.data?.pinnedToolIds;
        if (Array.isArray(serverIds)) updateUser({ pinnedToolIds: serverIds });
        return { ok: true };
      } catch (err) {
        updateUser({ pinnedToolIds: previous });
        setError(err.response?.data?.message || 'Unable to save pinned tools.');
        return { ok: false, reason: 'network' };
      } finally {
        setIsSaving(false);
      }
    },
    [isAuthenticated, user?.pinnedToolIds, updateUser]
  );

  const togglePin = useCallback(
    (toolId) => {
      const tool = getToolById(toolId);
      if (!isToolLaunchable(tool)) return Promise.resolve({ ok: false, reason: 'unavailable' });
      if (pinnedIds.includes(toolId)) return persist(pinnedIds.filter((id) => id !== toolId));
      if (pinnedIds.length >= MAX_PINNED_TOOLS) return Promise.resolve({ ok: false, reason: 'limit' });
      return persist([...pinnedIds, toolId]);
    },
    [pinnedIds, persist]
  );

  const isPinned = useCallback((toolId) => pinnedIds.includes(toolId), [pinnedIds]);

  return {
    pinnedIds,
    pinnedTools: pinnedIds.map(getToolById).filter(Boolean),
    isPinned,
    togglePin,
    isSaving,
    error,
    maxPins: MAX_PINNED_TOOLS,
    canPinMore: pinnedIds.length < MAX_PINNED_TOOLS,
  };
}

export default usePinnedTools;
