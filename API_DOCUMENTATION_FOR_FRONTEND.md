# Camcine API Documentation For Frontend

This document is a frontend integration handoff for the API in `backend/camcineapi`.
It was prepared from the current Express routes and controllers under `src/`.

## Quick Facts

Base API path:

```txt
/api/v1
```

Local base URL:

```txt
http://localhost:8080/api/v1
```

Deployed base URL currently documented in the backend:

```txt
https://camcine-api-604298774917.asia-south1.run.app/api/v1
```

Swagger UI when the server is running:

```txt
http://localhost:8080/api-docs
```

Health endpoints:

```http
GET /
GET /health
```

## Response Format

Most successful responses use this envelope:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Most error responses use this envelope:

```json
{
  "success": false,
  "message": "Error message",
  "errors": []
}
```

Important for frontend code: when using Axios without a response interceptor, useful values are under `response.data.data`.

Example:

```js
const res = await axios.post(`${BASE_URL}/auth/login`, payload);
const token = res.data.data.token;
const user = res.data.data.user;
```

## Authentication

Protected endpoints require:

```http
Authorization: Bearer <jwt-token>
```

JSON requests should use:

```http
Content-Type: application/json
```

For `multipart/form-data`, do not set `Content-Type` manually in the browser. Let `fetch` or Axios set the boundary.

Roles:

| Role | Typical permissions |
|---|---|
| `viewer` | Basic authenticated user |
| `actor` | Basic authenticated user |
| `manager` | Can list users |
| `admin` | Can create, update, archive content and upload media |

Public catalog list endpoints allow an optional admin token. If no valid admin token is sent, public list endpoints return only `published` content. Admin requests may include `status`.

## Common Data Models

### User

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+919876543210",
  "role": "viewer",
  "age": 25,
  "language_preferences": ["Hindi", "English"],
  "regions": ["India"],
  "is_active": true,
  "created_at": "2026-05-19T08:00:00.000Z",
  "last_login": "2026-05-19T08:10:00.000Z"
}
```

### Content Status

Valid content statuses:

```txt
draft, processing, published, archived
```

Archive/delete endpoints are soft deletes. They generally set `status = archived` or `is_active = false`; they do not physically remove records.

### Cast Member

Used by movies, series, episodes, and songs.

```json
{
  "actor_id": "optional-existing-actor-uuid",
  "actor_name": "Actor or artist name",
  "character_name": "Character or role label",
  "role_type": "supporting_actor",
  "billing_order": 1,
  "headshot_url": "https://...",
  "cast_image": "https://..."
}
```

At least one of `actor_id` or `actor_name` is required for cast create endpoints.

Movie/series role examples:

```txt
lead_actor, lead_actress, supporting_actor, supporting_actress, director,
producer, music_director, lyricist, cinematographer, editor, cameo
```

Song role examples:

```txt
singer, music_director, lyricist, narrator, cameo
```

Episode guest role examples:

```txt
lead_actor, lead_actress, supporting_actor, supporting_actress, guest, cameo, narrator
```

## Frontend Naming Rules

The API uses different title fields by content type.

| UI content type | Endpoint | Send field | Response field |
|---|---|---|---|
| Movie | `/movies` | `title` | `title` |
| Series/show | `/episodes` | `series_name` | `series_name` |
| Short film | `/episodes` | `series_name`, `type: "short_film"` | `series_name` |
| Song | `/songs` | `song_name` | `song_name` |

For UI cards, normalize to a local `displayTitle`:

```js
const displayTitle = item.title || item.series_name || item.song_name;
```

## Endpoint Summary

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register user and return token |
| `POST` | `/auth/login` | Public | Login with email, phone, or user id |
| `GET` | `/auth/me` | Any token | Get current authenticated user |
| `POST` | `/auth/forgot-password` | Public | Generate reset token |
| `POST` | `/auth/change-password` | Public | Reset password with token |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users` | Admin, manager | List users |
| `GET` | `/users/{id}` | Any token | Get user by id |
| `PUT` | `/users/{id}` | Own profile or admin | Update user profile |
| `DELETE` | `/users/{id}` | Admin | Deactivate user |

