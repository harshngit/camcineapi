/**
 * @swagger
 * tags:
 *   - name: Subscriptions
 *     description: Subscription plans, subscriber lifecycle, and subscription metrics
 *   - name: Payments
 *     description: Payment transactions, refunds, revenue stats, and exports
 *   - name: Analytics
 *     description: Dashboard analytics aggregation endpoints
 *   - name: Notifications
 *     description: User notifications and admin push messages
 *   - name: Watchlist
 *     description: User watchlist and continue-watching progress
 *   - name: Ratings
 *     description: Content ratings and reviews
 *   - name: Search
 *     description: Unified search across content and actors
 *   - name: Actors
 *     description: Actor profiles and filmography
 *   - name: News
 *     description: Public news and admin article management
 *   - name: Recommendations
 *     description: Trending, new release, and personalized content rows
 *   - name: Settings
 *     description: Admin platform settings
 *   - name: Managers
 *     description: Manager earnings and payout management
 *   - name: Support
 *     description: Support ticket workflow
 *   - name: Activity Log
 *     description: Internal platform activity feed
 *
 * components:
 *   schemas:
 *     SubscriptionPlan:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, example: Premium }
 *         slug: { type: string, example: premium }
 *         price_monthly: { type: number, example: 199 }
 *         price_yearly: { type: number, example: 1999 }
 *         currency: { type: string, example: INR }
 *         max_devices: { type: integer, example: 4 }
 *         max_streams: { type: integer, example: 2 }
 *         resolution: { type: string, example: 4K }
 *         features:
 *           type: array
 *           items: { type: string }
 *     UserSubscription:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         user_id: { type: string, format: uuid }
 *         plan_id: { type: string, format: uuid }
 *         status: { type: string, example: active }
 *         billing_cycle: { type: string, example: monthly }
 *         price_paid: { type: number, example: 199 }
 *         expires_at: { type: string, format: date-time }
 *     Payment:
 *       type: object
 *       properties:
 *         id: { type: string, example: TXN-001234 }
 *         user_id: { type: string, format: uuid }
 *         amount: { type: number, example: 199 }
 *         currency: { type: string, example: INR }
 *         status: { type: string, example: completed }
 *         gateway: { type: string, example: razorpay }
 *         created_at: { type: string, format: date-time }
 *     ContentSummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         type: { type: string, example: movie }
 *         title: { type: string, example: Dangal }
 *         poster_url: { type: string }
 *         thumbnail_url: { type: string }
 *         release_year: { type: integer, example: 2016 }
 *     Actor:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, example: Aamir Khan }
 *         screen_name: { type: string }
 *         headshot_url: { type: string }
 *         bio: { type: string }
 *         is_verified: { type: boolean }
 *     NewsArticle:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         title: { type: string }
 *         slug: { type: string }
 *         body: { type: string }
 *         category: { type: string }
 *         is_published: { type: boolean }
 *     SupportTicket:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         subject: { type: string }
 *         category: { type: string, example: technical }
 *         body: { type: string }
 *         status: { type: string, example: open }
 *         priority: { type: string, example: normal }
 */

