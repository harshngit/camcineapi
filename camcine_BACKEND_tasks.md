# CamCine — Backend Developer Tasks
> Node.js / Express API · Base URL: `/api/v1`
> Follow the same patterns already in the codebase: controllers, routes, middleware/auth, middleware/validate, utils/response

---

## ✅ Already Done (Do NOT rebuild)

| Module | Routes |
|--------|--------|
| Auth | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/forgot-password`, `/auth/change-password` |
| Movies | Full CRUD + GCS uploads + cast management |
| Episodes / Series | Full CRUD + uploads + cast |
| Songs | Full CRUD + audio/lyrics uploads + artists |
| Users | List, get, update, soft-delete |
| View Tracking | Record view, points balance, view history, content stats |

---

## 🔴 New APIs to Build — In Priority Order

---

### 1. Subscriptions & Plans
**New files needed:** `src/routes/subscriptionRoutes.js`, `src/controllers/subscriptionController.js`
**DB tables:** `subscription_plans`, `user_subscriptions` (already migrated)

#### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/subscriptions/plans` | public | List all active plans |
| POST | `/subscriptions/plans` | admin | Create a plan |
| PUT | `/subscriptions/plans/:id` | admin | Update a plan |
| DELETE | `/subscriptions/plans/:id` | admin | Deactivate a plan |
| GET | `/subscriptions` | admin, manager | List all user subscriptions (paginated, filterable by status/plan) |
| GET | `/subscriptions/stats` | admin | Aggregated metrics — MRR, ARR, counts |
| POST | `/subscriptions/:userId/subscribe` | authenticated | Subscribe a user to a plan |
| PATCH | `/subscriptions/:id/cancel` | admin, self | Cancel a subscription |
| PATCH | `/subscriptions/:id/pause` | admin | Pause a subscription |
| PATCH | `/subscriptions/:id/resume` | admin | Resume a paused subscription |
| GET | `/subscriptions/:userId` | admin, self | Get a user's current subscription |

#### Response Shapes

**`GET /subscriptions/plans`**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "uuid",
        "name": "Basic",
        "slug": "basic",
        "price_monthly": 9.99,
        "price_yearly": 99.99,
        "currency": "INR",
        "max_devices": 1,
        "max_streams": 1,
        "resolution": "HD",
        "has_downloads": false,
        "has_early_access": false,
        "features": ["HD Streaming", "1 Device", "Basic Content"],
        "is_active": true,
        "sort_order": 1,
        "created_at": "2026-01-01T00:00:00Z"
      }
    ]
  }
}
```

**`GET /subscriptions`** (admin list)
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "user_name": "John Smith",
        "user_email": "john@email.com",
        "plan_id": "uuid",
        "plan_name": "Premium",
        "status": "active",
        "price_paid": 19.99,
        "currency": "INR",
        "billing_cycle": "monthly",
        "started_at": "2026-01-15T00:00:00Z",
        "expires_at": "2026-02-15T00:00:00Z",
        "auto_renew": true,
        "payment_method_last4": "4242"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 142, "total_pages": 15 }
  }
}
```

**`GET /subscriptions/stats`**
```json
{
  "success": true,
  "data": {
    "mrr": 142600.00,
    "arr": 1711200.00,
    "active_count": 1420,
    "cancelled_count": 87,
    "paused_count": 12,
    "auto_renew_count": 1100,
    "plan_breakdown": [
      { "plan_name": "Basic",    "count": 600, "revenue": 5994.00 },
      { "plan_name": "Standard", "count": 500, "revenue": 7495.00 },
      { "plan_name": "Premium",  "count": 320, "revenue": 6396.80 }
    ],
    "new_this_month": 45,
    "churned_this_month": 12
  }
}
```

**`POST /subscriptions/:userId/subscribe`**
```json
// Request body
{ "plan_id": "uuid", "billing_cycle": "monthly", "payment_method_id": "pm_xxx" }

// Response
{
  "success": true,
  "data": {
    "subscription": { "id": "uuid", "status": "active", "expires_at": "2026-06-24T00:00:00Z" }
  }
}
```

