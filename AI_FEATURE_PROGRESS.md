# AI Feature Progress

## Goal

Implement and test a spoiler-safe novel AI feature for LNReader with these requirements:

- Enable AI per novel.
- Download all chapters for a novel.
- Build a retrieval corpus for the novel.
- Allow reader-side text highlight + question answering.
- Prevent spoilers by only allowing context up to the current chapter/progress boundary.
- Use remote hosted models instead of local ML models.

## High-Level Architecture

### App side

The LNReader app was updated to:

- add per-novel AI enablement
- queue a background task to prepare AI data for a novel
- download missing chapters before indexing
- extract chapter text into chunks
- send chapter chunks to a separate backend via `/index`
- allow text selection in reader and call `/ask`
- block answers unless the novel AI status is `ready`

### Backend side

A separate backend was created under `backend/`:

- FastAPI app
- SQLite storage for chunks and vectors
- local BM25 / metadata filtering
- OpenRouter for embeddings
- OpenRouter for reranking
- OpenRouter for final answer generation

Important: no local LLM or local embedding model is used anymore.

## App-Side Work Completed

The app-side feature scaffolding and flow were implemented earlier. Relevant areas include:

- AI settings screen
- AI DB schema/query layer
- background task integration via `ServiceManager`
- novel screen AI enable action
- reader-side Ask AI modal
- backend request client
- chapter chunk extraction

Key files touched:

- [src/services/ai/indexNovel.ts](/home/sreeram/personal/lnreader/src/services/ai/indexNovel.ts)
- [src/services/ai/askQuestion.ts](/home/sreeram/personal/lnreader/src/services/ai/askQuestion.ts)
- [src/services/ai/backend.ts](/home/sreeram/personal/lnreader/src/services/ai/backend.ts)
- [src/services/ai/extractChunks.ts](/home/sreeram/personal/lnreader/src/services/ai/extractChunks.ts)
- [src/screens/settings/SettingsAIScreen.tsx](/home/sreeram/personal/lnreader/src/screens/settings/SettingsAIScreen.tsx)
- [src/screens/reader/components/AskAiModal.tsx](/home/sreeram/personal/lnreader/src/screens/reader/components/AskAiModal.tsx)
- [src/screens/novel/NovelScreen.tsx](/home/sreeram/personal/lnreader/src/screens/novel/NovelScreen.tsx)
- [src/services/ServiceManager.ts](/home/sreeram/personal/lnreader/src/services/ServiceManager.ts)
- [src/database/queries/AiQueries.ts](/home/sreeram/personal/lnreader/src/database/queries/AiQueries.ts)

## Backend Created

Created backend project under:

- [backend/pyproject.toml](/home/sreeram/personal/lnreader/backend/pyproject.toml)
- [backend/.env.example](/home/sreeram/personal/lnreader/backend/.env.example)
- [backend/README.md](/home/sreeram/personal/lnreader/backend/README.md)
- [backend/app/main.py](/home/sreeram/personal/lnreader/backend/app/main.py)
- [backend/app/config.py](/home/sreeram/personal/lnreader/backend/app/config.py)
- [backend/app/db.py](/home/sreeram/personal/lnreader/backend/app/db.py)
- [backend/app/openrouter.py](/home/sreeram/personal/lnreader/backend/app/openrouter.py)
- [backend/app/retrieval.py](/home/sreeram/personal/lnreader/backend/app/retrieval.py)
- [backend/app/schemas.py](/home/sreeram/personal/lnreader/backend/app/schemas.py)
- [backend/app/ids.py](/home/sreeram/personal/lnreader/backend/app/ids.py)

## Final Backend Model Strategy

Current intended backend configuration:

- embeddings: `openai/text-embedding-3-small`
- reranker: `qwen/qwen3-14b`
- answer: `qwen/qwen3-235b-a22b-2507`

