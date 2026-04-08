'use client';

import posthog from 'posthog-js';
import { useState } from 'react';
import Link from 'next/link';

export default function UpgradePage() {
  const [clicked, setClicked] = useState(false);

  const handleInterestClick = () => {
    try {
      posthog.capture('upgrade_priority_cta_clicked', {
        tier: 'priority',
        source: 'upgrade_page',
      });
    } catch {
      // analytics optional
    }
    setClicked(true);
  };

  return (
    <main className="min-h-screen bg-[#FAF9F5] p-6 md:p-10">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[#E8E6DC] bg-white p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-heading font-semibold uppercase tracking-wide text-[#B0AEA5]">
            Flowly Pro
          </p>
          <span className="rounded-full border border-[#E8E6DC] px-2.5 py-1 text-[11px] font-heading font-semibold text-[#D97757]">
            Intro price
          </span>
        </div>
        <h1 className="mt-2 font-heading text-2xl md:text-3xl font-bold text-[#141413]">
          Priority AI Scheduling
        </h1>
        <p className="mt-3 text-sm text-[#57544d] leading-relaxed">
          Built for students who rely on AI planning every day. Get faster responses during rush hours and priority processing for heavy exam workflows.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#E8E6DC] bg-[#FAF9F5] p-5">
            <p className="text-xs font-heading font-semibold uppercase tracking-wide text-[#B0AEA5]">
              Free
            </p>
            <p className="mt-2 font-heading text-2xl font-bold text-[#141413]">₹0</p>
            <p className="text-xs text-[#B0AEA5]">Current plan</p>
            <ul className="mt-4 space-y-1 text-sm text-[#57544d]">
              <li>• Standard AI queue</li>
              <li>• Core planner features</li>
              <li>• Best-effort during peak traffic</li>
            </ul>
          </div>
          <div className="rounded-xl border-2 border-[#141413] bg-white p-5">
            <p className="text-xs font-heading font-semibold uppercase tracking-wide text-[#D97757]">
              Pro
            </p>
            <div className="mt-2 flex items-end gap-2">
              <p className="font-heading text-3xl font-bold text-[#141413]">₹199</p>
              <p className="text-xs text-[#B0AEA5] pb-1">/month</p>
            </div>
            <p className="text-xs text-[#B0AEA5]">Early access pricing</p>
            <ul className="mt-4 space-y-1 text-sm text-[#57544d]">
              <li>• Priority AI queue (skip standard line)</li>
              <li>• Faster parse + exam planning response windows</li>
              <li>• Better reliability during peak load</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleInterestClick}
            className="px-4 py-2.5 rounded-lg bg-[#141413] text-white text-sm font-heading font-semibold hover:bg-[#2a2a28] transition-colors"
          >
            {clicked ? 'You are on the waitlist' : 'Join Pro waitlist'}
          </button>
          <Link
            href="/settings"
            className="px-4 py-2.5 rounded-lg border border-[#E8E6DC] bg-white text-[#141413] text-sm font-heading font-semibold hover:bg-[#FAF9F5] transition-colors text-center"
          >
            Back to settings
          </Link>
        </div>
        <p className="mt-3 text-[11px] text-[#B0AEA5]">
          Payments are not live yet. Clicking the button records demand so we can invite users in order.
        </p>
      </div>
    </main>
  );
}
