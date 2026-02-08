# Figma AI Prompt: 5 Dashboard Design Variations

## Base Design System Reference

**Color Palette (Claude AI-Inspired):**
- Background: #FAF9F5 (warm off-white)
- Primary Text: #141413 (near-black)
- Secondary Text: #B0AEA5 (medium gray)
- Border/Divider: #E8E6DC (light beige)
- Primary Accent: #6A9BCC (soft blue)
- Success/Growth: #788C5D (sage green)
- Warning/Urgent: #D97757 (coral orange)
- Button Hover (Dark): #2a2a28 (darker black for dark button hover states)
- Tree Forest Colors: #788C5D (green), #6A9BCC (blue-green), #5A7A4E (dark green), #7BA56F (light green), #6B8E5A (olive)
- Shadow Colors: rgba(20, 20, 19, 0.05) for light shadows, rgba(20, 20, 19, 0.1) for medium shadows
- Gradient Overlays: rgba(106, 155, 204, 0.1) to rgba(120, 140, 93, 0.1) for subtle accents

**Typography:**
- Headings: Poppins (600 weight, -0.02em letter-spacing)
- Body: Lora (400 weight, serif)
- Font sizes: 3xl (30px) for main title, xl (20px) for section headers, base (16px) for body, sm (14px) for secondary

**Layout Structure:**
- Fixed left sidebar: 256px width, white background, border-right
- Main content area: Flexible width, 32px (8 units) padding
- Header: Sticky, white background, border-bottom, 24px vertical padding
- Grid system: 2/3 main content, 1/3 right sidebar on large screens
- Card styling: White background, rounded-xl (12px), border, subtle shadow
- Spacing: 24px (6 units) between major sections, 16px (4 units) between cards

**Core Components to Include:**
1. Fixed left sidebar with logo, navigation (Dashboard, Focus, Today, Calendar), and active tasks counter
2. Sticky header with "Dashboard" title, active tasks subtitle, and Quick Actions (Add Task button)
3. Stats Cards row: 4 cards (Active Tasks, Overdue, Completed, Focus Hours) in responsive grid
4. Quick Start CTA: Prominent card with "Start Focus Session" button
5. Filter tabs: Pills for All, Active, Overdue, Completed
6. Task list: Expandable task cards with micro-tasks
7. Right sidebar: TreeForest visualization, ProgressVisualization stats, MotivationalMessages feed, CalendarIntegration, DistractionBlocker

**Design Principles:**
- Professional, clean aesthetic (Claude AI-inspired)
- Non-competitive, growth-focused visualization
- Generous whitespace
- Subtle shadows and borders for depth
- Smooth transitions and hover states
- Clear visual hierarchy
- Accessible contrast ratios

---

## Design Variation 1: Card-Focused Layout
**Theme:** Emphasized card-based design with enhanced visual separation

