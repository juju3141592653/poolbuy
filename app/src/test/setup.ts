import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = '';
});

// jsdom has no scrolling; the router calls scrollTo on navigation.
window.scrollTo = () => {};
