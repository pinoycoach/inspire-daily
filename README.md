# Inspire Daily

**Three checked quotes a day, free.** Every day the app shows three quote cards, picked only from quotes a
person approved on the curator desk (`/#curate`), drawn as pictures in the visitor's own browser in three house
styles (Paper, Storm, Bold). Visitors save the picture and copy the caption. Every past day is kept, so the
collection grows as you approve more quotes. **Visitors trigger no AI calls,** so running cost is close to zero.

How the three are picked: newly approved quotes first, in the order you approved them; once all have been shown,
the least recently shown come back. The first visitor of the day freezes that day's three (so everyone sees the
same cards and the archive never changes). With fewer than 3 approved quotes, the page shows what there is and
waits. **Approve at least 3 new quotes a day to never repeat.** The day turns over at midnight in
`DAILY_TIMEZONE` (default Asia/Manila).

Removed from Inspire Engine on purpose: AI image and caption creation, photo upload, saved posts, personas, the
journal and reflections, streaks and XP, worksheets, series, monetize, the KGL studio, video and auto-posting.

**How it's built:**
- A small server (`server.ts`) serves the app and the day's quotes; no key ever reaches the browser.
- The only AI use is on the curator desk: labels and indexing when you process quotes (Gemini on Vertex, cents).
- Quotes, days, invites and accounts live in **Firestore**.
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
`https://inspire-daily-xxxxx.asia-southeast1.run.app`. **The curator code is needed now:** open the address with
`/#curate` on the end, approve at least 3 quotes (tick "I checked the source" for named authors), then open the
main page: today's three appear.

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

- **Visitors cost almost nothing:** the cards are drawn in their browser, and the server only reads the database.
- **The curator desk** uses Gemini for labels and indexing when you press "Label & index now" (cents).
- Rate limit: 400 requests per visitor per 10 minutes. `--max-instances 2` keeps the bill predictable.
- Before opening it to the public: remove the passcode from `--set-secrets` (keep `SESSION_SECRET`).

## Running it on your own computer (optional)

```bash
cp .env.example .env.local   # fill in Vertex settings, or GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
npm test                     # daily picking, session, store, invite and library rules
```

`.env.example` sets `DATA_STORE=memory`, so it runs without a database (nothing survives a restart).

## Settings

| Variable | What it does |
|---|---|
| `GOOGLE_GENAI_USE_VERTEXAI` | `true` to use Vertex AI and the project's billing |
| `GOOGLE_CLOUD_PROJECT` | Project ID that pays (Vertex mode) and holds the database |
| `FIRESTORE_DATABASE` | Named Firestore database. Use `inspire-daily` so data never mixes with Inspire Engine |
| `GOOGLE_CLOUD_LOCATION` | Vertex location. Default `global` |
| `GEMINI_API_KEY` | Use a Gemini API key instead of Vertex |
| `DATA_STORE` | `memory` keeps everything in memory instead of Firestore (local runs and tests) |
| `SESSION_SECRET` | Signs visitors' anonymous IDs. Must stay the same, or everyone starts fresh |
| `APP_PASSCODE` | Locks the app behind a passcode |
| `GENERAL_RATE_LIMIT_PER_10MIN` | All requests per visitor per 10 minutes. Default 400 |
| `JEV_API_KEY` | TypeSafe key for JEV, which labels quotes and flags possible misattributions |
| `ADMIN_CODE` | Curator code for `/#curate`. Without it, curating is off |
| `INVITE_ONLY` | `true` turns on Google sign-in + invite codes instead of the passcode |
| `GOOGLE_CLIENT_ID` | The OAuth Web client ID for "Sign in with Google" (public) |
| `ADMIN_EMAILS` | Comma-separated Google emails that are always members (you) |
| `JEV_MODEL`, `JEV_BASE_URL` | Override JEV's model (default `jev-latest`) or address |
| `MODEL_EMBED` | Override the embedding model name |
| `DAILY_TIMEZONE` | Whose midnight starts a new day's three. Default `Asia/Manila` |
| `PORT` | Port to listen on. Default 3000, or 8080 in the container |