/**
 * @swagger
 * /subscriptions/plans:
 *   get:
 *     summary: List active subscription plans
 *     tags: [Subscriptions]
 *     security: []
 *     responses:
 *       200:
 *         description: Active plans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     plans:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/SubscriptionPlan' }
 *   post:
 *     summary: Create a subscription plan
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SubscriptionPlan' }
 *     responses:
 *       201: { description: Plan created }
 * /subscriptions/plans/{id}:
 *   put:
 *     summary: Update a subscription plan
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Plan updated }
 *   delete:
 *     summary: Deactivate a subscription plan
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Plan deactivated }
 * /subscriptions:
 *   get:
 *     summary: List user subscriptions
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: plan_id, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Paginated subscriptions }
 * /subscriptions/stats:
 *   get:
 *     summary: Get subscription metrics
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: MRR, ARR, counts, and plan breakdown }
 * /subscriptions/{userId}:
 *   get:
 *     summary: Get a user's current subscription
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Current or latest subscription }
 * /subscriptions/{userId}/subscribe:
 *   post:
 *     summary: Subscribe a user to a plan
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan_id]
 *             properties:
 *               plan_id: { type: string, format: uuid }
 *               billing_cycle: { type: string, enum: [monthly, yearly], default: monthly }
 *               payment_method_id: { type: string }
 *     responses:
 *       201: { description: Subscription activated }
 * /subscriptions/{id}/cancel:
 *   patch:
 *     summary: Cancel a subscription
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Subscription cancelled }
 * /subscriptions/{id}/pause:
 *   patch:
 *     summary: Pause a subscription
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Subscription paused }
 * /subscriptions/{id}/resume:
 *   patch:
 *     summary: Resume a subscription
 *     tags: [Subscriptions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Subscription resumed }
 */

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: List payment transactions
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: user_id, schema: { type: string, format: uuid } }
 *       - { in: query, name: start_date, schema: { type: string, format: date } }
 *       - { in: query, name: end_date, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Paginated transactions }
 * /payments/stats:
 *   get:
 *     summary: Get revenue and payment status metrics
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Revenue stats and monthly trend }
 * /payments/export:
 *   get:
 *     summary: Export payment transactions
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: start_date, schema: { type: string, format: date } }
 *       - { in: query, name: end_date, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Export payload }
 * /payments/{id}:
 *   get:
 *     summary: Get a payment transaction
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Payment detail }
 * /payments/refund/{id}:
 *   post:
 *     summary: Refund a completed payment
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: customer_request }
 *               amount: { type: number, example: 199 }
 *     responses:
 *       200: { description: Refund processed }
 */

/**
 * @swagger
 * /analytics/overview:
 *   get:
 *     summary: Get dashboard analytics overview
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: period, schema: { type: string, enum: [7d, 30d, 90d, 1y], default: 30d } }
 *     responses:
 *       200: { description: Summary, trends, top content, content breakdown, and user growth }
 * /analytics/content/{id}:
 *   get:
 *     summary: Get per-content analytics
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Content analytics }
 */

/**
 * @swagger
 * /users/{userId}/watchlist:
 *   get:
 *     summary: Get a user's watchlist
 *     tags: [Watchlist]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Watchlist items }
 *   post:
 *     summary: Add content to a user's watchlist
 *     tags: [Watchlist]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content_id]
 *             properties:
 *               content_id: { type: string, format: uuid }
 *     responses:
 *       201: { description: Added to watchlist }
 * /users/{userId}/watchlist/{contentId}:
 *   delete:
 *     summary: Remove content from a user's watchlist
 *     tags: [Watchlist]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: contentId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Removed from watchlist }
 * /users/{userId}/continue-watching:
 *   get:
 *     summary: Get continue-watching items
 *     tags: [Watchlist]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: In-progress content }
 * /users/{userId}/progress:
 *   post:
 *     summary: Save watch progress
 *     tags: [Watchlist]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content_id, progress_seconds]
 *             properties:
 *               content_id: { type: string, format: uuid }
 *               episode_id: { type: string, format: uuid }
 *               progress_seconds: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: Progress saved }
 */

/**
 * @swagger
 * /content/{id}/ratings:
 *   get:
 *     summary: List content ratings and reviews
 *     tags: [Ratings]
 *     security: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *     responses:
 *       200: { description: Rating summary and reviews }
 *   post:
 *     summary: Submit a rating and review
 *     tags: [Ratings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               review: { type: string }
 *     responses:
 *       201: { description: Rating saved }
 * /content/{id}/ratings/{ratingId}:
 *   put:
 *     summary: Update own rating
 *     tags: [Ratings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: ratingId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Rating updated }
 *   delete:
 *     summary: Moderate/remove a review
 *     tags: [Ratings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: ratingId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Rating removed }
 */

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Unified search across movies, shows, songs, and actors
 *     tags: [Search]
 *     security: []
 *     parameters:
 *       - { in: query, name: q, required: true, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string, enum: [movie, show, song, actor, all], default: all } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Search results and type counts }
 */