---

### 2. Payments & Transactions
**New files:** `src/routes/paymentRoutes.js`, `src/controllers/paymentController.js`
**DB table:** `payments` (already migrated)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/payments` | admin, manager | List all transactions (filter by status, date range, user) |
| GET | `/payments/stats` | admin | Revenue summary + monthly trend |
| GET | `/payments/:id` | admin | Single transaction detail |
| POST | `/payments/refund/:id` | admin | Issue a refund |
| GET | `/payments/export` | admin | CSV export (query params: `start_date`, `end_date`) |

#### Response Shapes

**`GET /payments`**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "TXN-001234",
        "user_id": "uuid",
        "user_name": "John Smith",
        "user_email": "john@email.com",
        "amount": 1999,
        "currency": "INR",
        "status": "completed",
        "payment_method": "card",
        "card_last4": "4242",
        "card_brand": "visa",
        "plan_id": "uuid",
        "plan_name": "Standard",
        "gateway": "razorpay",
        "gateway_txn_id": "pay_xxxxx",
        "created_at": "2026-05-15T10:30:00Z",
        "subscription_id": "uuid"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 320 }
  }
}
```

**`GET /payments/stats`**
```json
{
  "success": true,
  "data": {
    "total_revenue": 1420000,
    "revenue_today": 8200,
    "revenue_this_month": 142000,
    "revenue_last_month": 138000,
    "completed_count": 1380,
    "failed_count": 28,
    "refunded_count": 14,
    "pending_count": 5,
    "monthly_trend": [
      { "month": "2026-01", "revenue": 110000, "count": 1050 },
      { "month": "2026-02", "revenue": 120000, "count": 1150 }
    ]
  }
}
```

**`POST /payments/refund/:id`**
```json
// Request
{ "reason": "customer_request", "amount": 1999 }

// Response
{ "success": true, "data": { "refund_id": "ref_xxx", "status": "processed" } }
```

---

### 3. Analytics Overview
**New files:** `src/routes/analyticsRoutes.js`, `src/controllers/analyticsController.js`
**Note:** This is a read-only aggregation endpoint. Query the existing `video_views`, `content`, `users`, and `payments` tables.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/analytics/overview` | admin | Full dashboard analytics — one call replaces 12+ |
| GET | `/analytics/content/:id` | admin | Deep per-content analytics |

**Query params for `/analytics/overview`:** `period` = `7d` / `30d` / `90d` / `1y`

**`GET /analytics/overview`**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "summary": {
      "total_views": 148200,
      "unique_viewers": 9800,
      "total_revenue": 142000,
      "active_users": 12400,
      "new_users": 850,
      "total_titles": 142,
      "published_titles": 118,
      "total_points_awarded": 148200
    },
    "top_content": [
      {
        "id": "uuid",
        "title": "Dangal",
        "type": "movie",
        "views": 4200,
        "unique_viewers": 3800,
        "points_awarded": 4200,
        "thumbnail_url": "https://..."
      }
    ],
    "content_type_breakdown": [
      { "type": "movie", "count": 62, "views": 84000 },
      { "type": "show",  "count": 38, "views": 44000 },
      { "type": "song",  "count": 42, "views": 20200 }
    ],
    "views_trend": [
      { "date": "2026-04-24", "views": 4200, "unique_viewers": 3800 }
    ],
    "revenue_trend": [
      { "month": "2026-01", "revenue": 110000 }
    ],
    "user_growth": [
      { "month": "2026-01", "new_users": 620, "total_users": 9800 }
    ]
  }
}
```

---

