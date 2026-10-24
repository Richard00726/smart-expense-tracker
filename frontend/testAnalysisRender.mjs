import React from 'react';
import { renderToString } from 'react-dom/server';
import AnalysisView from './src/components/AnalysisView.jsx';

// Mock localStorage
global.localStorage = {
  getItem: (key) => key === 'user' ? JSON.stringify({ currency: '₹' }) : null,
  setItem: () => {},
  removeItem: () => {}
};

try {
  const html = renderToString(React.createElement(AnalysisView, { refreshTrigger: [] }));
  console.log('Render succeeded! Output length:', html.length);
  console.log('Snippet:', html.slice(0, 200));
} catch (err) {
  console.error('RENDER ERROR CAUGHT:', err);
}
