# Backend Boilerplate

Simple backend starter built with:

- Node.js + Express
- TypeScript
- PostgreSQL
- Redis

## Quick Start

```bash
npm install
npx dbmate up
npm run dev
```

Server runs on `http://localhost:3007` by default.

## Required Environment Variables

Create a `.env` file and set:

```env
JWT_SECRET=your_secret
DATABASE_URL=postgres://user:password@localhost:5432/dbname
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=user
SMTP_PASSWORD=password
```

Common optional vars:

- `PORT` (default: `3007`)
- `ENV` (`development`, `production`, `stage`)
- `REDIS_URL` (default: `redis://localhost:6379`)
- `SERVICE_NAME` (default: `Boilerplate`)

## Scripts

- `npm run dev` - Start in development mode
- `npm run dev:watch` - Start with watch mode
- `npm run build` - Build TypeScript to `dist`
- `npm run start` - Run built app
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix lint issues

## API Testing & Documentation

We use Bruno for API testing and API documentation.
Bruno workspace and collections are available in the `bruno/` folder.

## Main Routes

- `GET /` - Service info
- `GET /ping` - Health check
- `POST /auth/register`
- `POST /auth/verify-registration`
- `POST /auth/login`
- `POST /files/upload`
- `POST /files/upload-multiple`

## License

ISC

# web-pop-server