### Movies

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/movies` | Public, optional admin | List movies |
| `GET` | `/movies/{id}` | Public | Get movie detail |
| `POST` | `/movies` | Admin | Create movie |
| `PUT` | `/movies/{id}` | Admin | Update movie |
| `PATCH` | `/movies/{id}/status` | Admin | Update movie status |
| `DELETE` | `/movies/{id}` | Admin | Archive movie |
| `POST` | `/movies/{id}/cast` | Admin | Add or update one cast member |
| `POST` | `/movies/{id}/cast/bulk` | Admin | Add cast members in bulk |
| `PUT` | `/movies/{id}/cast/{castId}` | Admin | Update cast member |
| `DELETE` | `/movies/{id}/cast/{castId}` | Admin | Remove cast member |

### Series And Episodes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/episodes` | Public, optional admin | List series/shows/short films |
| `GET` | `/episodes/{seriesId}` | Public | Get series detail with episodes |
| `POST` | `/episodes` | Admin | Create series/show/short film |
| `PUT` | `/episodes/{seriesId}` | Admin | Update series metadata |
| `DELETE` | `/episodes/{seriesId}` | Admin | Archive series |
| `POST` | `/episodes/{seriesId}/episode` | Admin | Add episode |
| `PUT` | `/episodes/{seriesId}/episode/{episodeId}` | Admin | Update episode |
| `DELETE` | `/episodes/{seriesId}/episode/{episodeId}` | Admin | Archive episode |
| `POST` | `/episodes/{seriesId}/cast` | Admin | Add series cast |
| `DELETE` | `/episodes/{seriesId}/cast/{castId}` | Admin | Remove series cast |
| `POST` | `/episodes/{seriesId}/episode/{episodeId}/cast` | Admin | Add guest episode cast |
| `DELETE` | `/episodes/{seriesId}/episode/{episodeId}/cast/{castId}` | Admin | Remove guest episode cast |