### 4. Notifications
**New files:** `src/routes/notificationRoutes.js`, `src/controllers/notificationController.js`
**DB table:** `notifications` (already migrated)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | authenticated | Get my notifications (paginated) |
| PATCH | `/notifications/:id/read` | authenticated | Mark one as read |
| PATCH | `/notifications/read-all` | authenticated | Mark all as read |
| DELETE | `/notifications/:id` | authenticated | Delete a notification |
| POST | `/notifications` | admin | Push notification to a user, role, or all |

**`GET /notifications`**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "content",
        "title": "New movie uploaded",
        "body": "The Midnight Archive is now live.",
        "is_read": false,
        "action_url": "/content/uuid",
        "created_at": "2026-05-24T10:00:00Z",
        "actor": { "id": "uuid", "name": "Admin", "avatar_url": null }
      }
    ],
    "unread_count": 3,
    "pagination": { "page": 1, "total": 24 }
  }
}
```

**`POST /notifications`** (admin push)
```json
// Request
{
  "type": "system",
  "title": "Platform update",
  "body": "New features released.",
  "target": "all",
  "target_role": "viewer"
}
```

---

### 5. Watchlist & Watch Progress
**Add to:** `src/routes/userRoutes.js` or new `src/routes/watchRoutes.js`
**DB tables:** `watchlist`, `watch_progress` (already migrated)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/:userId/watchlist` | authenticated | Get user's watchlist |
| POST | `/users/:userId/watchlist` | authenticated | Add content to watchlist |
| DELETE | `/users/:userId/watchlist/:contentId` | authenticated | Remove from watchlist |
| GET | `/users/:userId/continue-watching` | authenticated | Get in-progress content |
| POST | `/users/:userId/progress` | authenticated | Save/update watch progress |

**`GET /users/:userId/continue-watching`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "content_id": "uuid",
        "episode_id": "uuid",
        "title": "Mirzapur",
        "type": "show",
        "progress_seconds": 1240,
        "duration_seconds": 3600,
        "progress_percent": 34.4,
        "episode_number": 3,
        "season": 1,
        "thumbnail_url": "https://...",
        "last_watched_at": "2026-05-23T21:00:00Z"
      }
    ]
  }
}
```

**`POST /users/:userId/progress`**
```json
// Request
{ "content_id": "uuid", "episode_id": "uuid", "progress_seconds": 1240 }
// Response
{ "success": true, "message": "Progress saved." }
```

---

### 6. Ratings & Reviews
**New files:** `src/routes/ratingRoutes.js` or add to `movieRoutes.js` / `episodeRoutes.js`
**DB table:** `ratings` (already migrated)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/content/:id/ratings` | authenticated | Submit a rating + review |
| GET | `/content/:id/ratings` | public | List ratings for a content |
| PUT | `/content/:id/ratings/:ratingId` | self | Edit own rating |
| DELETE | `/content/:id/ratings/:ratingId` | admin | Moderate/remove a review |

**`POST /content/:id/ratings`**
```json
// Request
{ "rating": 4, "review": "Great movie!" }

// Response
{ "success": true, "data": { "id": "uuid", "average_rating": 4.2, "total_ratings": 128 } }
```

**`GET /content/:id/ratings`**
```json
{
  "success": true,
  "data": {
    "average_rating": 4.2,
    "total_ratings": 128,
    "breakdown": { "5": 60, "4": 40, "3": 18, "2": 7, "1": 3 },
    "reviews": [
      {
        "id": "uuid",
        "user_name": "Rahul M.",
        "rating": 5,
        "review": "Absolutely brilliant.",
        "created_at": "2026-05-20T10:00:00Z"
      }
    ],
    "pagination": { "page": 1, "total": 128 }
  }
}
```

---

