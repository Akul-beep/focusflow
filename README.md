# Student Scheduler - AI-Powered Task Management

An intelligent student scheduling system that automates task management, reduces cognitive load, and provides emotional support through AI-powered task chunking, Pomodoro focus sessions, and motivational feedback.

## Features

### 🎯 Core Features
- **AI Task Scheduling**: Automatically organizes academic assignments using Google Gemini AI
- **Task Chunking**: Breaks down large tasks into manageable 15-45 minute micro-tasks
- **Pomodoro Focus Sessions**: Built-in Pomodoro timer (25 min focus + 5 min break)
- **Motivational Cues**: Inspirational messages, progress updates, and positive reinforcement
- **Progress Visualization**: Beautiful, non-competitive visualizations of growth and achievement
- **Calendar Integration**: FullCalendar integration for schedule visualization

### 🎨 Design
- **Claude AI-Inspired UI**: Warm, approachable design with carefully selected colors
- **Typography**: Poppins for headings, Lora for body text
- **Color Palette**: 
  - Primary: `#141413` (dark), `#FAF9F5` (light)
  - Accents: `#D97757` (orange), `#6A9BCC` (blue), `#788C5D` (green)

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd student-scheduler
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Then edit `.env.local` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Adding Tasks
1. Click the "Add Task" button in the header
2. Fill in task details:
   - Title (required)
   - Description (optional)
   - Due date (required)
   - Estimated hours (required)
   - Priority (low/medium/high)
   - Subject (optional)
3. The AI will automatically break down your task into micro-tasks

### Using Pomodoro Timer
1. Expand a task card
2. Click "Start Focus Session"
3. Work for 25 minutes, then take a 5-minute break
4. Track your focus time and build consistency

### Viewing Progress
- Check the progress visualization sidebar for:
  - Weekly goal completion
  - Tasks and micro-tasks completed
  - Total focus hours
  - Current streak

### Calendar View
- Switch to calendar view to see all tasks scheduled across days
- Tasks are automatically distributed based on due dates and priorities

## Technology Stack

- **Framework**: Next.js 16 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand with persistence
- **AI Integration**: Google Gemini Pro
- **Calendar**: FullCalendar
- **Icons**: Lucide React
- **Date Utilities**: date-fns

## Project Structure

```
student-scheduler/
├── app/
│   ├── api/
│   │   └── gemini/          # Gemini AI API routes
│   ├── page.tsx             # Main dashboard
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── components/
│   ├── AddTaskModal.tsx     # Task creation modal
│   ├── CalendarView.tsx     # Calendar visualization
│   ├── MotivationalMessages.tsx  # Motivational feedback
│   ├── PomodoroTimer.tsx    # Focus timer component
│   ├── ProgressVisualization.tsx # Progress charts
│   └── TaskCard.tsx         # Individual task display
├── lib/
│   ├── gemini.ts            # Gemini AI client functions
│   └── store.ts             # Zustand state management
└── types/
    └── index.ts             # TypeScript type definitions
```

## Key Features Explained

### AI Task Chunking
When you add a task, the system uses Gemini AI to intelligently break it down into micro-tasks. Each micro-task is:
- Specific and actionable
- 15-45 minutes long
- Logically sequenced
- Clear and measurable

### Pomodoro System
The built-in Pomodoro timer helps maintain focus:
- 25-minute focus sessions
- 5-minute breaks
- Automatic session tracking
- Progress integration

### Motivational System
The app provides:
- Encouragement messages when completing tasks
- Progress celebrations
- Reminders to take breaks
- Positive reinforcement

### Data Persistence
All data is stored locally in your browser using localStorage, so your tasks persist between sessions.

## Customization

### Weekly Goal
Default weekly goal is 20 hours. This can be adjusted in the store configuration.

### Pomodoro Duration
Default focus session is 25 minutes with 5-minute breaks. Modify in `components/PomodoroTimer.tsx`.

### Colors & Theme
Colors follow Claude AI's design system. Modify in `app/globals.css`.

## Troubleshooting

### Gemini API Errors
- Ensure your API key is correctly set in `.env.local`
- Check that you have API quota remaining
- Verify the key has access to Gemini Pro model

### Tasks Not Saving
- Check browser console for errors
- Ensure localStorage is enabled
- Try clearing browser cache

### Calendar Not Displaying
- Ensure FullCalendar dependencies are installed
- Check browser console for import errors

## Future Enhancements

Potential features for future versions:
- Multi-user support
- Cloud synchronization
- Advanced AI scheduling with availability
- Subject-specific templates
- Export/import functionality
- Mobile app version

## License

This project is created for educational purposes as part of IB Design MYP5.

## Support

For issues or questions, please check the code comments or refer to the component documentation.

---

Built with ❤️ for students who want to manage their workload effectively and reduce stress.
