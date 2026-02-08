# Figma AI Prompt (Copy-Paste Ready)

Copy the text below and paste it into Figma's AI prompt:

---

Create 5 different dashboard design variations for a student task management platform. All variations must include the same core elements but with different layout approaches and visual styles.

**BASE DESIGN SYSTEM:**
- Colors (Claude AI Palette):
  * Background: #FAF9F5 (warm off-white)
  * Primary Text: #141413 (near-black)
  * Secondary Text: #B0AEA5 (medium gray)
  * Border/Divider: #E8E6DC (light beige)
  * Primary Accent: #6A9BCC (soft blue)
  * Success/Growth: #788C5D (sage green)
  * Warning/Urgent: #D97757 (coral orange)
  * Button Hover: #2a2a28 (darker black for dark buttons)
  * Tree Forest Colors (for TreeForest visualization): #788C5D (green), #6A9BCC (blue-green), #5A7A4E (dark green), #7BA56F (light green), #6B8E5A (olive)
- Typography: Poppins headings (600 weight, -0.02em letter-spacing), Lora body text (serif)
- Layout: Fixed 256px left sidebar, sticky header, main content area, right sidebar with components
- Shadow Colors: rgba(20, 20, 19, 0.05) for light shadows, rgba(20, 20, 19, 0.1) for medium shadows

**CORE COMPONENTS (all variations must include):**
1. Fixed left sidebar: Logo, navigation (Dashboard/Focus/Today/Calendar), active tasks counter
2. Sticky header: "Dashboard" title, active tasks subtitle, Quick Actions button
3. Stats cards row: 4 cards (Active Tasks, Overdue, Completed, Focus Hours)
4. Quick Start CTA card with "Start Focus Session" button
5. Filter tabs: All/Active/Overdue/Completed pills
6. Task list: Expandable task cards with micro-tasks
7. Right sidebar: TreeForest visualization, ProgressVisualization stats, MotivationalMessages feed, CalendarIntegration, DistractionBlocker

**VARIATION 1 - CARD-FOCUSED LAYOUT:**
Emphasize card-based design with enhanced visual separation. Use increased shadow depth (0 4px 12px rgba(20,20,19,0.08)) on all cards. Increase card spacing to 24px gaps. Use 2px borders with colored left border accents (4px width) on stats cards matching icon colors: #6A9BCC for Active Tasks, #D97757 for Overdue, #788C5D for Completed, #6A9BCC for Focus Hours. Add subtle texture overlay on #FAF9F5 background. Make stats cards larger with 48px icons and 32px padding, each with unique gradient overlay using rgba values: rgba(106, 155, 204, 0.1) for blue, rgba(120, 140, 93, 0.1) for green, rgba(217, 119, 87, 0.1) for orange. Right sidebar cards have alternating border radius (12px, 16px). Header has subtle gradient transition from white to #FAF9F5. Reasoning: Maximizes visual hierarchy through elevation, reduces cognitive load with clear separation, enables quick visual scanning.

