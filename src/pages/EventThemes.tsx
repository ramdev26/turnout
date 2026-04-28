import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OrganizerShell } from '../components/organizer/OrganizerShell';

type ThemeOption = {
  id: string;
  name: string;
  description: string;
  gradient: string;
};

const THEMES: ThemeOption[] = [
  {
    id: 'neo-green',
    name: 'Neo Green',
    description: 'Modern green conversion layout with clean cards.',
    gradient: 'from-emerald-400 via-green-400 to-lime-400',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark premium feel for concerts and nightlife events.',
    gradient: 'from-slate-800 via-indigo-700 to-violet-600',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm energetic look for festivals and social gatherings.',
    gradient: 'from-orange-400 via-rose-400 to-fuchsia-500',
  },
  {
    id: 'minimal',
    name: 'Minimal Light',
    description: 'Neutral clean theme suitable for corporate events.',
    gradient: 'from-neutral-200 via-zinc-100 to-white',
  },
];

export const EventThemes: React.FC = () => {
  const navigate = useNavigate();

  return (
    <OrganizerShell
      title="Choose a Prebuilt Theme"
      subtitle="Pick a theme first. You will land on the event form with this style pre-applied."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => navigate(`/events/new?theme=${encodeURIComponent(theme.id)}`)}
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`h-32 bg-gradient-to-br ${theme.gradient}`} />
            <div className="space-y-1 p-5">
              <h3 className="text-lg font-bold text-neutral-900">{theme.name}</h3>
              <p className="text-sm text-neutral-600">{theme.description}</p>
              <div className="pt-2 text-sm font-semibold text-[#00a95d]">Use this theme →</div>
            </div>
          </button>
        ))}
      </div>
    </OrganizerShell>
  );
};
