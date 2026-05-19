# Camcine API Frontend Integration Guide

This document is generated from the actual backend source in `src/app.js` and `src/routes/*`.

## Base URL

Local:

```txt
http://localhost:8080/api/v1
```

Deployed:

```txt
https://camcine-api-604298774917.asia-south1.run.app/api/v1
```

Health checks:

```http
GET /
GET /health
```

## Common Rules

JSON endpoints use:

```http
Content-Type: application/json
```

Authenticated endpoints use:

```http
Authorization: Bearer <jwt-token>
```

Successful responses generally follow:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Error responses generally follow:

```json
{
  "success": false,
  "message": "Error message",
  "errors": []
}
```

Important: there is no mounted `/api/v1/upload/*` route. Uploads are mounted under `/movies/upload/*`, `/episodes/upload/*`, and `/songs/upload/*`.

Large browser uploads should use the direct Google Cloud Storage flow documented below. Multipart upload routes still exist, but Cloud Run / Google Frontend can reject large request bodies with `413 Content Too Large` before Express receives the request.

## Auth

### Register

```http
POST /auth/register
```

Public.

Body:

```json
{
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+919876543210",
  "password": "secret123",
  "role": "viewer",
  "age": 25
}
```

Required: `email`, `first_name`, `last_name`, `password`.

Roles: `viewer`, `actor`, `manager`, `admin`.

### Login

```http
POST /auth/login
```

Public. Login can use one of `email`, `phone_number`, or `id`.

Body:

```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

Response includes token:

```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {}
  }
}
```

Frontend should store `data.token` and send it in `Authorization`.

### Current User

```http
GET /auth/me
```

Requires auth.

### Forgot Password

```http
POST /auth/forgot-password
```

Body:

```json
{
  "email": "john@example.com"
}
```

### Change Password

```http
POST /auth/change-password
```

Body:

```json
{
  "reset_token": "reset-token",
  "new_password": "newSecret456"
}
```

## Movies

Base path:

```txt
/movies
```

Movie records are stored in `content` with `type = "movie"`.

### List Movies

```http
GET /movies
```

Public. If an admin token is present, backend can use the requested `status`; otherwise it returns published movies only.

Query params:

| Param | Type | Notes |
|---|---:|---|
| `page` | number | Default `1` |
| `limit` | number | Default `10` |
| `language` | string | Case-insensitive |
| `region` | string | Case-insensitive |
| `country` | string | Case-insensitive |
| `genre` | string | Matches one genre |
| `is_free` | boolean | `true` / `false` |
| `search` | string | Title or description |
| `year` | number | Release year |
| `rating` | string | `U`, `UA`, `A`, `S` |
| `status` | string | Admin only: `draft`, `processing`, `published`, `archived` |
| `sort` | string | `newest`, `oldest`, `title`, `price_low`, `price_high` |

Response data:

```json
{
  "movies": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

### Get Movie

```http
GET /movies/{id}
```

Public.

Response data:

```json
{
  "movie": {
    "id": "uuid",
    "title": "Dangal",
    "type": "movie",
    "poster_url": "https://...",
    "thumbnail_url": "https://...",
    "trailer_url": "https://...",
    "video_url": "https://...",
    "stream_url_hls": "https://...",
    "stream_url_dash": "https://...",
    "cast": []
  }
}
```

### Create Movie

```http
POST /movies
```

Requires admin.

Body:

```json
{
  "title": "Dangal",
  "description": "A story of a wrestler and his daughters.",
  "language": "Hindi",
  "region": "India",
  "country": "India",
  "genre": ["Drama", "Sports"],
  "director": "Nitesh Tiwari",
  "release_year": 2016,
  "rating": "U",
  "poster_url": "https://...",
  "thumbnail_url": "https://...",
  "trailer_url": "https://...",
  "video_url": "https://...",
  "stream_url_hls": "https://...",
  "stream_url_dash": "https://...",
  "duration_seconds": 9420,
  "is_free": false,
  "price_tvod": 49,
  "imdb_id": "tt5074352",
  "tags": ["blockbuster"],
  "cast": [
    {
      "actor_name": "Aamir Khan",
      "character_name": "Mahavir",
      "role_type": "lead_actor",
      "billing_order": 1,
      "headshot_url": "https://..."
    }
  ]
}
```

Required: `title`.

Backend creates movie as `draft`.

Recommended frontend upload flow for new movies:

1. Request direct upload URLs with `POST /movies/upload/direct-url`.
2. Upload selected files directly to the returned `upload_url`.
3. `POST /movies` with metadata plus `poster_url`, `thumbnail_url`, `trailer_url`, and/or `video_url`.
4. Optionally `PATCH /movies/{id}/status` to publish.

The older flow still works for smaller files: create the movie first, upload media with `/movies/upload/*` plus `content_id`, then publish.

### Update Movie

```http
PUT /movies/{id}
```

Requires admin.

Allowed fields: `title`, `description`, `language`, `region`, `country`, `genre`, `director`, `release_year`, `rating`, `status`, `poster_url`, `thumbnail_url`, `trailer_url`, `video_url`, `stream_url_hls`, `stream_url_dash`, `duration_seconds`, `is_free`, `price_tvod`, `imdb_id`, `tags`.

### Update Movie Status

```http
PATCH /movies/{id}/status
```

Requires admin.

Body:

```json
{
  "status": "published"
}
```

Statuses: `draft`, `processing`, `published`, `archived`.

### Archive Movie

```http
DELETE /movies/{id}
```

Requires admin. This is a soft delete: status becomes `archived`.

### Movie Uploads

All movie uploads require admin and `multipart/form-data`.

Do not manually set `Content-Type`; let the browser set the boundary.

#### Create Direct Movie Upload URL

```http
POST /movies/upload/direct-url
```

Requires admin and JSON.

Body:

```json
{
  "file_name": "trailer.mov",
  "mime_type": "video/quicktime",
  "upload_type": "trailer"
}
```

Allowed `upload_type` values: `thumbnail`, `trailer`, `video`.

Response data:

```json
{
  "upload_url": "https://storage.googleapis.com/...",
  "public_url": "https://storage.googleapis.com/<bucket>/videos/trailer/file.mov",
  "file_name": "uuid.mov",
  "gcs_path": "videos/trailer/uuid.mov",
  "mime_type": "video/quicktime",
  "method": "PUT",
  "headers": {
    "Content-Type": "video/quicktime"
  },
  "upload_mode": "gcs_resumable"
}
```

Upload the file to `upload_url` with `PUT` and the returned `Content-Type`. Track browser upload progress using `XMLHttpRequest.upload.onprogress`.

After upload completes, save `public_url` on the movie create/update payload:

| Upload type | Movie field |
|---|---|
| `thumbnail` | `poster_url` and/or `thumbnail_url` |
| `trailer` | `trailer_url` |
| `video` | `video_url` |

#### Upload Movie Thumbnail

```http
POST /movies/upload/thumbnail
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | JPG, PNG, WEBP |
| `content_id` | uuid | recommended | Movie ID; auto-updates movie URL |

Response data includes `public_url`.

Backend currently maps thumbnail upload to `poster_url` in `uploadController`. Frontend can use returned `public_url` as both `poster_url` and `thumbnail_url` if needed.

#### Upload Movie Trailer

```http
POST /movies/upload/trailer
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | MP4, MOV, WEBM |
| `content_id` | uuid | recommended | Movie ID; auto-updates `trailer_url` |

#### Upload Movie Video

```http
POST /movies/upload/video
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | MP4, AVI, MOV, MKV, WEBM |
| `content_id` | uuid | recommended | Movie ID; auto-updates `video_url` |

## Series And Episodes

Base path:

```txt
/episodes
```

Series parent records are stored in `content` with `type = "show"` or `type = "short_film"`. Episodes are stored in the `episodes` table.

### List Series

```http
GET /episodes
```

Public. Admin token can request draft/archived statuses.

Query params are similar to movies: `page`, `limit`, `language`, `region`, `genre`, `is_free`, `search`, `year`, `rating`, `status`, `sort`.

Response data includes:

```json
{
  "series": [],
  "pagination": {}
}
```

### Get Series Details

```http
GET /episodes/{seriesId}
```

Public.

Response data:

```json
{
  "series": {
    "id": "uuid",
    "series_name": "Series title",
    "type": "show",
    "poster_url": "https://...",
    "thumbnail_url": "https://...",
    "trailer_url": "https://...",
    "cast": [],
    "episodes": []
  }
}
```

### Create Series

```http
POST /episodes
```

Requires admin.

Important frontend mapping: send `series_name`, not `title`.

Body:

```json
{
  "series_name": "Sacred Games",
  "type": "show",
  "description": "Crime series.",
  "language": "Hindi",
  "region": "India",
  "genre": ["Crime", "Drama"],
  "director": "Director Name",
  "release_year": 2018,
  "rating": "A",
  "poster_url": "https://...",
  "thumbnail_url": "https://...",
  "trailer_url": "https://...",
  "is_free": true,
  "price_tvod": 0,
  "imdb_id": "tt123",
  "tags": ["thriller"],
  "cast": [],
  "episodes": [
    {
      "season": 1,
      "episode_number": 1,
      "title": "Episode 1",
      "description": "Intro episode",
      "duration_seconds": 3600,
      "thumbnail_url": "https://...",
      "video_url": "https://...",
      "is_free": true,
      "price_tvod": 0,
      "aired_date": "2026-05-18"
    }
  ]
}
```

Valid `type`: `show`, `short_film`.

### Update Series

```http
PUT /episodes/{seriesId}
```

Requires admin.

Allowed fields: `series_name` or `title`, `description`, `language`, `region`, `genre`, `director`, `release_year`, `rating`, `status`, `poster_url`, `thumbnail_url`, `trailer_url`, `is_free`, `price_tvod`, `imdb_id`, `tags`.

### Archive Series

```http
DELETE /episodes/{seriesId}
```

Requires admin. Soft archive.

### Add Episode

```http
POST /episodes/{seriesId}/episode
```

Requires admin.

Body:

```json
{
  "season": 1,
  "episode_number": 1,
  "title": "Episode 1",
  "description": "First episode",
  "duration_seconds": 3600,
  "stream_url_hls": "https://...",
  "stream_url_dash": "https://...",
  "thumbnail_url": "https://...",
  "video_url": "https://...",
  "price_tvod": 0,
  "is_free": true,
  "aired_date": "2026-05-18"
}
```

### Update Episode

```http
PUT /episodes/{seriesId}/episode/{episodeId}
```

Requires admin.

Allowed fields: `season`, `episode_number`, `title`, `description`, `duration_seconds`, `stream_url_hls`, `stream_url_dash`, `thumbnail_url`, `video_url`, `price_tvod`, `is_free`, `status`, `aired_date`.

### Archive Episode

```http
DELETE /episodes/{seriesId}/episode/{episodeId}
```

Requires admin. Soft archive.

### Series And Episode Uploads

All require admin and `multipart/form-data`.

#### Create Direct Series Upload URL

```http
POST /episodes/upload/direct-url
```

Requires admin and JSON.

Body:

```json
{
  "file_name": "series-trailer.mp4",
  "mime_type": "video/mp4",
  "upload_type": "trailer"
}
```

Allowed `upload_type` values: `thumbnail`, `trailer`, `video`.

Use the returned `upload_url` the same way as the movie direct upload flow. For series parent records, save `thumbnail` as `poster_url` / `thumbnail_url` and `trailer` as `trailer_url`. For episode video files, save the returned URL as the episode `video_url`.

#### Upload Series Trailer

```http
POST /episodes/upload/trailer
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | MP4, MOV, WEBM |
| `series_id` | uuid | recommended | Auto-updates `trailer_url` |

#### Upload Series Thumbnail

```http
POST /episodes/upload/thumbnail
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | JPG, PNG, WEBP |
| `series_id` | uuid | recommended | Auto-updates series image field |

#### Upload Episode Video

```http
POST /episodes/upload/episode-video
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | MP4, AVI, MOV, MKV, WEBM |
| `episode_id` | uuid | recommended | Auto-updates episode `video_url` |

#### Upload Episode Thumbnail

```http
POST /episodes/upload/episode-thumbnail
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | JPG, PNG, WEBP |
| `episode_id` | uuid | recommended | Auto-updates episode `thumbnail_url` |

## Songs

Base path:

```txt
/songs
```

Songs use `content.type = "song"` plus extra metadata.

### List Songs

```http
GET /songs
```

Public.

Query params:

| Param | Type | Notes |
|---|---:|---|
| `page` | number | Default `1` |
| `limit` | number | Default `10` |
| `language` | string | Filter |
| `genre` | string | Filter |
| `is_free` | boolean | Filter |
| `search` | string | Search |
| `mood` | string | Mood tag |
| `album` | string | Album |
| `festival` | string | Festival |
| `status` | string | Admin only |
| `sort` | string | `newest`, `oldest`, `title` |

Response data:

```json
{
  "songs": [],
  "pagination": {}
}
```

### Get Song

```http
GET /songs/{id}
```

Public.

Response data:

```json
{
  "song": {
    "id": "uuid",
    "song_name": "Kesariya",
    "description": "Song description",
    "poster_url": "https://...",
    "thumbnail_url": "https://...",
    "audio_url_hq": "https://...",
    "audio_url_lq": "https://...",
    "lyrics_url": "https://...",
    "video_url": "https://...",
    "mood_tags": [],
    "instruments": [],
    "album": "Album",
    "festival": null,
    "cast": []
  }
}
```

### Create Song

```http
POST /songs
```

Requires admin.

Important frontend mapping: send `song_name`, not `title`.

Body:

```json
{
  "song_name": "Kesariya",
  "description": "Romantic Sufi song",
  "language": "Hindi",
  "region": "India",
  "genre": ["Romantic"],
  "director": "Pritam",
  "release_year": 2022,
  "rating": "U",
  "duration_seconds": 270,
  "is_free": true,
  "price_tvod": 0,
  "poster_url": "https://...",
  "thumbnail_url": "https://...",
  "stream_url_hls": "https://...",
  "stream_url_dash": "https://...",
  "audio_url_hq": "https://...",
  "audio_url_lq": "https://...",
  "lyrics_url": "https://...",
  "video_url": "https://...",
  "mood_tags": ["romantic"],
  "instruments": ["guitar"],
  "festival": "Diwali",
  "album": "Brahmastra",
  "artist_ids": [],
  "cast": []
}
```

Required: `song_name`.

### Update Song

```http
PUT /songs/{id}
```

Requires admin.

Allowed fields include `song_name`, `description`, `language`, `genre`, `director`, `release_year`, `rating`, `status`, `poster_url`, `thumbnail_url`, `stream_url_hls`, `stream_url_dash`, `duration_seconds`, `is_free`, `price_tvod`, `mood_tags`, `instruments`, `festival`, `album`, `lyrics_url`, `audio_url_hq`, `audio_url_lq`, `video_url`, `artist_ids`.

### Archive Song

```http
DELETE /songs/{id}
```

Requires admin.

### Song Uploads

All require admin and `multipart/form-data`.

#### Create Direct Song Upload URL

```http
POST /songs/upload/direct-url
```

Requires admin and JSON.

Body:

```json
{
  "file_name": "song.mp3",
  "mime_type": "audio/mpeg",
  "upload_type": "audio"
}
```

Allowed `upload_type` values: `thumbnail`, `audio`, `audio_lq`, `lyrics`.

Use the returned `upload_url` the same way as the movie direct upload flow. Save returned `public_url` into `poster_url` / `thumbnail_url`, `audio_url_hq`, `audio_url_lq`, or `lyrics_url` depending on the upload purpose. Use `audio` for HQ audio and `audio_lq` for LQ audio.

#### Upload Song Audio

```http
POST /songs/upload/audio
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `audio_hq` | file | yes | HQ audio |
| `audio_lq` | file | no | Optional LQ audio |
| `song_id` | uuid | yes | Auto-updates `audio_url_hq` / `audio_url_lq` |

#### Upload Song Lyrics

```http
POST /songs/upload/lyrics
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | `.lrc`, `.vtt`, `.txt`, `.srt` |
| `song_id` | uuid | yes | Auto-updates `lyrics_url` |

#### Upload Song Thumbnail

```http
POST /songs/upload/thumbnail
```

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | JPG, PNG, WEBP |
| `song_id` | uuid | yes | Auto-updates image URL |

## Cast

Movie cast:

```http
POST /movies/{id}/cast
POST /movies/{id}/cast/bulk
PUT /movies/{id}/cast/{castId}
DELETE /movies/{id}/cast/{castId}
```

Series cast:

```http
POST /episodes/{seriesId}/cast
DELETE /episodes/{seriesId}/cast/{castId}
```

Song cast / artists:

```http
POST /songs/{id}/cast
DELETE /songs/{id}/cast/{castId}
```

Common cast body:

```json
{
  "actor_id": "optional-existing-actor-uuid",
  "actor_name": "Actor Name",
  "character_name": "Character",
  "role_type": "supporting_actor",
  "billing_order": 1,
  "headshot_url": "https://...",
  "cast_image": "https://..."
}
```

Movie/series role examples: `lead_actor`, `lead_actress`, `supporting_actor`, `supporting_actress`, `director`, `producer`, `music_director`, `lyricist`, `cinematographer`, `editor`, `cameo`.

Song role examples: `singer`, `music_director`, `lyricist`, `narrator`, `cameo`.

## Users

### List Users

```http
GET /users
```

Requires admin or manager.

Query params: `page`, `limit`, `role`, `search`.

### Get User

```http
GET /users/{id}
```

Requires auth.

### Update User

```http
PUT /users/{id}
```

Requires auth. User can update own profile; admin can update role.

Body:

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+919876543210",
  "age": 25,
  "language_preferences": ["Hindi", "English"],
  "regions": ["India"],
  "role": "viewer"
}
```

### Deactivate User

```http
DELETE /users/{id}
```

Requires admin.

## Views And Points

Base path:

```txt
/views
```

### Record View

```http
POST /views/record
```

Requires auth.

Body:

```json
{
  "user_id": "uuid",
  "content_id": "uuid",
  "episode_id": "uuid-or-null",
  "idempotency_key": "session-123-2026-05-18T10:30:00Z"
}
```

Notes:

- `content_id` must refer to movie/show content.
- `episode_id` is optional for movies, required by frontend logic when recording a show episode view.
- `idempotency_key` prevents duplicate point awards.

### User Points

```http
GET /views/user/{user_id}/points
```

Requires auth.

### User View History

```http
GET /views/user/{user_id}/history
```

Requires auth.

Query params: `page`, `limit`, `start_date`, `end_date`.

### Content View Stats

```http
GET /views/content/{content_id}/stats
```

Requires auth.

## Frontend Integration Notes

### Normalize Names

The frontend can normalize all display cards to `title`, but requests must use backend-specific field names:

| UI Type | Backend Endpoint | Send Name Field | Response Name Field |
|---|---|---|---|
| Movie | `/movies` | `title` | `title` |
| Series | `/episodes` | `series_name` | `series_name` |
| Song | `/songs` | `song_name` | `song_name` |

### Recommended Create Movie With Direct Uploads

```js
const direct = await api.post('/movies/upload/direct-url', {
  file_name: trailerFile.name,
  mime_type: trailerFile.type || 'video/mp4',
  upload_type: 'trailer',
});

await new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('PUT', direct.data.upload_url);
  xhr.setRequestHeader('Content-Type', direct.data.mime_type);
  xhr.upload.onprogress = event => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      console.log(percent);
    }
  };
  xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject();
  xhr.onerror = reject;
  xhr.send(trailerFile);
});

const created = await api.post('/movies', {
  ...moviePayload,
  trailer_url: direct.data.public_url,
});
const movieId = created.data.movie.id;
await api.patch(`/movies/${movieId}/status`, { status: 'published' });
```

### Recommended Create Series With Uploads

```js
const created = await api.post('/episodes', { series_name: title, type: 'show' });
const seriesId = created.data.series.id;

const trailer = new FormData();
trailer.append('file', trailerFile);
trailer.append('series_id', seriesId);
await fetch(`${BASE_URL}/episodes/upload/trailer`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: trailer,
});
```

### Recommended Create Song With Uploads

```js
const created = await api.post('/songs', { song_name: title });
const songId = created.data.song.id;

const audio = new FormData();
audio.append('audio_hq', audioFile);
audio.append('song_id', songId);
await fetch(`${BASE_URL}/songs/upload/audio`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: audio,
});
```

### Upload Limits

The backend upload middleware currently uses `Infinity` for image, video, trailer, and audio multer limits. Real limits may still exist at infrastructure/proxy/cloud storage layers.

For large files, use direct upload URLs. This avoids the Cloud Run / Google Frontend request body limit that can return `413 Content Too Large` before the Express route executes.

### Google Cloud Storage CORS For Direct Uploads

Browser direct uploads to `storage.googleapis.com` require the bucket CORS policy to allow the dashboard origin. Example policy:

```json
[
  {
    "origin": ["http://localhost:5173", "https://your-dashboard-domain.com"],
    "method": ["PUT", "OPTIONS"],
    "responseHeader": ["Content-Type", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
```

Apply it to the media bucket with `gcloud storage buckets update gs://<bucket> --cors-file=<cors-json-file>`.

### 404 Upload Mistake To Avoid

These are not valid mounted routes in the current backend:

```http
POST /upload/image
POST /upload/video
POST /upload/trailer
```

Use the resource-specific upload routes documented above.