### 7. Unified Search
**New files:** `src/routes/searchRoutes.js`, `src/controllers/searchController.js`
**Note:** Use `ILIKE` or PostgreSQL full-text search (`tsvector`) across `content`, `songs_metadata`, `actors` tables.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/search` | public | Search across all content types |

**Query params:** `q` (required), `type` = `movie|show|song|actor|all`, `page`, `limit`

```json
{
  "success": true,
  "data": {
    "query": "dangal",
    "results": [
      {
        "id": "uuid",
        "type": "movie",
        "title": "Dangal",
        "poster_url": "https://...",
        "year": 2016,
        "language": "Hindi",
        "rating": "U"
      }
    ],
    "by_type": { "movies": 1, "shows": 0, "songs": 2, "actors": 0 },
    "pagination": { "total": 3 }
  }
}
```

---

### 8. Actors Directory
**New files:** `src/routes/actorRoutes.js`, `src/controllers/actorController.js`
**DB table:** `actors` (already exists in your DB)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/actors` | public | List actors (search, filter by nationality/role) |
| GET | `/actors/:id` | public | Single actor profile |
| POST | `/actors` | admin | Create actor profile |
| PUT | `/actors/:id` | admin | Update actor |
| GET | `/actors/:id/filmography` | public | All content the actor appears in |

**`GET /actors`**
```json
{
  "success": true,
  "data": {
    "actors": [
      {
        "id": "uuid",
        "name": "Aamir Khan",
        "headshot_url": "https://...",
        "nationality": "Indian",
        "bio": "...",
        "content_count": 14,
        "is_verified": true,
        "user_id": "uuid"
      }
    ],
    "pagination": { "total": 84 }
  }
}
```

**`GET /actors/:id/filmography`**
```json
{
  "success": true,
  "data": {
    "movies": [ { "id": "uuid", "title": "Dangal", "role_type": "lead_actor", "year": 2016 } ],
    "shows": [],
    "songs": []
  }
}
```

---

### 9. News / Blog
**New files:** `src/routes/newsRoutes.js`, `src/controllers/newsController.js`
**DB table:** `news_articles` (already migrated)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/news` | public | List published articles (paginated) |
| GET | `/news/:id` | public | Single article |
| POST | `/news` | admin, manager | Create article (draft) |
| PUT | `/news/:id` | admin, manager | Update article |
| PATCH | `/news/:id/publish` | admin | Publish/unpublish |
| DELETE | `/news/:id` | admin | Delete article |

**`POST /news`**
```json
// Request
{
  "title": "New season of Mirzapur announced",
  "slug": "mirzapur-season-4",
  "body": "Full article content...",
  "category": "announcement",
  "tags": ["mirzapur", "amazon"],
  "thumbnail_url": "https://...",
  "is_published": false
}
```

---

### 10. Content Recommendations
**Add to:** `src/controllers/movieController.js` or new `recommendationController.js`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/content/trending` | public | Top viewed content in last 7 days |
| GET | `/content/new-releases` | public | Content published in last 30 days |
| GET | `/users/:userId/recommendations` | authenticated | Personalised by watch history |

**`GET /users/:userId/recommendations`**
```json
{
  "success": true,
  "data": {
    "because_you_watched": [ { "id": "uuid", "title": "...", "type": "movie" } ],
    "trending_now": [],
    "new_releases": [],
    "free_to_watch": []
  }
}
```

---

### 11. Platform Settings
**New files:** `src/routes/settingsRoutes.js`, `src/controllers/settingsController.js`
**DB table:** `platform_settings` (already migrated + seeded)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/settings` | admin | Get all platform settings |
| PUT | `/settings` | admin | Update one or more settings |

**`GET /settings`**
```json
{
  "success": true,
  "data": {
    "platform_name": "CamCine",
    "tagline": "Stream India",
    "daily_view_points_limit": 3,
    "points_per_view": 1,
    "maintenance_mode": false,
    "signup_enabled": true,
    "default_content_language": "Hindi",
    "supported_languages": ["Hindi", "English", "Marathi"]
  }
}
```

**`PUT /settings`**
```json
// Request — send only the keys you want to change
{ "maintenance_mode": true, "tagline": "Stream Bharat" }
```

---

### 12. Manager Earnings
**Add to:** `src/routes/userRoutes.js` or new `src/routes/managerRoutes.js`
**DB tables:** `manager_payouts`, `content_revenue_shares` (already migrated)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/managers/:managerId/earnings` | admin, self | Earnings summary + payout history |
| GET | `/managers/:managerId/earnings/content` | admin, self | Per-content revenue breakdown |
| POST | `/managers/:managerId/payouts` | admin | Create a payout record |
| PATCH | `/managers/payouts/:payoutId` | admin | Update payout status |

