# URL Navigator

URL Navigator is a static browser app and Chrome extension. The Vercel site needs no server or shared API secret. Each visitor can optionally add their own provider API key in Settings; it is kept in that browser's local storage and requests go directly from that browser to the selected provider. URL lookup and opening work without an API key.

## Deploy to Vercel

1. Push this folder to a Git repository and import it in Vercel, or run `vercel` from this folder.
2. Use the project root as the Root Directory. No build command or environment variables are needed; Vercel serves the static files and `vercel.json` maps `/` to `app.html`.
3. Share the resulting deployment URL. Each user enters their own key under Settings > Chat assistant. They need a provider/model that permits browser requests from the deployed origin; compatible providers may require allowing that origin in their CORS settings.

The API key is saved in that user's browser only. Clearing browser site data removes it. Never put a personal API key in this repository or Vercel environment variables for this client-side app.

## Use the website

Open the Vercel URL. Settings lets each visitor choose Anthropic, OpenAI, Groq, or an OpenAI-compatible endpoint, set their own API key/model, and import a personal curl URL list. Without importing one, the bundled `curl.txt` is used. Imported URLs, chats, and settings stay in that browser. Opening multiple URLs may be blocked by the browser popup blocker; allow popups for the site if needed.

In Settings, **Add a website URL** stores a new entry and category in that visitor's browser. Categories are suggested from the domain and path, and can be selected manually. Use **Download curl.txt** to export the current list, including category comments, for backup or to update the shared bundled file in the repository. A deployed static site cannot write into the repository's `curl.txt` on behalf of visitors.

The URL manager also supports renaming, categorizing, tagging, pinning, removing, and filtering bookmarks. The **Bookmarks** dashboard shows pinned and recently opened sites. Bookmark names, categories, tags, and pins are included in the exported `curl.txt`; recent history stays in that browser.

## Chrome extension

The same files still work as an unpacked Chrome extension: open `chrome://extensions`, enable Developer mode, and choose **Load unpacked** for this folder.
