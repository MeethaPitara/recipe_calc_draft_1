import { useEffect } from 'react';

export default function CopyProtection() {
  useEffect(() => {
    // Disable right-click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable keyboard shortcuts for copy/paste/print/view source
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + C (copy)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + U (view source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + S (save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + P (print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + Shift + I (dev tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      // F12 (dev tools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
    };

    // Disable text selection
    const disableSelection = () => {
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    };

    // Disable drag & drop
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable image saving
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragover', handleDragOver);
    disableSelection();

    // Add CSS to prevent selection
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      
      input, textarea {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragover', handleDragOver);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);

  return null;
}
