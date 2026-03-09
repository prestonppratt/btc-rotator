# Authentication Toggle

## Development Mode (Auth Disabled)

Authentication is currently **DISABLED** for faster development.

### Current Setup
- File: `.env.local`
- Setting: `VITE_DISABLE_AUTH=true`
- Effect: App loads directly to dashboard without login

## Production Mode (Auth Enabled)

To enable authentication for production deployment:

### Option 1: Edit .env.local
```bash
# Change this line in .env.local:
VITE_DISABLE_AUTH=false
```

### Option 2: Remove .env.local
```bash
# Simply delete the file:
rm .env.local
```

### Option 3: Set in Production Environment
In your production deployment (e.g., AWS Amplify, Vercel, etc.):
- Do NOT set `VITE_DISABLE_AUTH` environment variable
- Or set it to `false`

## How It Works

The app checks `import.meta.env.VITE_DISABLE_AUTH` in `src/App.tsx`:
- If `true`: Bypasses all authentication, loads app directly
- If `false` or undefined: Requires login via AWS Cognito

## Important Notes

⚠️ **Never deploy to production with `VITE_DISABLE_AUTH=true`**

✅ The `.env.local` file is gitignored, so it won't be committed to version control

✅ Production builds will automatically require authentication unless explicitly disabled
