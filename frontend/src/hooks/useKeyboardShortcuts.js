import { useEffect, useCallback } from 'react';

/**
 * Custom hook for keyboard shortcuts.
 * @param {Object} shortcuts - Map of key combinations to handlers
 * @param {Object} options - Configuration options
 */
export const useKeyboardShortcuts = (shortcuts, options = {}) => {
    const { enabled = true, preventDefault = true } = options;

    const handleKeyDown = useCallback((event) => {
        if (!enabled) return;

        // Don't trigger shortcuts when typing in inputs
        const target = event.target;
        const isInputField = target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable;

        if (isInputField && !options.allowInInputs) return;

        // Build the key combination string
        const parts = [];
        if (event.ctrlKey || event.metaKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        parts.push(event.key.toLowerCase());

        const combo = parts.join('+');

        // Check if we have a handler for this combination
        if (shortcuts[combo]) {
            if (preventDefault) {
                event.preventDefault();
                event.stopPropagation();
            }
            shortcuts[combo](event);
        }
    }, [shortcuts, enabled, preventDefault, options.allowInInputs]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
};

/**
 * Default keyboard shortcuts for the drive app.
 */
export const createDriveShortcuts = ({
    onUpload,
    onDelete,
    onDownload,
    onNewFolder,
    onSearch,
    onEscape,
    onSelectAll
}) => ({
    'ctrl+u': onUpload,       // Upload file
    'delete': onDelete,        // Move to trash
    'ctrl+d': onDownload,      // Download selected
    'ctrl+n': onNewFolder,     // New folder
    'ctrl+f': onSearch,        // Focus search
    'escape': onEscape,        // Close modals
    'ctrl+a': onSelectAll,     // Select all
});

export default useKeyboardShortcuts;