**VARIATION 2 - MINIMALIST SPACIOUS:**
Maximum whitespace with ultra-clean aesthetic. Increase all padding: main content 48px, cards 32px internal, section gaps 40px. Remove or reduce borders to 0.5px, eliminate shadows, use background color shifts for separation (white cards on #FAF9F5 background). Increase typography scale: title 36px, headers 24px, line-height 1.6. Use outline icons at 20% smaller size. Stats cards minimal: just number and label, no backgrounds, icons above text, 40px gaps. Right sidebar: no card backgrounds, 48px spacing between components. Reduced color palette: primarily grayscale (#141413, #B0AEA5, #E8E6DC, #FAF9F5) with accents (#6A9BCC, #788C5D, #D97757) only for interactions and urgent states. Reasoning: Reduces visual noise, creates calming focused environment, appeals to users who value simplicity and mental clarity.

**VARIATION 3 - DASHBOARD-CENTRIC:**
Data-forward design emphasizing metrics and visualizations. Make stats cards 1.5x larger, full-width at top, each with mini-charts/progress indicators. Move TreeForest to main content area (40% width) using tree colors: #788C5D, #6A9BCC, #5A7A4E, #7BA56F, #6B8E5A. Add more metrics: weekly progress, streaks, completion rates, time distribution charts in header. Show progress indicators everywhere: prominent bars on task cards using #141413 fill, circular progress on stats, overall completion in header. Extensive color coding: priority-based task colors (#D97757 high, #6A9BCC medium, #788C5D low), gradient progress bars using rgba(106, 155, 204, 0.1) to rgba(120, 140, 93, 0.1), color-coded calendar blocks. Right sidebar becomes metrics-focused with expanded charts (line/bar/pie). Header includes quick stats bar. Use 12-column grid system. Reasoning: Serves data-driven users, provides constant feedback through metrics, transforms interface into productivity command center.

**VARIATION 4 - CONTENT-FIRST:**
Prioritize task list, sidebar becomes secondary/collapsible. Main content 75% width, right sidebar 25% (collapsible to icon-only). Make task cards larger with more detail visible, show micro-tasks inline, emphasize priority/due dates using color coding: #D97757 for high priority, #6A9BCC for medium, #788C5D for low. Integrate quick actions and filter tabs into header. Reduce stats to 2-column layout, smaller size, inline with header. Move TreeForest to top of sidebar or background element using tree colors (#788C5D, #6A9BCC, #5A7A4E, #7BA56F, #6B8E5A). Tighter sidebar spacing, compact components. Integrate Focus CTA as floating button (#141413 fill, hover #2a2a28) or inline with first task. Right sidebar: vertical scroll, compact feed. Reasoning: Serves users managing many tasks, reduces navigation overhead, maximizes content visibility, prioritizes efficiency.

**VARIATION 5 - BALANCED GRID:**
Perfect symmetry with equal visual weight. Three equal columns (33.33% each). Symmetrical layout: all cards same size, 24px consistent spacing, strict 8px baseline grid. Stats in perfect 2x2 grid. Equal accent color distribution per section: left sidebar uses #6A9BCC, main content uses #788C5D, right sidebar uses #D97757 accents. Consistent typography hierarchy: all section headers same size, uniform card titles. All icons 24px, same style/spacing, default #B0AEA5, active #6A9BCC. Strict 8px spacing system (multiples of 8). All cards identical styling: 12px radius, 24px padding, same shadow (rgba(20, 20, 19, 0.05)), #E8E6DC border. Everything aligns to grid lines. Reasoning: Creates visual harmony and order, reduces cognitive load through predictability, appeals to perfectionist users, ensures equal feature importance.

**TECHNICAL SPECS:**
- Frame: 1440px × 1024px desktop viewport
- Background: #FAF9F5
- Cards: Auto-layout vertical, 24px padding, 12px radius, white fill, #E8E6DC stroke (1px), shadow: rgba(20, 20, 19, 0.05)
- Buttons: Auto-layout horizontal, 12px 24px padding, 8px radius, #141413 fill, white text, hover: #2a2a28
- Secondary Buttons: White fill, #E8E6DC border, #141413 text, hover: #FAF9F5 background
- Icons: 24px × 24px, #B0AEA5 default, #6A9BCC active, #788C5D for success states
- Text Colors: #141413 primary, #B0AEA5 secondary, #6A9BCC for links/accents
- Focus States: 2px outline, #6A9BCC color, 2px offset
- TreeForest Colors: Use #788C5D, #6A9BCC, #5A7A4E, #7BA56F, #6B8E5A for tree variations
- Use auto-layout and constraints for all components
- Ensure 4.5:1 contrast ratio minimum (all text meets WCAG AA)
- Create hover states for all interactive elements
- Gradient overlays: rgba(106, 155, 204, 0.1) to rgba(120, 140, 93, 0.1) for subtle accents

Generate all 5 variations as separate artboards labeled: "Variation 1: Card-Focused", "Variation 2: Minimalist Spacious", "Variation 3: Dashboard-Centric", "Variation 4: Content-First", "Variation 5: Balanced Grid".

---