### Songs

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/songs` | Public, optional admin | List songs |
| `GET` | `/songs/{id}` | Public | Get song detail |
| `POST` | `/songs` | Admin | Create song |
| `PUT` | `/songs/{id}` | Admin | Update song |
| `DELETE` | `/songs/{id}` | Admin | Archive song |
| `POST` | `/songs/{id}/cast` | Admin | Add artist/cast |
| `DELETE` | `/songs/{id}/cast/{castId}` | Admin | Remove artist/cast |

### Uploads

There is no general `/api/v1/upload/*` route mounted. Use resource-specific upload routes.

| Method | Path | Auth | Type |
|---|---|---|---|
| `POST` | `/movies/upload/direct-url` | Admin | JSON direct GCS upload URL |
| `POST` | `/movies/upload/video` | Admin | Multipart movie video |
| `POST` | `/movies/upload/trailer` | Admin | Multipart movie trailer |
| `POST` | `/movies/upload/thumbnail` | Admin | Multipart movie thumbnail |
| `POST` | `/episodes/upload/direct-url` | Admin | JSON direct GCS upload URL |
| `POST` | `/episodes/upload/trailer` | Admin | Multipart series trailer |
| `POST` | `/episodes/upload/thumbnail` | Admin | Multipart series thumbnail |
| `POST` | `/episodes/upload/episode-video` | Admin | Multipart episode video |
| `POST` | `/episodes/upload/episode-thumbnail` | Admin | Multipart episode thumbnail |
| `POST` | `/songs/upload/direct-url` | Admin | JSON direct GCS upload URL |
| `POST` | `/songs/upload/audio` | Admin | Multipart song audio |
| `POST` | `/songs/upload/lyrics` | Admin | Multipart song lyrics |
| `POST` | `/songs/upload/thumbnail` | Admin | Multipart song thumbnail |

### Views And Points

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/views/record` | Any token | Record video view and award points |
| `GET` | `/views/user/{user_id}/points` | Any token | Get user point balance |
| `GET` | `/views/user/{user_id}/history` | Any token | Get user view history |
| `GET` | `/views/content/{content_id}/stats` | Any token | Get content view statistics |

## Auth API Details

### Register

```http
POST /auth/register
```

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

Required fields: `email`, `first_name`, `last_name`, `password`.

Validation:

| Field | Rule |
|---|---|
| `email` | Valid email |
| `password` | Minimum 6 characters |
| `phone_number` | Optional, 10 to 15 digits, may start with `+` |
| `role` | Optional: `viewer`, `actor`, `manager`, `admin` |
| `age` | Optional positive integer |

Response data:

```json
{
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+919876543210",
    "role": "viewer",
    "age": 25,
    "created_at": "2026-05-19T08:00:00.000Z"
  },
  "token": "jwt-token"
}
```

### Login

```http
POST /auth/login
```

Send exactly one identifier: `email`, `phone_number`, or `id`, plus `password`.

Body:

```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

Response data:

```json
{
  "user": {},
  "token": "jwt-token"
}
```

Common errors:

| Status | Reason |
|---:|---|
| `400` | No identifier sent |
| `401` | Invalid credentials |
| `403` | Account deactivated |

### Current User

```http
GET /auth/me
```

Requires token.

Response data:

```json
{
  "user": {}
}
```

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

The current backend returns `reset_token` in the response for development. Production should send it by email instead.

### Change Password

```http
POST /auth/change-password
```

Body:

```json
{
  "reset_token": "token-from-forgot-password",
  "new_password": "newSecret456"
}
```

## Movies API Details

### List Movies

```http
GET /movies
```

Query params:

| Param | Type | Notes |
|---|---|---|
| `page` | number | Default `1` |
| `limit` | number | Default `10` |
| `language` | string | Case-insensitive exact-ish match |
| `region` | string | Case-insensitive exact-ish match |
| `country` | string | Case-insensitive exact-ish match |
| `genre` | string | Matches one value inside `genre` array |
| `is_free` | boolean string | `true` or `false` |
| `search` | string | Searches title and description |
| `year` | number | Release year |
| `rating` | string | `U`, `UA`, `A`, `S` |
| `status` | string | Admin only |
| `sort` | string | `newest`, `oldest`, `title`, `price_low`, `price_high` |

Response data:

```json
{
  "movies": [
    {
      "id": "uuid",
      "title": "Dangal",
      "description": "A story...",
      "language": "Hindi",
      "region": "India",
      "country": "India",
      "genre": ["Drama", "Sports"],
      "director": "Nitesh Tiwari",
      "release_year": 2016,
      "rating": "U",
      "status": "published",
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
      "cast": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

### Get Movie

```http
GET /movies/{id}
```

Response data:

```json
{
  "movie": {
    "id": "uuid",
    "title": "Dangal",
    "cast": [
      {
        "id": "cast-id",
        "actor_id": "actor-id-or-null",
        "actor_name": "Aamir Khan",
        "character_name": "Mahavir Singh Phogat",
        "role_type": "lead_actor",
        "billing_order": 1,
        "headshot_url": "https://...",
        "is_verified": true
      }
    ]
  }
}
```

Note: the current detail route does not require auth and does not filter by `published`.

### Create Movie

```http
POST /movies
```

Requires admin.

Required field: `title`.

Body:

```json
{
  "title": "Dangal",
  "description": "A story of a wrestler and his daughters",
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
      "character_name": "Mahavir Singh Phogat",
      "role_type": "lead_actor",
      "billing_order": 1,
      "headshot_url": "https://..."
    }
  ]
}
```

Created movie status is `draft`.

### Update Movie

```http
PUT /movies/{id}
```

Requires admin.

Allowed fields:

```txt
title, description, language, region, country, genre, director, release_year, rating,
status, poster_url, thumbnail_url, trailer_url, video_url, stream_url_hls,
stream_url_dash, duration_seconds, is_free, price_tvod, imdb_id, tags
```

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

### Archive Movie

```http
DELETE /movies/{id}
```

Requires admin. Sets status to `archived`.

## Series And Episodes API Details

### List Series

```http
GET /episodes
```

This returns parent content where type is `show` or `short_film`.

Query params:

| Param | Type | Notes |
|---|---|---|
| `page` | number | Default `1` |
| `limit` | number | Default `10` |
| `language` | string | Filter |
| `region` | string | Filter |
| `genre` | string | Matches one genre |
| `is_free` | boolean string | `true` or `false` |
| `search` | string | Searches title and description |
| `year` | number | Release year |
| `rating` | string | `U`, `UA`, `A`, `S` |
| `status` | string | Admin only |
| `sort` | string | `newest`, `oldest`, `title`, `price_low`, `price_high` |

Response data:

```json
{
  "series": [
    {
      "id": "uuid",
      "series_name": "Mirzapur",
      "type": "show",
      "description": "Crime thriller",
      "language": "Hindi",
      "genre": ["Crime", "Thriller"],
      "total_episodes": "18",
      "cast": []
    }
  ],
  "pagination": {}
}
```

### Get Series Details

```http
GET /episodes/{seriesId}
```

Response data:

```json
{
  "series": {
    "id": "uuid",
    "series_name": "Mirzapur",
    "type": "show",
    "poster_url": "https://...",
    "thumbnail_url": "https://...",
    "trailer_url": "https://...",
    "cast": [],
    "episodes": [
      {
        "id": "episode-uuid",
        "season": 1,
        "episode_number": 1,
        "episode_title": "Episode 1",
        "description": "Intro",
        "duration_seconds": 3600,
        "stream_url_hls": "https://...",
        "stream_url_dash": "https://...",
        "thumbnail_url": "https://...",
        "video_url": "https://...",
        "price_tvod": 0,
        "is_free": true,
        "status": "published",
        "aired_date": "2018-11-16",
        "episode_cast": []
      }
    ]
  }
}
```

### Create Series Or Short Film

```http
POST /episodes
```

Requires admin.

Required field: `series_name`.

Valid `type`: `show`, `short_film`. Default is `show`.

Body:

```json
{
  "series_name": "Mirzapur",
  "type": "show",
  "description": "Crime thriller",
  "language": "Hindi",
  "region": "India",
  "genre": ["Crime", "Thriller"],
  "director": "Director Name",
  "release_year": 2018,
  "rating": "A",
  "poster_url": "https://...",
  "thumbnail_url": "https://...",
  "trailer_url": "https://...",
  "is_free": false,
  "price_tvod": 0,
  "imdb_id": "tt123456",
  "tags": ["popular"],
  "cast": [],
  "episodes": [
    {
      "season": 1,
      "episode_number": 1,
      "title": "Episode 1",
      "description": "Intro episode",
      "duration_seconds": 3600,
      "stream_url_hls": "https://...",
      "stream_url_dash": "https://...",
      "thumbnail_url": "https://...",
      "video_url": "https://...",
      "price_tvod": 0,
      "is_free": true,
      "aired_date": "2018-11-16"
    }
  ]
}
```

Created parent series status is `draft`. Seeded episodes are inserted with status `published`.

### Update Series

```http
PUT /episodes/{seriesId}
```

Requires admin.

Allowed fields:

```txt
series_name, title, description, language, region, genre, director,
release_year, rating, status, poster_url, thumbnail_url, trailer_url,
is_free, price_tvod, imdb_id, tags
```

### Archive Series

```http
DELETE /episodes/{seriesId}
```

Requires admin. Sets parent content status to `archived`.

### Add Episode

```http
POST /episodes/{seriesId}/episode
```

Requires admin.

Required field: `episode_number`.

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
  "aired_date": "2018-11-16"
}
```

### Update Episode

```http
PUT /episodes/{seriesId}/episode/{episodeId}
```

Requires admin.

Allowed fields:

```txt
season, episode_number, title, description, duration_seconds,
stream_url_hls, stream_url_dash, thumbnail_url, video_url,
price_tvod, is_free, status, aired_date
```

### Archive Episode

```http
DELETE /episodes/{seriesId}/episode/{episodeId}
```

Requires admin. Sets episode status to `archived`.

## Songs API Details

### List Songs

```http
GET /songs
```

Query params:

| Param | Type | Notes |
|---|---|---|
| `page` | number | Default `1` |
| `limit` | number | Default `10` |
| `language` | string | Filter |
| `region` | string | Filter supported by controller |
| `genre` | string | Matches one genre |
| `is_free` | boolean string | `true` or `false` |
| `search` | string | Searches title and description |
| `mood` | string | Matches one mood tag |
| `album` | string | Case-insensitive contains |
| `festival` | string | Case-insensitive contains |
| `status` | string | Admin only |
| `sort` | string | `newest`, `oldest`, `title` |

Response data:

```json
{
  "songs": [
    {
      "id": "uuid",
      "song_name": "Kesariya",
      "description": "Romantic song",
      "language": "Hindi",
      "genre": ["Romantic"],
      "poster_url": "https://...",
      "thumbnail_url": "https://...",
      "stream_url_hls": "https://...",
      "stream_url_dash": "https://...",
      "audio_url_hq": "https://...",
      "audio_url_lq": "https://...",
      "lyrics_url": "https://...",
      "song_video_url": "https://...",
      "mood_tags": ["romantic"],
      "instruments": ["guitar"],
      "festival": null,
      "album": "Brahmastra",
      "artist_ids": [],
      "cast": []
    }
  ],
  "pagination": {}
}
```

### Get Song

```http
GET /songs/{id}
```

Response data:

```json
{
  "song": {
    "id": "uuid",
    "song_name": "Kesariya",
    "audio_url_hq": "https://...",
    "audio_url_lq": "https://...",
    "lyrics_url": "https://...",
    "song_video_url": "https://...",
    "cast": []
  }
}
```

### Create Song

```http
POST /songs
```

Requires admin.

Required field: `song_name`.

Body:

```json
{
  "song_name": "Kesariya",
  "description": "Romantic Sufi song",
  "language": "Hindi",
  "region": "India",
  "genre": ["Romantic", "Sufi"],
  "director": "Pritam",
  "release_year": 2022,
  "rating": "U",
  "duration_seconds": 270,
  "is_free": true,
  "price_tvod": 0,
  "imdb_id": "tt123456",
  "tags": ["hit"],
  "poster_url": "https://...",
  "thumbnail_url": "https://...",
  "stream_url_hls": "https://...",
  "stream_url_dash": "https://...",
  "audio_url_hq": "https://...",
  "audio_url_lq": "https://...",
  "lyrics_url": "https://...",
  "video_url": "https://...",
  "mood_tags": ["romantic"],
  "instruments": ["guitar", "tabla"],
  "festival": "Diwali",
  "album": "Brahmastra",
  "artist_ids": [],
  "cast": [
    {
      "actor_name": "Arijit Singh",
      "role_type": "singer",
      "billing_order": 1,
      "headshot_url": "https://..."
    }
  ]
}
```

Created song status is `draft`.

### Update Song

```http
PUT /songs/{id}
```

Requires admin.

Allowed fields:

```txt
song_name, title, description, language, region, genre, director,
release_year, rating, status, poster_url, thumbnail_url,
stream_url_hls, stream_url_dash, duration_seconds, is_free,
price_tvod, imdb_id, tags, mood_tags, instruments, festival,
album, lyrics_url, audio_url_hq, audio_url_lq, video_url, artist_ids
```

### Archive Song

```http
DELETE /songs/{id}
```

Requires admin. Sets status to `archived`.

## Upload API Details

For large browser uploads, use direct Google Cloud Storage upload URLs. This avoids Cloud Run or proxy body-size limits.

### Direct Upload Flow

1. Call the resource direct URL endpoint with file name, MIME type, and upload type.
2. Upload the actual file to the returned `upload_url` using `PUT`.
3. Save the returned `public_url` into the create/update payload.
4. Publish the content if needed.

Direct upload response envelope:

```json
{
  "success": true,
  "message": "Direct upload URL created.",
  "data": {
    "upload_url": "https://storage.googleapis.com/upload/...",
    "public_url": "https://storage.googleapis.com/bucket/path/file.mp4",
    "file_name": "uuid.mp4",
    "gcs_path": "videos/main_video/uuid.mp4",
    "mime_type": "video/mp4",
    "method": "PUT",
    "headers": {
      "Content-Type": "video/mp4"
    },
    "upload_mode": "gcs_resumable"
  }
}
```

Correct Axios example:

```js
const response = await axios.post(`${BASE_URL}/movies/upload/direct-url`, {
  file_name: file.name,
  mime_type: file.type || "video/mp4",
  upload_type: "video"
}, {
  headers: { Authorization: `Bearer ${token}` }
});

const direct = response.data.data;

await fetch(direct.upload_url, {
  method: "PUT",
  headers: direct.headers,
  body: file
});

await axios.put(`${BASE_URL}/movies/${movieId}`, {
  video_url: direct.public_url
}, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Direct Upload Type Mapping

Movies:

| Endpoint | `upload_type` | Allowed extensions | Save URL to |
|---|---|---|---|
| `/movies/upload/direct-url` | `thumbnail` | `.jpg`, `.jpeg`, `.png`, `.webp` | `poster_url` and/or `thumbnail_url` |
| `/movies/upload/direct-url` | `trailer` | `.mp4`, `.mov`, `.webm` | `trailer_url` |
| `/movies/upload/direct-url` | `video` | `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm` | `video_url` |

Series/episodes:

| Endpoint | `upload_type` | Allowed extensions | Save URL to |
|---|---|---|---|
| `/episodes/upload/direct-url` | `thumbnail` | `.jpg`, `.jpeg`, `.png`, `.webp` | series `poster_url`/`thumbnail_url` or episode `thumbnail_url` |
| `/episodes/upload/direct-url` | `trailer` | `.mp4`, `.mov`, `.webm` | series `trailer_url` |
| `/episodes/upload/direct-url` | `video` | `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm` | episode `video_url` |

Songs:

| Endpoint | `upload_type` | Allowed extensions | Save URL to |
|---|---|---|---|
| `/songs/upload/direct-url` | `thumbnail` | `.jpg`, `.jpeg`, `.png`, `.webp` | `poster_url` and/or `thumbnail_url` |
| `/songs/upload/direct-url` | `audio` | `.mp3`, `.m4a`, `.aac`, `.wav`, `.flac`, `.ogg` | `audio_url_hq` |
| `/songs/upload/direct-url` | `audio_lq` | `.mp3`, `.m4a`, `.aac`, `.wav`, `.flac`, `.ogg` | `audio_url_lq` |
| `/songs/upload/direct-url` | `lyrics` | `.lrc`, `.vtt`, `.txt`, `.srt` | `lyrics_url` |

### Multipart Uploads

Multipart upload responses generally include:

```json
{
  "upload_id": "uuid",
  "public_url": "https://storage.googleapis.com/...",
  "file_name": "uuid.mp4",
  "gcs_path": "videos/main_video/uuid.mp4",
  "file_size": 123456,
  "mime_type": "video/mp4"
}
```

Movie multipart fields:

| Endpoint | File field | Other field | DB update |
|---|---|---|---|
| `/movies/upload/video` | `file` | `content_id` | updates `video_url` |
| `/movies/upload/trailer` | `file` | `content_id` | updates `trailer_url` |
| `/movies/upload/thumbnail` | `file` | `content_id` | updates image URL; use returned `public_url` as needed |

Series/episode multipart fields:

| Endpoint | File field | Other field | DB update |
|---|---|---|---|
| `/episodes/upload/trailer` | `file` | `series_id` | updates `trailer_url` |
| `/episodes/upload/thumbnail` | `file` | `series_id` | updates image URL; use returned `public_url` as needed |
| `/episodes/upload/episode-video` | `file` | `episode_id` | updates episode `video_url` |
| `/episodes/upload/episode-thumbnail` | `file` | `episode_id` | updates episode `thumbnail_url` |

Song multipart fields:

| Endpoint | File fields | Other field | DB update |
|---|---|---|---|
| `/songs/upload/audio` | `audio_hq` required, `audio_lq` optional | `song_id` | updates `audio_url_hq`/`audio_url_lq` |
| `/songs/upload/lyrics` | `file` | `song_id` | updates `lyrics_url` |
| `/songs/upload/thumbnail` | `file` | `song_id` | updates `thumbnail_url` |

## Cast API Details

### Movie Cast

Add one:

```http
POST /movies/{id}/cast
```

Bulk add:

```http
POST /movies/{id}/cast/bulk
```

Bulk body:

```json
{
  "cast": [
    {
      "actor_name": "Aamir Khan",
      "character_name": "Mahavir",
      "role_type": "lead_actor",
      "billing_order": 1
    }
  ]
}
```

Update:

```http
PUT /movies/{id}/cast/{castId}
```

Remove:

```http
DELETE /movies/{id}/cast/{castId}
```

### Series Cast

```http
POST /episodes/{seriesId}/cast
DELETE /episodes/{seriesId}/cast/{castId}
```

### Episode Guest Cast

```http
POST /episodes/{seriesId}/episode/{episodeId}/cast
DELETE /episodes/{seriesId}/episode/{episodeId}/cast/{castId}
```

### Song Artists

```http
POST /songs/{id}/cast
DELETE /songs/{id}/cast/{castId}
```

## Users API Details

### List Users

```http
GET /users
```

Requires admin or manager.

Query params:

| Param | Type | Notes |
|---|---|---|
| `page` | number | Default `1` |
| `limit` | number | Default `10` |
| `role` | string | `viewer`, `actor`, `manager`, `admin` |
| `search` | string | Name or email |

Response data:

```json
{
  "users": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "pages": 0
  }
}
```

### Get User

```http
GET /users/{id}
```

Requires token.

### Update User

```http
PUT /users/{id}
```

Users can update their own profile. Admins can update any profile and can change `role`.

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

Requires admin. Admin cannot deactivate their own account.

## Views And Points API Details

The view tracking system awards:

```txt
1 point per view, maximum 3 view points per user per day
```

### Record View

```http
POST /views/record
```

Requires token.

Body:

```json
{
  "user_id": "viewer-user-uuid",
  "content_id": "movie-or-show-content-uuid",
  "episode_id": "episode-uuid-if-show",
  "idempotency_key": "unique-session-view-key"
}
```

Rules:

| Field | Rule |
|---|---|
| `user_id` | Must be an existing active user |
| `content_id` | Must point to content with type `movie` or `show` |
| `episode_id` | Optional; if provided it must belong to the content |
| `idempotency_key` | Required to avoid duplicate points |

Success with points:

```json
{
  "view_id": "uuid",
  "user_id": "uuid",
  "content_id": "uuid",
  "episode_id": "uuid-or-null",
  "points_awarded": 1,
  "current_balance": 10,
  "daily_points_remaining": 2
}
```

Duplicate view response is `200` with `duplicate: true`.

Daily limit response is `200` with `daily_limit_reached: true` and `points_awarded: 0`.

### User Points

```http
GET /views/user/{user_id}/points
```

Response data:

```json
{
  "user_id": "uuid",
  "current_balance": 15,
  "lifetime_earned": 50,
  "lifetime_spent": 35,
  "last_updated": "2026-05-19T08:00:00.000Z",
  "daily_views_last_7_days": [
    {
      "view_date": "2026-05-19",
      "view_count": 3,
      "points_earned": 3
    }
  ],
  "daily_limit": 3,
  "points_per_view": 1
}
```

### User View History

```http
GET /views/user/{user_id}/history
```

Query params:

| Param | Type | Notes |
|---|---|---|
| `page` | number | Default `1` |
| `limit` | number | Default `20`, max `100` |
| `start_date` | date | Optional |
| `end_date` | date | Optional |

### Content View Stats

```http
GET /views/content/{content_id}/stats
```

Response data:

```json
{
  "content_id": "uuid",
  "total_views": 1500,
  "total_points_awarded": 1200,
  "unique_viewers": 980,
  "today_views": 45
}
```

## Recommended Frontend API Client

```js
import axios from "axios";

export const BASE_URL = "http://localhost:8080/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("camcine_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const payload = error.response?.data;
    return Promise.reject({
      status: error.response?.status,
      message: payload?.message || error.message,
      errors: payload?.errors || []
    });
  }
);
```

If using the interceptor above, access data like this:

```js
const res = await api.get("/movies");
const movies = res.data.movies;
```

Without the interceptor, access it like this:

```js
const res = await axios.get(`${BASE_URL}/movies`);
const movies = res.data.data.movies;
```

## Recommended Create Workflows

### Create Movie With Large Files

1. Admin logs in.
2. For each file, call `/movies/upload/direct-url`.
3. Upload each file directly to GCS.
4. Create movie with returned public URLs.
5. Publish movie with `/movies/{id}/status`.

```js
const directRes = await api.post("/movies/upload/direct-url", {
  file_name: trailerFile.name,
  mime_type: trailerFile.type || "video/mp4",
  upload_type: "trailer"
});

const direct = directRes.data;

await fetch(direct.upload_url, {
  method: "PUT",
  headers: direct.headers,
  body: trailerFile
});

const movieRes = await api.post("/movies", {
  title: "Dangal",
  trailer_url: direct.public_url,
  genre: ["Drama"],
  is_free: false,
  price_tvod: 49
});

await api.patch(`/movies/${movieRes.data.movie.id}/status`, {
  status: "published"
});
```

### Create Series With Episodes

```js
const seriesRes = await api.post("/episodes", {
  series_name: "Mirzapur",
  type: "show",
  genre: ["Crime", "Thriller"],
  episodes: [
    {
      season: 1,
      episode_number: 1,
      title: "Episode 1",
      video_url: "https://...",
      thumbnail_url: "https://..."
    }
  ]
});

const seriesId = seriesRes.data.series.id;
await api.put(`/episodes/${seriesId}`, { status: "published" });
```

### Create Song With Audio

```js
const directRes = await api.post("/songs/upload/direct-url", {
  file_name: audioFile.name,
  mime_type: audioFile.type || "audio/mpeg",
  upload_type: "audio"
});

const direct = directRes.data;

await fetch(direct.upload_url, {
  method: "PUT",
  headers: direct.headers,
  body: audioFile
});

const songRes = await api.post("/songs", {
  song_name: "Kesariya",
  audio_url_hq: direct.public_url,
  mood_tags: ["romantic"],
  genre: ["Romantic"]
});

await api.put(`/songs/${songRes.data.song.id}`, { status: "published" });
```

## Important Gotchas

1. Do not call `/api/v1/upload/*`; those routes are not mounted.
2. For direct uploads, remember the API response is wrapped in `data`.
3. For multipart uploads, do not manually set `Content-Type`.
4. Public list endpoints return only `published` content unless a valid admin token is included.
5. Detail endpoints currently do not filter by status.
6. Movie uses `title`, series uses `series_name`, song uses `song_name`.
7. `DELETE` means archive/deactivate, not physical deletion.
8. `episode_id` is optional in `/views/record`, but the frontend should send it for episode playback.
9. The current view tracking controller accepts `movie` and `show` content for points. `short_film` may need backend adjustment if short films should earn points.
10. Direct GCS uploads require CORS on the storage bucket for the frontend origin.

## Suggested Frontend Screens And API Calls

| Screen | API calls |
|---|---|
| Login | `POST /auth/login` |
| Register | `POST /auth/register` |
| Home/movie rails | `GET /movies`, `GET /episodes`, `GET /songs` |
| Movie detail | `GET /movies/{id}` |
| Series detail | `GET /episodes/{seriesId}` |
| Song detail/player | `GET /songs/{id}` |
| Admin content list | `GET /movies?status=draft`, `GET /episodes?status=draft`, `GET /songs?status=draft` with admin token |
| Admin create movie | direct upload routes, then `POST /movies` |
| Admin create series | direct upload routes, then `POST /episodes` |
| Admin create song | direct upload routes, then `POST /songs` |
| Playback start/completion | `POST /views/record` |
| User points page | `GET /views/user/{user_id}/points` |
| User watch history | `GET /views/user/{user_id}/history` |