**`GET /managers/:managerId/earnings`**
```json
{
  "success": true,
  "data": {
    "total_earned": 24000,
    "pending_payout": 3200,
    "this_month": 8400,
    "last_month": 7200,
    "content_performance": [
      { "content_id": "uuid", "title": "Dangal", "views": 4200, "revenue_share": 420 }
    ],
    "payout_history": [
      { "id": "uuid", "amount": 5000, "status": "paid", "paid_at": "2026-04-30T00:00:00Z" }
    ]
  }
}
```

---

### 13. Support Tickets
**New files:** `src/routes/supportRoutes.js`, `src/controllers/supportController.js`
**DB tables:** `support_tickets`, `support_ticket_replies` (already migrated)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/support/tickets` | admin, manager | List all tickets (filter by status, category) |
| GET | `/support/tickets/:id` | admin, self | Single ticket with replies |
| POST | `/support/tickets` | authenticated | Open a new ticket |
| PUT | `/support/tickets/:id` | admin | Update status / assign |
| POST | `/support/tickets/:id/reply` | admin, self | Add a reply |
| DELETE | `/support/tickets/:id` | admin | Delete a ticket |

**`POST /support/tickets`**
```json
// Request
{
  "subject": "Video not loading",
  "category": "technical",
  "body": "The movie Dangal keeps buffering after 5 minutes.",
  "content_id": "uuid"
}

// Response
{ "success": true, "data": { "id": "TKT-000284", "status": "open" } }
```

---

### 14. Activity Log (Internal)
**DB table:** `activity_log` (already migrated)
**Note:** Write log entries automatically in your existing controllers on all create/update/delete actions. Expose a read-only endpoint for the dashboard.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/activity-log` | admin | Recent platform activity feed |

**`GET /activity-log`**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid",
        "actor_name": "Admin",
        "action": "movie.created",
        "entity_type": "movie",
        "entity_title": "The Midnight Archive",
        "created_at": "2026-05-24T10:00:00Z"
      }
    ]
  }
}
```

**Where to add logging calls (in existing controllers):**
- `movieController.js` → on `createMovie`, `updateMovie`, `deleteMovie`
- `episodeController.js` → on `createSeries`, `deleteSeries`, `addEpisode`
- `userController.js` → on `updateUser`, `deleteUser`
- `authController.js` → on `register`

---

## 📐 DB Tables Already Migrated (Run `camcine_new_tables.sql`)

| Table | Used By |
|-------|---------|
| `subscription_plans` | #1 Subscriptions |
| `user_subscriptions` | #1 Subscriptions |
| `payments` | #2 Payments |
| `notifications` | #4 Notifications |
| `watchlist` | #5 Watchlist |
| `watch_progress` | #5 Continue Watching |
| `ratings` | #6 Ratings |
| `news_articles` | #9 News |
| `support_tickets` | #13 Support |
| `support_ticket_replies` | #13 Support |
| `activity_log` | #14 Activity Log |
| `platform_settings` | #11 Settings |
| `manager_payouts` | #12 Earnings |
| `content_revenue_shares` | #12 Earnings |
| `featured_content` | #10 Recommendations |

---

## Build Order

1. Subscriptions + Plans
2. Payments
3. Analytics Overview
4. Watchlist + Progress
5. Notifications
6. Search
7. Actors
8. News
9. Ratings
10. Settings
11. Manager Earnings
12. Support Tickets
13. Activity Log (wire into existing controllers last)
