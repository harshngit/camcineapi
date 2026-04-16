# Express PostgreSQL REST API

A production-ready REST API built with **Node.js**, **Express**, and **PostgreSQL**, featuring Auth & User Management with Swagger documentation.

---

## 📁 Project Structure

```
├── src/
│   ├── app.js                    # Entry point
│   ├── config/
│   │   ├── db.js                 # PostgreSQL pool
│   │   ├── swagger.js            # Swagger/OpenAPI config
│   │   └── initDb.js             # DB schema initializer
│   ├── controllers/
│   │   ├── authController.js     # Auth logic
│   │   └── userController.js     # User management logic
│   ├── middleware/
│   │   ├── auth.js               # JWT authenticate + authorize
│   │   └── validate.js           # express-validator error handler
│   ├── routes/
│   │   ├── authRoutes.js         # /api/v1/auth/*
│   │   └── userRoutes.js         # /api/v1/users/*
│   └── utils/
│       ├── jwt.js                # Token generate/verify
│       └── response.js           # Unified response helpers
├── db/
│   ├── schema.sql                # Full DB schema (run once)
│   ├── auth/
│   │   └── queries.sql           # All auth-related SQL
│   └── users/
│       └── queries.sql           # All user-related SQL
├── .env.example
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your DB credentials and JWT secret
```

### 3. Create PostgreSQL database
```sql
CREATE DATABASE myapp_db;
```

### 4. Initialize the schema
```bash
npm run db:init
```

### 5. Start the server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

---

## 📚 API Endpoints

### Auth — `/api/v1/auth`

| Method | Endpoint              | Auth | Description                        |
|--------|-----------------------|------|------------------------------------|
| POST   | `/register`           | ❌   | Register new user                  |
| POST   | `/login`              | ❌   | Login (email or phone + password)  |
| GET    | `/me`                 | ✅   | Get current authenticated user     |
| POST   | `/forgot-password`    | ❌   | Request password reset token       |
| POST   | `/change-password`    | ❌   | Reset password using token         |

### Users — `/api/v1/users`

| Method | Endpoint    | Auth | Roles            | Description           |
|--------|-------------|------|------------------|-----------------------|
| GET    | `/`         | ✅   | admin, manager   | Get all users         |
| GET    | `/:id`      | ✅   | any              | Get user by ID        |
| PUT    | `/:id`      | ✅   | own or admin     | Update user profile   |
| DELETE | `/:id`      | ✅   | admin            | Soft-delete user      |

---

## 🔐 Roles

| Role      | Permissions                                      |
|-----------|--------------------------------------------------|
| `viewer`  | Read own profile                                 |
| `actor`   | Read own profile                                 |
| `manager` | Read all users, update own profile               |
| `admin`   | Full access: read/update/delete all users, assign roles |

---

## 📖 Swagger Docs

Once the server is running, visit:
```
http://localhost:3000/api-docs
```

Click **Authorize** and paste your JWT token (from login/register) to test protected endpoints.

---

## 🔑 Example Requests

### Register
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+919876543210",
    "password": "secret123",
    "role": "viewer",
    "age": 25
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "john@example.com", "password": "secret123" }'
```

### Get all users (admin)
```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer <your_token>"
```

### Update profile
```bash
curl -X PUT http://localhost:3000/api/v1/users/<user_id> \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "language_preferences": ["en", "hi"],
    "regions": ["IN", "US"]
  }'
```

---

## ⚙️ Environment Variables

| Variable         | Description                        | Default       |
|------------------|------------------------------------|---------------|
| `PORT`           | Server port                        | `3000`        |
| `DB_HOST`        | PostgreSQL host                    | `localhost`   |
| `DB_PORT`        | PostgreSQL port                    | `5432`        |
| `DB_NAME`        | Database name                      | `myapp_db`    |
| `DB_USER`        | Database user                      | `postgres`    |
| `DB_PASSWORD`    | Database password                  | —             |
| `JWT_SECRET`     | JWT signing secret                 | —             |
| `JWT_EXPIRES_IN` | JWT expiry duration                | `7d`          |
| `BCRYPT_ROUNDS`  | Bcrypt salt rounds                 | `10`          |
