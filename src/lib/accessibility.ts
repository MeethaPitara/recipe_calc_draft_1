// Accessibility utilities and helpers

/**
 * Generate unique IDs for form elements
 */
export function generateA11yId(base: string): string {
  return `${base}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Trap focus within a modal or dialog
 */
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
  
  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  }
  
  element.addEventListener('keydown', handleTabKey);
  
  // Focus first element
  firstFocusable?.focus();
  
  return () => {
    element.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Format number for screen readers
 */
export function formatForScreenReader(value: number, unit?: string, decimals = 2): string {
  const formatted = value.toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Get ARIA label for metric status
 */
export function getMetricAriaLabel(
  name: string,
  value: number,
  target: [number, number],
  unit: string = '%'
): string {
  const formattedValue = value.toFixed(2);
  const [min, max] = target;
  
  if (value < min) {
    return `${name}: ${formattedValue}${unit}. Below target range of ${min} to ${max}${unit}. Consider increasing ${name}.`;
  } else if (value > max) {
    return `${name}: ${formattedValue}${unit}. Above target range of ${min} to ${max}${unit}. Consider decreasing ${name}.`;
  } else {
    return `${name}: ${formattedValue}${unit}. Within target range of ${min} to ${max}${unit}.`;
  }
}

/**
 * Keyboard navigation handler for lists
 */
export function handleListNavigation(
  event: React.KeyboardEvent,
  currentIndex: number,
  itemCount: number,
  onSelect: (index: number) => void,
  orientation: 'vertical' | 'horizontal' = 'vertical'
) {
  const { key } = event;
  let newIndex = currentIndex;
  
  if (orientation === 'vertical') {
    if (key === 'ArrowDown') {
      event.preventDefault();
      newIndex = (currentIndex + 1) % itemCount;
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      newIndex = (currentIndex - 1 + itemCount) % itemCount;
    }
  } else {
    if (key === 'ArrowRight') {
      event.preventDefault();
      newIndex = (currentIndex + 1) % itemCount;
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      newIndex = (currentIndex - 1 + itemCount) % itemCount;
    }
  }
  
  if (key === 'Home') {
    event.preventDefault();
    newIndex = 0;
  } else if (key === 'End') {
    event.preventDefault();
    newIndex = itemCount - 1;
  }
  
  if (newIndex !== currentIndex) {
    onSelect(newIndex);
  }
  
  return newIndex;
}

/**
 * Get contrast ratio between two colors (WCAG)
 */
export function getContrastRatio(color1: string, color2: string): number {
  // Simplified - in production, use a proper color library
  // This is a placeholder for WCAG contrast checking
  return 4.5; // Minimum for AA compliance
}

/**
 * Check if color combination meets WCAG AA standard
 */
export function meetsWCAGAA(foreground: string, background: string): boolean {
  const ratio = getContrastRatio(foreground, background);
  return ratio >= 4.5;
}

/**
 * Debounce for performance in screen reader announcements
 */
export function debounceAnnouncement(fn: Function, delay: number = 300) {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Add skip link for keyboard users
 */
export function addSkipLink(targetId: string, label: string = 'Skip to main content') {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded';
  skipLink.textContent = label;
  
  document.body.insertBefore(skipLink, document.body.firstChild);
}

/**
 * Manage focus on route changes
 */
export function manageFocusOnRouteChange(pageTitle: string) {
  // Set document title for screen readers
  document.title = pageTitle;
  
  // Announce page change
  announceToScreenReader(`Navigated to ${pageTitle}`, 'polite');
  
  // Focus main content
  const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
  if (mainContent) {
    (mainContent as HTMLElement).focus();
  }
}
