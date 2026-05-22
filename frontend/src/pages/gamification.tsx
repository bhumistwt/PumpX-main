import React from 'react';
import { GamificationDashboard } from '../components/gamification';

export default function GamificationPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          🎮 Gamification Hub
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Track your XP, streaks, badges, battles, and squad progress
        </p>
      </div>

      <GamificationDashboard />
    </div>
  );
}