Original requested stack included `BAAI/bge-m3` and `BAAI/bge-reranker-v2-m3`, but during testing we switched to fully remote OpenRouter-compatible hosted calls and used `text-embedding-3-small` because it is a safer hosted embeddings route for this setup.

## Major Problems Encountered And Fixes

### 1. Android build failed due to Java 8

Problem:

- Gradle plugin required Java 11+.
- machine was using Java 8 initially.

Fix:

- used local JDK 17 at `/home/sreeram/.local/jdks/jdk-17.0.18+8`
- exported `JAVA_HOME`

### 2. Android SDK path missing

Problem:

- Android build could not find SDK.

Fix:

- found SDK under `/home/sreeram/Android/Sdk`
- added [android/local.properties](/home/sreeram/personal/lnreader/android/local.properties)

### 3. Missing Android platform/build tools on first build

Problem:

- Gradle downloaded Build Tools 35 and Platform 31 on first run.

Fix:

- allowed build to install missing SDK components

### 4. Backend `/index` failed with OpenRouter 403

Problem:

- backend initially failed on `POST /index`
- traceback showed `403 Forbidden` for OpenRouter embeddings

Observed backend error:

- `Embedding request failed with 403: {"error":{"message":"Key limit exceeded (total limit)...`

Investigation:

- direct manual embeddings request using `.env` key succeeded
- backend still failed

Root cause:

- backend process was likely picking up a stale exported shell `OPENROUTER_API_KEY` instead of the `.env` key

Fix:

- changed [backend/app/config.py](/home/sreeram/personal/lnreader/backend/app/config.py) to:
  - `load_dotenv(ENV_FILE, override=True)`
- this forces `backend/.env` to override shell environment values

### 5. OpenRouter embeddings compatibility / request debugging

Extra backend hardening added:

- embeddings now use small batches
- backend now raises errors with response body included
- embeddings currently send one text at a time for maximum compatibility

File updated:

- [backend/app/openrouter.py](/home/sreeram/personal/lnreader/backend/app/openrouter.py)

### 6. App kept getting killed during long indexing runs

Problem:

- app appeared to "close suddenly" during long indexing
- logcat eventually showed the real reason

Critical log:

- `A foreground service of FOREGROUND_SERVICE_TYPE_SHORT_SERVICE did not stop within a timeout`
- service:
  - `com.asterinet.react.bgactions.RNBackgroundActionsTask`

Root cause:

- app manifest declared background task service as `shortService`
- large novel AI indexing is a long-running job, not a short service

Fix:

Updated [android/app/src/main/AndroidManifest.xml](/home/sreeram/personal/lnreader/android/app/src/main/AndroidManifest.xml):

- added:
  - `android.permission.FOREGROUND_SERVICE_DATA_SYNC`
- changed service from:
  - `android:foregroundServiceType="shortService"`
- to:
  - `android:foregroundServiceType="dataSync"`

This change requires reinstalling the Android app.

## Current Test Flow That Works

### Backend

Start backend:

```bash
cd /home/sreeram/personal/lnreader/backend
uv run lnreader-ai-backend
```

Health check:

```bash
curl http://127.0.0.1:8001/health
```

### Phone + backend connectivity

Using USB + adb reverse:

```bash
adb reverse tcp:8001 tcp:8001
adb reverse tcp:8081 tcp:8081
adb reverse --list
```

App backend URL:

```text
http://127.0.0.1:8001
```

### Android app build/install

After manifest fix, reinstall required:

```bash
cd /home/sreeram/personal/lnreader
export JAVA_HOME=/home/sreeram/.local/jdks/jdk-17.0.18+8
export ANDROID_HOME=/home/sreeram/Android/Sdk
export ANDROID_SDK_ROOT=/home/sreeram/Android/Sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
./android/gradlew -p android app:installDebug -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=arm64-v8a --console=plain
```

## Current Backend State During Successful Indexing

At one point, indexing was confirmed working with repeated:

- `POST /index HTTP/1.1" 200 OK`

Meaning:

- phone app successfully reached backend
- backend accepted chapter chunk uploads
- embeddings worked with the corrected key resolution

## Progress Persistence Behavior

Confirmed behavior:

- indexing progress is persisted in backend SQLite
- if app closes mid-run, already indexed chapters remain stored
- retrying indexing continues practically from existing indexed state

Observed stored progress example:

- `chapters indexed: 22`
- `chunks: 234`

Useful progress check command:

```bash
cd /home/sreeram/personal/lnreader/backend
python3 -c "import sqlite3; con = sqlite3.connect('data/lnreader_ai.sqlite3'); print('chapters indexed:', con.execute('select count(distinct chapter_id) from chunks').fetchone()[0]); print('chunks:', con.execute('select count(*) from chunks').fetchone()[0])"
```

## Important Current Limitation

Reader-side Ask AI only works when app-side AI novel state becomes `ready`.

Current app logic:

- if novel AI row is not `enabled` or `status !== 'ready'`
- reader throws:
  - `AI for this novel is not ready yet`

This means:

- partial indexing in backend is not enough for the UI
- the full app-side indexing job must complete at least once to mark the novel `ready`

## What The Logs Proved

### Not the problem

- backend URL
- adb reverse
- OpenRouter account credits in general
- embeddings endpoint access in general

### Actual problems proven

- stale environment key in backend process
- wrong Android foreground service type (`shortService`)

## What Needs To Be Done Next

### Required immediate step

Rebuild and reinstall the Android app after the manifest patch.

Without reinstall, Android will continue using the old `shortService` manifest and the app can still ANR/close during indexing.

### Then

1. open the app
2. confirm AI settings backend URL is still `http://127.0.0.1:8001`
3. trigger novel AI again
4. let indexing continue
5. watch backend for repeated `POST /index 200 OK`
6. check stored progress in SQLite
7. once full run finishes, test Ask AI in reader

## Practical Advice For Testing

For faster end-to-end validation:

- use a smaller novel first
- large novels with hundreds of chapters are valid, but slow

For large novels:

- keep backend running continuously
- keep phone connected
- keep LNReader unrestricted in battery settings
- let indexing continue across retries if needed

## Files Changed During Final Debugging Phase

- [backend/app/openrouter.py](/home/sreeram/personal/lnreader/backend/app/openrouter.py)
  - better embedding error output
  - one-at-a-time embedding requests
- [backend/app/config.py](/home/sreeram/personal/lnreader/backend/app/config.py)
  - `.env` now overrides shell env
- [android/app/src/main/AndroidManifest.xml](/home/sreeram/personal/lnreader/android/app/src/main/AndroidManifest.xml)
  - foreground service type changed from `shortService` to `dataSync`
  - added `FOREGROUND_SERVICE_DATA_SYNC`

## Known Good Commands

### Backend health

```bash
curl http://127.0.0.1:8001/health
```

### OpenRouter current key details

```bash
bash -lc 'set -a && source .env && set +a && curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPENROUTER_API_KEY"'
```

### Direct embeddings test

```bash
bash -lc 'set -a && source .env && set +a && curl --max-time 20 -i https://openrouter.ai/api/v1/embeddings -H "Authorization: Bearer $OPENROUTER_API_KEY" -H "Content-Type: application/json" -d "{\"model\":\"openai/text-embedding-3-small\",\"input\":[\"test\"]}"'
```

### Indexed progress check

```bash
python3 -c "import sqlite3; con = sqlite3.connect('data/lnreader_ai.sqlite3'); print('chapters indexed:', con.execute('select count(distinct chapter_id) from chunks').fetchone()[0]); print('chunks:', con.execute('select count(*) from chunks').fetchone()[0])"
```

## Summary

At this point:

- backend is functioning
- backend indexing requests can succeed
- progress persistence works
- the remaining operational blocker was Android killing the app due to `shortService`
- that manifest issue has been fixed in code, but the app must be rebuilt and reinstalled for the fix to take effect
