# Inspire Daily

A slim copy of Inspire Engine, kept to what a page owner needs to post: upload a photo of your product (or
make an image), get 5 ready-to-post captions (inspirational, question, informative, humorous, call to action)
for Instagram, Facebook, X, LinkedIn, TikTok or Threads, save the image with the text on it, and post it
yourself. **Nothing posts by itself.** There is also a quote vault with credits checked by a person.

Removed from Inspire Engine on purpose: the journal and "How are you today?", streaks, sparks and XP, WOOP
worksheets, series and paywall screens, the monetize screen, the KGL studio, video and auto-posting.

**What comes next** (not built yet, one at a time): each store's product facts and a check that captions
only state those facts, a selling calendar for "why today", three options waiting every morning, a morning
email with the link, and payments. See the Daily Three plan in `pinoycoach/diskarte-daily`
(`ideas/seller-posts-concept.md`).

**How it's built:**
- A small server (`server.ts`) makes every AI and database call, so **no key ever reaches the browser**.
- AI runs on **Vertex AI** (Gemini), which bills your Google Cloud project, or on a Gemini API key.
- Posts, settings, personas and quotes live in **Firestore**; post pictures live in **Cloud Storage**.
- Visitors get an **anonymous ID** signed by the server. Google sign-in and invite codes are optional.
- Hosted on **Cloud Run**.

Everything below runs in **Google Cloud Shell** (https://shell.cloud.google.com), signed in with the account
that owns the Google Cloud project. Nothing to install on your computer.

---

## Step 1: one-time Google Cloud setup

This app gets **its own database, bucket and secrets**, so it never mixes data with Inspire Engine even in
the same project. Replace `YOUR_PROJECT_ID`, then paste:

```bash
PROJECT=YOUR_PROJECT_ID
BUCKET=${PROJECT}-inspire-daily
gcloud config set project $PROJECT
gcloud services enable aiplatform.googleapis.com storage.googleapis.com firestore.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Its own database, named inspire-daily
gcloud firestore databases create --database=inspire-daily --location=asia-southeast1

# Its own private bucket for post pictures
gcloud storage buckets create gs://$BUCKET --location=asia-southeast1 --uniform-bucket-level-access
```

Let the app's Cloud Run identity use Vertex AI, the database and the bucket (if you already did this for
Inspire Engine in the same project, the first three lines are already done; running them again is harmless):

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
SA="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT --member="$SA" --role="roles/aiplatform.user" --condition=None
gcloud projects add-iam-policy-binding $PROJECT --member="$SA" --role="roles/datastore.user" --condition=None
gcloud projects add-iam-policy-binding $PROJECT --member="$SA" --role="roles/run.builder" --condition=None
gcloud storage buckets add-iam-policy-binding gs://$BUCKET --member="$SA" --role="roles/storage.objectAdmin"
```

**A session secret** (signs visitors' anonymous IDs; made for you, you never see it):

```bash
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create inspire-daily-session-secret --data-file=-
gcloud secrets add-iam-policy-binding inspire-daily-session-secret --member="$SA" --role="roles/secretmanager.secretAccessor"
```

**A passcode**, so nobody else spends your credit while you test. Type it at the hidden prompt, then Enter:

```bash
read -s -p "App passcode: " CODE && printf "%s" "$CODE" | gcloud secrets create inspire-daily-passcode --data-file=- && unset CODE
gcloud secrets add-iam-policy-binding inspire-daily-passcode --member="$SA" --role="roles/secretmanager.secretAccessor"
```

**Optional: the quote curator.** A curator code opens `/#curate`, where you approve quotes. A TypeSafe JEV key
lets JEV flag quotes that may be misattributed. Skip both for now if you like.

```bash
read -s -p "Curator code: " K && printf "%s" "$K" | gcloud secrets create inspire-daily-curator-code --data-file=- && unset K
gcloud secrets add-iam-policy-binding inspire-daily-curator-code --member="$SA" --role="roles/secretmanager.secretAccessor"
```

## Step 2: get the code

```bash
cd ~ && git clone https://github.com/pinoycoach/inspire-daily.git
cd inspire-daily
```

## Step 3: put it online

```bash
gcloud run deploy inspire-daily \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --max-instances 2 \
  --set-secrets APP_PASSCODE=inspire-daily-passcode:latest,SESSION_SECRET=inspire-daily-session-secret:latest \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$PROJECT,GCS_BUCKET=$BUCKET,FIRESTORE_DATABASE=inspire-daily
```

