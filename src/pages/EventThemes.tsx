import React from 'react';
import { Navigate } from 'react-router-dom';

// The standalone prebuilt-theme chooser is retired: all events now use the
// single Minimal theme with selectable event-type presets on the create page.
export const EventThemes: React.FC = () => {
  return <Navigate to="/events/new" replace />;
};
