# Express + MongoDB Auth App

Minimal authentication API using Express, MongoDB (Mongoose), bcrypt, and JWTs (access and refresh tokens). Refresh tokens are JWTs and not persisted.

Features:
- Register and login with email/password
- JWT access & refresh tokens (refresh tokens are rotated)
- Input validation with Joi
- Password hashing with bcrypt
- Simple error handling and logging

Prerequisites:
- Node.js >= 14
- npm (comes with Node.js)
- MongoDB running (local or remote)

Setup:

1. Clone or copy project files into a directory.
2. Copy .env.example to .env and set values:
   cp .env.example .env
   Edit .env and set JWT secrets and MONGO_URI.
3. Install dependencies:
   npm install
4. Start the app:
   npm start
   Or for development with auto-reload:
   npm run dev

Configuration (environment variables):
- NODE_ENV: development/production
- PORT: port to listen on (default 3000)
- MONGO_URI: MongoDB connection URI
- JWT_ACCESS_SECRET: secret for signing access tokens
- JWT_REFRESH_SECRET: secret for signing refresh tokens
- ACCESS_TOKEN_EXPIRES_IN: e.g. 15m
- REFRESH_TOKEN_EXPIRES_IN: e.g. 7d

API Endpoints:

- POST /api/auth/register
  Request JSON body:
    { "email": "user@example.com", "password": "Password123!" }
  Response 201:
    {
      "user": { "id": "...", "email": "...", "createdAt": "..." },
      "tokens": { "accessToken": "...", "refreshToken": "...", "expiresIn": "15m" }
    }

- POST /api/auth/login
  Request JSON body:
    { "email": "user@example.com", "password": "Password123!" }
  Response 200: same as register

- POST /api/auth/refresh
  Request JSON body:
    { "refreshToken": "..." }
  Response 200:
    { "tokens": { "accessToken": "...", "refreshToken": "...", "expiresIn": "15m" } }

- POST /api/auth/logout
  Request JSON body:
    { "refreshToken": "..." }
  Response 200:
    { "message": "Logged out" }

Usage example (curl):

Register:
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"Password1!"}'

Login:
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"Password1!"}'

Refresh:
curl -X POST http://localhost:3000/api/auth/refresh -H "Content-Type: application/json" -d '{"refreshToken":"<token>"}'

Logout:
curl -X POST http://localhost:3000/api/auth/logout -H "Content-Type: application/json" -d '{"refreshToken":"<token>"}'

Notes:
- Refresh tokens are JWTs and are not stored server-side. Logging out does not revoke tokens on the server.
- Replace JWT secrets with strong random values in production.
- For production, run behind a reverse proxy and enable HTTPS.

Troubleshooting:
- MongoDB connection error: ensure MongoDB is running and MONGO_URI is correct.
- Missing env vars: Copy .env.example to .env and populate values.
- Port in use: change PORT in .env.

Project structure:
- package.json - dependencies and scripts
- .env.example - example environment variables
- src/
  - index.js - entry point (starts server and connects DB)
  - app.js - express app configuration
  - db/mongo.js - mongoose connection helper
  - models/User.js - Mongoose user model
  - services/passwordService.js - hashing and comparing passwords
  - services/jwtService.js - sign/verify access and refresh tokens
  - controllers/authController.js - register/login/refresh/logout logic
  - routes/auth.js - auth routes
  - middleware/validate.js - Joi validation middleware
  - middleware/validators.js - Joi schemas
  - middleware/auth.js - access-token protection middleware
  - middleware/errorHandler.js - centralized error handler
  - utils/logger.js - simple logger wrapper

No social login (OAuth) providers are included in this project.
