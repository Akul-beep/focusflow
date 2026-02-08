# Quick Start Guide

## 1. Install Dependencies
```bash
npm install
```

## 2. Set Up Environment Variables
Create a `.env.local` file in the root directory:
```
GEMINI_API_KEY=your_api_key_here
```

Get your API key from: https://makersuite.google.com/app/apikey

## 3. Run the Development Server
```bash
npm run dev
```

## 4. Open in Browser
Navigate to http://localhost:3000

## First Steps

1. **Add Your First Task**
   - Click "Add Task" button
   - Fill in task details
   - The AI will automatically break it down into micro-tasks

2. **Start a Focus Session**
   - Expand a task card
   - Click "Start Focus Session"
   - Use the Pomodoro timer (25 min focus, 5 min break)

3. **Track Your Progress**
   - View progress in the sidebar
   - Check motivational messages
   - See your weekly goal progress

4. **Use Calendar View**
   - Switch to calendar view to see all tasks scheduled
   - Tasks are automatically distributed based on due dates

## Tips

- Complete micro-tasks to build momentum
- Use Pomodoro sessions for focused work
- Check motivational messages for encouragement
- Set realistic weekly goals
- Break down large tasks into smaller ones

## Troubleshooting

**API Errors**: Make sure your Gemini API key is correctly set in `.env.local`

**Tasks Not Saving**: Check browser console and ensure localStorage is enabled

**Calendar Not Showing**: Ensure all dependencies are installed (`npm install`)
