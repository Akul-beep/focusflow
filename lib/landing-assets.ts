/** Real product screenshots in /public/landing (synced from repo assets). */
export const LANDING_DASHBOARD = {
  src: "/landing/dashboard.png",
  width: 2012,
  height: 1176,
} as const;

export const LANDING_CALENDAR = {
  src: "/landing/calendar-schedule.png",
  width: 2904,
  height: 1682,
} as const;

/** Layout box for scroll animation (matches ~16:9.4 crop of dashboard). */
export const LANDING_SCROLL_MOCK_W = 1360;
export const LANDING_SCROLL_MOCK_H = Math.round((LANDING_SCROLL_MOCK_W * LANDING_DASHBOARD.height) / LANDING_DASHBOARD.width);
