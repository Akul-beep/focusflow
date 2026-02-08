'use client';

import { useState } from 'react';
import { Shield, X, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';

const commonDistractions = [
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'tiktok.com',
  'reddit.com',
  'netflix.com',
  'discord.com',
];

export default function DistractionBlocker() {
  const { distractionSettings, updateDistractionSettings } = useStore();
  const [newSite, setNewSite] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    updateDistractionSettings({
      ...distractionSettings,
      enabled: !distractionSettings.enabled,
    });
  };

  const handleAddSite = () => {
    if (newSite.trim() && !distractionSettings.blockedSites.includes(newSite.trim())) {
      updateDistractionSettings({
        ...distractionSettings,
        blockedSites: [...distractionSettings.blockedSites, newSite.trim()],
      });
      setNewSite('');
    }
  };

  const handleRemoveSite = (site: string) => {
    updateDistractionSettings({
      ...distractionSettings,
      blockedSites: distractionSettings.blockedSites.filter((s) => s !== site),
    });
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-[#E8E6DC] shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FAF9F5] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#141413]" />
          </div>
          <h3 className="font-heading font-semibold text-base text-[#141413]">
            Site Blocker
          </h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={distractionSettings.enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-[#E8E6DC] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#6A9BCC] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#6A9BCC]"></div>
        </label>
      </div>

      {distractionSettings.enabled && (
        <>
          {distractionSettings.blockedSites.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1.5">
                {distractionSettings.blockedSites.slice(0, 3).map((site) => (
                  <div
                    key={site}
                    className="flex items-center gap-1 px-2 py-1 bg-[#FAF9F5] rounded border border-[#E8E6DC] text-xs text-[#141413]"
                  >
                    <span>{site}</span>
                    <button
                      onClick={() => handleRemoveSite(site)}
                      className="text-[#B0AEA5] hover:text-[#D97757]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {distractionSettings.blockedSites.length > 3 && (
                  <div className="px-2 py-1 bg-[#FAF9F5] rounded border border-[#E8E6DC] text-xs text-[#B0AEA5]">
                    +{distractionSettings.blockedSites.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}

          {expanded && (
            <div className="space-y-2 mb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSite}
                  onChange={(e) => setNewSite(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSite()}
                  placeholder="e.g., youtube.com"
                  className="flex-1 px-3 py-1.5 text-sm border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent"
                />
                <button
                  onClick={handleAddSite}
                  className="px-3 py-1.5 bg-[#141413] text-white rounded-lg hover:bg-[#2a2a28] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {commonDistractions
                  .filter((site) => !distractionSettings.blockedSites.includes(site))
                  .map((site) => (
                    <button
                      key={site}
                      onClick={() => {
                        updateDistractionSettings({
                          ...distractionSettings,
                          blockedSites: [...distractionSettings.blockedSites, site],
                        });
                      }}
                      className="px-2 py-1 text-xs bg-[#FAF9F5] border border-[#E8E6DC] rounded hover:bg-[#E8E6DC] transition-colors text-[#141413]"
                    >
                      + {site}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[#6A9BCC] hover:text-[#5a8bbd] font-heading font-medium"
          >
            {expanded ? 'Hide' : 'Add Sites'}
          </button>
        </>
      )}
    </div>
  );
}
