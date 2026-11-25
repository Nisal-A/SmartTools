import { useEffect } from 'react';

/**
 * Calls `onDismiss` when the user clicks/taps outside `ref` or presses Escape
 * while `isActive` is true. Used by navbar dropdowns and the mega-menu.
 */
export function useClickOutside(ref, isActive, onDismiss) {
  useEffect(() => {
    if (!isActive) return undefined;

    const handlePointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss();
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') onDismiss();
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, isActive, onDismiss]);
}

export default useClickOutside;
