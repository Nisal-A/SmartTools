import { useEffect, useState } from 'react';
import { getToolById, isToolLaunchable } from '../config/toolsRegistry.js';

/**
 * Recently opened tools (browser-local), surfaced in the Ctrl+K Command Switcher.
 */

const RECENT_TOOLS_KEY = 'smarttools_recent_tools';
const RECENT_TOOLS_EVENT = 'smarttools:recent-tools-changed';
const MAX_RECENT_TOOLS = 6;

function readRecentIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_TOOLS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function recordRecentTool(toolId) {
  if (!isToolLaunchable(getToolById(toolId))) return;
  const current = readRecentIds();
  if (current[0] === toolId) return;
  const next = [toolId, ...current.filter((id) => id !== toolId)].slice(0, MAX_RECENT_TOOLS);
  try {
    window.localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RECENT_TOOLS_EVENT));
  } catch {
    // Storage may be unavailable (private mode); recent tools are optional.
  }
}

export function useRecentTools() {
  const [recentIds, setRecentIds] = useState(readRecentIds);

  useEffect(() => {
    const sync = () => setRecentIds(readRecentIds());
    window.addEventListener(RECENT_TOOLS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(RECENT_TOOLS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return recentIds.map(getToolById).filter((tool) => isToolLaunchable(tool));
}

export default useRecentTools;
