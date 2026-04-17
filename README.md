# Keepsafe Intelligence Reference

A self-contained demo showing how to integrate with the **Keepsafe Access** API as a third party. It walks through OAuth2 authentication, feed retrieval, and event visualization on an interactive map — the same flow your application would follow to consume Keepsafe data.

## What It Demonstrates

| Feature | Description |
|---|---|
| **OAuth2 Authentication** | Client credentials grant against AWS Cognito with the `keepsafe-access/api` scope. |
| **Feed Retrieval** | Fetching a user's event feed via `GET /v1/feed/{userid}` using a Bearer token. |
| **Asset Grouping** | Events grouped by asset (`_keepsafe.assetId` / `assetName`), showing how feeds relate to monitored assets. |
| **Event Categories** | Color-coded categories — Weather, Natural Disaster, Military Conflict, Police Activity, Infrastructure — derived from the feed item's `tags`. |
| **Map Visualization** | Geo-located events plotted on a Mapbox map with popups, click-to-fly, and bounded zoom. |

## Architecture

```
┌──────────────┐        ┌──────────────────┐        ┌─────────────────────┐
│   Browser    │──POST──▶  Backend Proxy   │──POST──▶  Cognito Token URL  │
│  index.html  │  /auth │  (Express)       │        └─────────────────────┘
│              │        │                  │
│              │──GET───▶  /feed           │──GET───▶  Keepsafe Access API │
│              │        │                  │         /v1/feed/{userid}
└──────────────┘        └──────────────────┘        └─────────────────────┘
```

The backend proxy exists so that the Cognito client secret never reaches the browser. The frontend calls two local endpoints (`POST /auth` and `GET /feed`) and the server handles token exchange and feed fetching.

## Getting Started

### Prerequisites

- Node.js 18+ (for native `fetch`)
- Keepsafe-provided Cognito credentials (`client_id`, `client_secret`, token URL)
- A Keepsafe Access base URL and user ID
- Set a mapbox token in index.html

### Environment Variables

Create a `.env` file (or export these) in the `backend/` directory:

| Variable | Purpose |
|---|---|
| `COGNITO_TOKEN_URL` | OAuth2 token endpoint (e.g. `https://<domain>.auth.<region>.amazoncognito.com/oauth2/token`) |
| `COGNITO_CLIENT_ID` | Your Cognito client ID |
| `COGNITO_CLIENT_SECRET` | Your Cognito client secret |
| `KEEPSAFE_ACCESS_URL` | Keepsafe Access API base URL (no trailing slash) |
| `KEEPSAFE_USER_ID` | The user ID whose feed to retrieve |
| `PORT` | Server port (default `3000`) |
| `ALLOWED_ORIGIN` | CORS origin (default `*`) |

### Run Locally

```bash
cd backend
npm install
PORT=3000 node server.js
```

Then open `index.html` in a browser (or visit `http://localhost:3000` which serves a copy).

### Run with Docker

```bash
cd backend
docker build -t keepsafeintelligence-reference .
docker run -p 3000:3000 \
  -e COGNITO_TOKEN_URL=... \
  -e COGNITO_CLIENT_ID=... \
  -e COGNITO_CLIENT_SECRET=... \
  -e KEEPSAFE_ACCESS_URL=... \
  -e KEEPSAFE_USER_ID=... \
  keepsafeintelligence-reference
```

## Integration Flow

The UI guides you through three sequential steps:

1. **Authenticate** — Sends `POST /auth` to the backend, which performs a `client_credentials` grant and caches the access token server-side.
2. **Fetch Feed** — Sends `GET /feed` to the backend, which calls `GET /v1/feed/{userid}` on Keepsafe Access with the cached Bearer token.
3. **Visualize** — Renders the returned events as a sidebar list (grouped by asset) and as map markers with popups.

## Key Code Touchpoints

These are the files and sections most relevant if you're building your own integration.

### `backend/server.js` — Auth & Feed Proxy

| Lines | What It Does |
|---|---|
| 8–12 | Environment variable configuration |
| 24–51 | `POST /auth` — Cognito token exchange with `client_credentials` grant |
| 53–75 | `GET /feed` — Proxied call to Keepsafe Access `/v1/feed/{userid}` |

### `index.html` — Frontend Client

| Lines | What It Does |
|---|---|
| 470–476 | `CONFIG` — API base URL, Mapbox token, map style |
| 478–496 | Category color/label mapping from feed `tags` |
| 527–561 | `authenticate()` — Calls the backend auth endpoint |
| 563–601 | `fetchFeed()` — Calls the backend feed endpoint |
| 603–657 | `renderEvents()` — Groups items by `_keepsafe.assetId` and renders cards |
| 659–712 | `renderMap()` — Plots markers from `_keepsafe.lat`/`lon` coordinates |

## Feed Data Shape

The feed follows the [JSON Feed](https://www.jsonfeed.org/) format. Each item includes standard fields plus Keepsafe-specific extensions under `_keepsafe`:

```json
{
  "id": "11:61918",
  "title": "Severe Thunderstorm Warning",
  "url": "https://source-link.example.com/tstorm-warning",
  "date_published": "2026-04-16T16:38:20.005Z",
  "date_modified": "2026-04-16T16:38:20.005Z",
  "content_text": "National Weather Service issued...",
  "tags": ["WEATHER"],
  "_keepsafe": {
    "assetId": 11,
    "assetName": "Seattle Office",
    "assetQuery": "Seattle, WA 25mi",
    "eventId": 61918,
    "lat": 47.6062,
    "lon": -122.3321,
    "radius": 79548,
    "ongoing": 1,
    "urls": [
      "https://source-link.example.com/tstorm-warning",
      "https://source-link.example.com/advisory-warning"
    ],
    "geojson": "https://keepsafe-assets.s3.us-west-2.amazonaws.com/events/<uuid>.geojson"
  }
}
```

| `_keepsafe` Field | Description |
|---|---|
| `eventId` | Unique event identifier (integer) |
| `lat` / `lon` | Event geolocation (centroid of the affected area) |
| `radius` | Radius in meters of the affected area |
| `ongoing` | Whether the event is still active (`1` = active, `0` = resolved) |
| `assetId` | The monitored asset this event is associated with (integer) |
| `assetName` | Human-readable asset label |
| `assetQuery` | The geographic query that matched this event to the asset |
| `urls` | Source URLs for the event (mirrors top-level `url`) |
| `geojson` | S3 URL for the event's GeoJSON geometry |