**Key Differences:**
- **Card Elevation:** All cards have increased shadow depth (0 4px 12px rgba(20,20,19,0.08)) creating stronger depth perception
- **Card Spacing:** Increased gap between cards from 16px to 24px for better breathing room
- **Card Borders:** Slightly thicker borders (2px instead of 1px) with subtle color variations - stats cards have colored left border accent (4px width) matching their icon color
- **Background Pattern:** Very subtle texture overlay on background (#FAF9F5 with 0.5% opacity pattern) to add depth without distraction
- **Stats Cards:** Larger icons (48px instead of 40px), increased padding (32px instead of 20px), each card has unique subtle gradient overlay matching its color theme
- **Right Sidebar Cards:** Each component (TreeForest, ProgressVisualization, etc.) has distinct card styling with varying border radius (12px, 16px, 12px alternating) to create visual rhythm
- **Header Enhancement:** Header has subtle gradient from white to #FAF9F5 at bottom edge, creating seamless transition

**Reasoning:** This variation maximizes visual hierarchy through card elevation, making each section feel distinct and important. The enhanced shadows and spacing reduce cognitive load by clearly separating information chunks. The colored accents on stats cards provide quick visual scanning while maintaining professionalism. This approach works well for users who prefer clear visual boundaries and need to quickly distinguish between different types of information.

---

## Design Variation 2: Minimalist Spacious
**Theme:** Maximum whitespace, ultra-clean aesthetic with minimal visual elements

**Key Differences:**
- **Whitespace:** Increased padding throughout - main content padding from 32px to 48px, card internal padding from 20px to 32px, section gaps from 24px to 40px
- **Border Reduction:** All borders reduced to 0.5px or removed entirely, replaced with subtle background color shifts
- **Shadow Elimination:** No shadows on cards, instead using very subtle background color differences (white cards on #FAF9F5 background creates natural separation)
- **Typography Scale:** Larger font sizes - main title 36px (was 30px), section headers 24px (was 20px), increased line-height (1.6 instead of 1.5)
- **Icon Simplification:** Icons are outline style instead of filled, reduced size by 20%, more spacing around icons
- **Stats Cards:** Minimal design - just number and label, no background boxes, icons positioned above text, 40px gap between cards
- **Right Sidebar:** Components have no card backgrounds, just content floating with generous spacing (48px between components)
- **Color Usage:** Reduced color palette - primarily grayscale with accent colors only for interactive elements and urgent states

**Reasoning:** This variation prioritizes clarity and reduces visual noise, perfect for users who find busy interfaces overwhelming. The generous whitespace creates a calming, focused environment that reduces anxiety. The minimalist approach allows content to breathe and makes information easier to digest. This design philosophy aligns with modern minimalist productivity tools and appeals to users who value simplicity and mental clarity over visual richness.

---

## Design Variation 3: Dashboard-Centric
**Theme:** Data-forward design emphasizing metrics, visualizations, and progress tracking

**Key Differences:**
- **Stats Prominence:** Stats cards are larger (increased from standard to 1.5x size), positioned at top with full-width layout, each card shows mini-charts or progress indicators
- **Visualization Integration:** TreeForest visualization is larger and positioned prominently in main content area (not sidebar), takes up 40% of main content width
- **Data Density:** More metrics visible - weekly progress, streak counters, completion rates, time distribution charts integrated into header area
- **Progress Indicators:** Everywhere - task cards show progress bars more prominently, stats cards have circular progress indicators, header shows overall completion percentage
- **Color Coding:** More extensive use of color coding - tasks color-coded by priority throughout, progress bars use gradient fills, calendar integration shows color-coded time blocks
- **Right Sidebar:** Becomes metrics-focused with expanded ProgressVisualization showing multiple charts (line charts, bar charts, pie charts for time distribution)
- **Header Enhancement:** Header includes quick stats bar showing today's progress, weekly goal progress, and current streak
- **Grid System:** More structured grid - 12-column system with clear divisions, data visualizations have dedicated columns

**Reasoning:** This variation caters to data-driven users who thrive on seeing their progress quantified. The emphasis on metrics and visualizations provides constant feedback and motivation through data. Users who are goal-oriented and achievement-focused will appreciate seeing their productivity patterns visualized. The dashboard-centric approach transforms the interface into a command center for productivity, giving users comprehensive insights into their work habits and progress.

---

## Design Variation 4: Content-First
**Theme:** Prioritizes task list and content, sidebar becomes secondary/collapsible

**Key Differences:**
- **Main Content Width:** Main content area takes 75% of width (instead of 66%), right sidebar reduced to 25%
- **Collapsible Sidebar:** Right sidebar can collapse to icon-only mode, default state is expanded but narrower (280px instead of standard)
- **Task List Emphasis:** Task cards are larger with more detail visible by default, micro-tasks shown inline without expansion needed, priority and due dates more prominent
- **Header Integration:** Quick actions integrated into header bar, filter tabs moved to header as well, creating single unified navigation bar
- **Stats Cards:** Reduced to 2-column layout (instead of 4), smaller size, positioned inline with header
- **TreeForest:** Moved to top of right sidebar, smaller but still visible, or integrated as background element in main content
- **Whitespace Reduction:** Tighter spacing in sidebar to maximize main content area, cards have reduced padding
- **Focus Mode CTA:** Integrated into task list as floating action button or inline with first task card
- **Right Sidebar:** Stacked vertically with scroll, components are more compact, motivational messages shown as compact feed

**Reasoning:** This variation serves users who primarily interact with tasks and need to see as much content as possible. The content-first approach reduces navigation overhead and keeps users in their workflow. Users who manage many tasks simultaneously will benefit from seeing more tasks at once without scrolling. The collapsible sidebar maintains access to secondary features without sacrificing screen real estate. This design philosophy prioritizes efficiency and content density over visual polish.

---

## Design Variation 5: Balanced Grid
**Theme:** Perfect symmetry, equal visual weight to all sections, harmonious proportions

**Key Differences:**
- **Equal Column System:** Three equal columns (33.33% each) - left sidebar, main content, right sidebar all same width
- **Symmetrical Layout:** All cards same size, consistent spacing throughout (24px grid system), aligned to strict 8px baseline grid
- **Visual Balance:** Stats cards arranged in perfect 2x2 grid with equal spacing, all right sidebar components same height, task cards uniform sizing
- **Color Distribution:** Equal use of accent colors - each section gets one primary accent color, creating visual rhythm (sidebar: blue, main: green, right: orange accents)
- **Typography Harmony:** Consistent font size hierarchy - all section headers same size, all card titles same size, all body text same size
- **Icon Consistency:** All icons same size (24px), same style (filled), same spacing from text (12px)
- **Spacing System:** Strict 8px spacing system - all gaps multiples of 8 (8, 16, 24, 32, 40px)
- **Card Uniformity:** All cards have identical styling - same border radius (12px), same padding (24px), same shadow, same border width
- **Grid Alignment:** Everything aligns to invisible grid lines, creating perfect visual rhythm and harmony

**Reasoning:** This variation appeals to users who value visual harmony and organization. The balanced grid creates a sense of order and predictability that can reduce cognitive load. Users with perfectionist tendencies or those who appreciate systematic design will find this layout satisfying. The equal visual weight ensures no section dominates, creating a democratic interface where all features feel equally important. This approach works well for users who prefer structured, organized environments and appreciate attention to detail in design.

---

## Implementation Instructions for Figma AI

**For Each Variation:**
1. Create a new frame: 1440px width × 1024px height (desktop viewport)
2. Set background color to #FAF9F5
3. Build left sidebar first (256px width, full height)
4. Add header section (full width minus sidebar, 80px height)
5. Create stats cards row (4 cards, responsive grid)
6. Build main content area with filter tabs and task list
7. Add right sidebar with all components stacked vertically
8. Apply color palette consistently throughout
9. Use Poppins for all headings, Lora for body text
10. Ensure all interactive elements have hover states
11. Add subtle shadows and borders as specified per variation
12. Maintain 8px baseline grid alignment
13. Use auto-layout for all components to ensure proper spacing
14. Create component variants for different states (hover, active, etc.)

**Component Specifications:**
- Cards: Auto-layout vertical, padding 24px, corner radius 12px, fill white, stroke #E8E6DC (1px), shadow rgba(20, 20, 19, 0.05)
- Buttons: Auto-layout horizontal, padding 12px 24px, corner radius 8px, fill #141413, text white, hover fill #2a2a28
- Secondary Buttons: White fill, #E8E6DC border (1px), #141413 text, hover background #FAF9F5
- Icons: 24px × 24px, color #B0AEA5 (default), #6A9BCC (active), #788C5D (success states)
- Text Colors: #141413 (primary), #B0AEA5 (secondary), #6A9BCC (links/accents)
- Focus States: 2px outline, #6A9BCC color, 2px offset
- TreeForest Colors: #788C5D, #6A9BCC, #5A7A4E, #7BA56F, #6B8E5A
- Typography: Use text styles for consistency
- Spacing: Use constraints and auto-layout for responsive behavior

**Testing Checklist:**
- All text is readable (contrast ratio ≥ 4.5:1)
- Interactive elements have clear hover states
- Layout works at 1440px, 1280px, and 1024px widths
- Components maintain proper spacing at all sizes
- Color usage is consistent with design system
- Typography hierarchy is clear
- Visual weight is balanced per variation theme

---

## Additional Notes

**Accessibility:**
- Ensure focus states are visible (2px outline, #6A9BCC color)
- Maintain sufficient color contrast
- Use semantic HTML structure
- Provide alt text for all icons and images

**Responsive Behavior:**
- At 1024px: Right sidebar stacks below main content
- At 768px: Sidebar becomes collapsible drawer
- Stats cards: 4 columns → 2 columns → 1 column
- Maintain minimum touch target size (44px × 44px)

**Animation Considerations:**
- Card hover: Subtle lift (translateY -2px) with shadow increase
- Button hover: Background color shift, scale 1.02
- Sidebar collapse: Smooth width transition (300ms ease)
- Page transitions: Fade in (200ms ease-out)

Generate all 5 variations as separate artboards in a single Figma file, labeled clearly: "Variation 1: Card-Focused", "Variation 2: Minimalist Spacious", "Variation 3: Dashboard-Centric", "Variation 4: Content-First", "Variation 5: Balanced Grid".
