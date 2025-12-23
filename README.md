# Genomatch Backend

Backend API for Genomatch application built with Node.js, Express, and PostgreSQL.

## Project Structure

```
genomatch-backend/
├── config/                 # Configuration files
│   ├── database.js        # Database configuration for Sequelize
│   └── env.js             # Environment variables configuration
├── database/
│   ├── migrations/        # Database migrations
│   └── seeders/           # Database seeders
├── src/
│   ├── controllers/       # Request handlers
│   ├── middlewares/       # Custom middleware functions
│   ├── models/            # Sequelize models
│   ├── routes/            # API routes
│   ├── services/          # Business logic layer
│   ├── utils/             # Utility functions
│   ├── validators/        # Request validation schemas
│   └── app.js             # Express app configuration
├── .env.example           # Environment variables template
├── .sequelizerc           # Sequelize CLI configuration
└── server.js              # Application entry point
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/xAlexei52/genomatch-backend.git
cd genomatch-backend
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=genomatch_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key_here
```

5. Create the database:

```bash
createdb genomatch_db
```

6. Run migrations:

```bash
npm run db:migrate
```

7. (Optional) Seed the database:

```bash
npm run db:seed
```

### Running the Application

Development mode with auto-reload:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## Available Scripts

### Development

- `npm start` - Start the server in production mode
- `npm run dev` - Start the server in development mode with nodemon

### Database

- `npm run db:migrate` - Run database migrations
- `npm run db:migrate:undo` - Undo last migration
- `npm run db:seed` - Run all seeders
- `npm run db:seed:undo` - Undo all seeders
- `npm run db:reset` - Drop, create, migrate and seed database

### Code Quality

- `npm run lint` - Run ESLint to check for code issues
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is formatted correctly

## API Endpoints

### Health Check

- `GET /health` - Check server status

### Authentication

- `POST /api/v1/auth/login` - Login (Public)
- `GET /api/v1/auth/profile` - Get user profile (Protected)

### Users

- `POST /api/v1/users` - Create new user (Public)
- `GET /api/v1/users` - Get all users (Protected)
- `GET /api/v1/users/:id` - Get user by ID (Protected)
- `PUT /api/v1/users/:id` - Update user (Protected)
- `DELETE /api/v1/users/:id` - Delete user (Protected)

### Authentication Flow

1. **Register**: Create a new user with `POST /api/v1/users`

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "your_password"
}
```

2. **Login**: Get access token with `POST /api/v1/auth/login`

```json
{
  "email": "john@example.com",
  "password": "your_password"
}
```

3. **Use Token**: Include the token in protected requests

```
Authorization: Bearer YOUR_TOKEN_HERE
```

## Tech Stack

- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Sequelize
- **Security**: Helmet, CORS, bcryptjs
- **Authentication**: JWT (JSON Web Tokens)
- **Logging**: Morgan
- **Environment**: dotenv
- **Code Quality**: ESLint, Prettier

## Development Workflow

### Before Committing

1. Run linter to check for issues:

```bash
npm run lint
```

2. Format your code:

```bash
npm run format
```

3. Or fix both automatically:

```bash
npm run lint:fix && npm run format
```

### Continuous Integration

This project uses GitHub Actions for CI/CD. On every push or pull request to `main` or `dev` branches, the following checks run automatically:

- ESLint code quality checks
- Prettier formatting validation
- Build verification

Make sure all checks pass before merging your PR.

## License

ISC