/**
 * @swagger
 * /actors:
 *   get:
 *     summary: List actors
 *     tags: [Actors]
 *     security: []
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, example: pending } }
 *     responses:
 *       200: { description: Actor list }
 *   post:
 *     summary: Create actor profile
 *     tags: [Actors]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Actor created }
 * /actors/{id}:
 *   get:
 *     summary: Get actor profile
 *     tags: [Actors]
 *     security: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Actor profile }
 *   put:
 *     summary: Update actor profile
 *     tags: [Actors]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Actor updated }
 * /actors/{id}/filmography:
 *   get:
 *     summary: Get actor filmography
 *     tags: [Actors]
 *     security: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Movies, shows, and songs for the actor }
 */

/**
 * @swagger
 * /news:
 *   get:
 *     summary: List published news articles
 *     tags: [News]
 *     security: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 12 } }
 *       - { in: query, name: category, schema: { type: string } }
 *     responses:
 *       200: { description: Published article list }
 *   post:
 *     summary: Create a news article
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Article created }
 * /news/{id}:
 *   get:
 *     summary: Get a news article by ID or slug
 *     tags: [News]
 *     security: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Article detail }
 *   put:
 *     summary: Update a news article
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Article updated }
 *   delete:
 *     summary: Delete a news article
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Article deleted }
 * /news/{id}/publish:
 *   patch:
 *     summary: Toggle article publish state
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Publish status updated }
 */

/**
 * @swagger
 * /content/trending:
 *   get:
 *     summary: Get trending content
 *     tags: [Recommendations]
 *     security: []
 *     responses:
 *       200: { description: Trending content rows }
 * /content/new-releases:
 *   get:
 *     summary: Get new releases
 *     tags: [Recommendations]
 *     security: []
 *     responses:
 *       200: { description: New release content rows }
 * /users/{userId}/recommendations:
 *   get:
 *     summary: Get personalized recommendations
 *     tags: [Recommendations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Personalized recommendation rows }
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get my notifications
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notifications and unread count }
 *   post:
 *     summary: Create an admin notification
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Notification created }
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications read
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notifications marked read }
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark notification read
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Notification marked read }
 * /notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Notification deleted }
 */

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Get platform settings
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Settings object }
 *   put:
 *     summary: Update platform settings
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: true }
 *     responses:
 *       200: { description: Updated settings }
 */

/**
 * @swagger
 * /managers/{managerId}/earnings:
 *   get:
 *     summary: Get manager earnings summary
 *     tags: [Managers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: managerId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Earnings summary and payout history }
 * /managers/{managerId}/earnings/content:
 *   get:
 *     summary: Get per-content manager earnings
 *     tags: [Managers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: managerId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Per-content revenue rows }
 * /managers/{managerId}/payouts:
 *   post:
 *     summary: Create manager payout
 *     tags: [Managers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: managerId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       201: { description: Payout created }
 * /managers/payouts/{payoutId}:
 *   patch:
 *     summary: Update payout status
 *     tags: [Managers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: payoutId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Payout updated }
 */

/**
 * @swagger
 * /support/tickets:
 *   get:
 *     summary: List support tickets
 *     tags: [Support]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: priority, schema: { type: string } }
 *       - { in: query, name: user_id, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Ticket list }
 *   post:
 *     summary: Open a support ticket
 *     tags: [Support]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, body]
 *             properties:
 *               subject: { type: string }
 *               category: { type: string, example: technical }
 *               body: { type: string }
 *               content_id: { type: string, format: uuid }
 *     responses:
 *       201: { description: Ticket submitted }
 * /support/tickets/{id}:
 *   get:
 *     summary: Get ticket detail with replies
 *     tags: [Support]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Ticket detail }
 *   put:
 *     summary: Update ticket status, priority, or assignment
 *     tags: [Support]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Ticket updated }
 *   delete:
 *     summary: Delete ticket
 *     tags: [Support]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Ticket deleted }
 * /support/tickets/{id}/reply:
 *   post:
 *     summary: Add a ticket reply
 *     tags: [Support]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string }
 *     responses:
 *       201: { description: Reply added }
 */

/**
 * @swagger
 * /activity-log:
 *   get:
 *     summary: Get recent platform activity
 *     tags: [Activity Log]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Recent activity events }
 */

module.exports = {};
