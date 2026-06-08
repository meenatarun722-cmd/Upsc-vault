# 📚 UPSC Vault

Your ultimate UPSC memorization app with AI-powered flashcards, spaced repetition, and weak topic tracking.

## Features
- 📤 Upload unlimited PDFs
- 🧠 AI generates UPSC-style flashcards + MCQs automatically
- 🔁 SM-2 Spaced Repetition (like Anki)
- ⚠ Weak topic tracker
- 📊 Progress history & streaks
- 🎯 Statement-based MCQs (UPSC Prelims format)

## Deploy to Vercel (Free) — 5 Minutes

### Step 1: Get Gemini API Key (Free)
1. Go to https://aistudio.google.com
2. Click "Get API Key" → Create API Key
3. Copy the key

### Step 2: Upload to GitHub
1. Go to https://github.com → New Repository
2. Name it "upsc-vault" → Create
3. Upload all these files

### Step 3: Deploy on Vercel
1. Go to https://vercel.com
2. "Add New Project" → Import your GitHub repo
3. Go to "Environment Variables"
4. Add: `GEMINI_API_KEY` = your key from Step 1
5. Click Deploy!

Your app will be live at: https://upsc-vault-xxx.vercel.app 🎉

## Local Development
```bash
npm install
cp .env.example .env.local
# Add your Gemini API key to .env.local
npm run dev
```