If you made the curator code, add `,ADMIN_CODE=inspire-daily-curator-code:latest` to `--set-secrets`.

Say **Y** if it asks to create a repository. It ends with a web address like
`https://inspire-daily-xxxxx.asia-southeast1.run.app`. Open it, enter the passcode, tap **Create**, upload a
product photo and make a post.

**Publishing changes later:** `cd ~/inspire-daily && git pull`, then the same deploy command. If you closed
Cloud Shell, set `PROJECT=…` and `BUCKET=${PROJECT}-inspire-daily` again first.

## Optional: the invite-only beta

Replaces the passcode with **Sign in with Google + an invite code**. Every member gets 3 invites; you make more
in `/#curate` → **Beta**, where you also see members and the waitlist.

1. Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID**, type *Web
   application*, and add your app's address under **Authorized JavaScript origins**. Copy the **Client ID**.
2. Deploy again, adding `,INVITE_ONLY=true,GOOGLE_CLIENT_ID=YOUR_CLIENT_ID,ADMIN_EMAILS=you@gmail.com` to
   `--set-env-vars`.

---

## Costs and protection

- **Captions and images** cost cents on Vertex; Firestore stays inside its free daily allowance at this size.
- **Rate limits per visitor:** 40 AI requests and 400 requests in total per 10 minutes.
- **Daily limits per visitor:** 20 AI images and 60 caption sets. **For everyone together:** 500 AI images.
- **`--max-instances 2`** keeps the bill predictable. Keep a **budget alert** (Billing → Budgets & alerts).
- Before opening it to the public: remove the passcode from `--set-secrets` (keep `SESSION_SECRET`), keep the
  limits, and read the **Privacy & Terms** page (footer link). Visitors can delete all their data there.

## Running it on your own computer (optional)

```bash
cp .env.example .env.local   # fill in Vertex settings, or GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
npm test                     # session, store, invite and library rules
```

`.env.example` sets `DATA_STORE=memory`, so it runs without a database (nothing survives a restart).

## Settings

| Variable | What it does |
|---|---|
| `GOOGLE_GENAI_USE_VERTEXAI` | `true` to use Vertex AI and the project's billing |
| `GOOGLE_CLOUD_PROJECT` | Project ID that pays (Vertex mode) and holds the database |
| `FIRESTORE_DATABASE` | Named Firestore database. Use `inspire-daily` so data never mixes with Inspire Engine |
| `GCS_BUCKET` | Bucket for post pictures |
| `GOOGLE_CLOUD_LOCATION` | Vertex location. Default `global` |
| `GEMINI_API_KEY` | Use a Gemini API key instead of Vertex |
| `DATA_STORE` | `memory` keeps everything in memory instead of Firestore (local runs and tests) |
| `SESSION_SECRET` | Signs visitors' anonymous IDs. Must stay the same, or everyone starts fresh |
| `APP_PASSCODE` | Locks the app behind a passcode |
| `RATE_LIMIT_PER_10MIN` | AI requests per visitor per 10 minutes. Default 40 |
| `GENERAL_RATE_LIMIT_PER_10MIN` | All requests per visitor per 10 minutes. Default 400 |
| `IMAGE_DAILY_LIMIT` | AI images per visitor per day. Default 20 |
| `CAPTION_DAILY_LIMIT` | Caption sets per visitor per day. Default 60 |
| `GLOBAL_IMAGE_DAILY_LIMIT` | AI images per day for everyone. Default 500 |
| `JEV_API_KEY` | TypeSafe key for JEV, which labels quotes and flags possible misattributions |
| `ADMIN_CODE` | Curator code for `/#curate`. Without it, curating is off |
| `INVITE_ONLY` | `true` turns on Google sign-in + invite codes instead of the passcode |
| `GOOGLE_CLIENT_ID` | The OAuth Web client ID for "Sign in with Google" (public) |
| `ADMIN_EMAILS` | Comma-separated Google emails that are always members (you) |
| `JEV_MODEL`, `JEV_BASE_URL` | Override JEV's model (default `jev-latest`) or address |
| `MODEL_TEXT`, `MODEL_TEXT_FALLBACK`, `MODEL_IMAGE`, `MODEL_EMBED` | Override model names |
| `PORT` | Port to listen on. Default 3000, or 8080 in the container |
