# Environment Setup

Create a `.env.local` file in the root directory with the following:

```
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
```

## Getting a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into your `.env.local` file

## Important Notes

- Never commit `.env.local` to version control
- The API key is used server-side only for security
- This project reads the model name from `GEMINI_MODEL`. Default is `gemini-2.5-flash-lite`.
