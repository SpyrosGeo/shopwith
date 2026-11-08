# shopwith

A shopping list web app. `frontend/` is React + TypeScript + Tailwind CSS; `backend/` is Node (Fastify + Prisma + PostgreSQL).

## Running the backend

### Prerequisites

- Node.js (with npm)
- Docker with Docker Compose (runs PostgreSQL)

### First-time setup

1. Start the database from the repo root:

   ```sh
   docker compose up -d
   ```

   This runs PostgreSQL 17 on `localhost:5432` with user `shopwith`, password `shopwith` and database `shopwith`. Data persists in the `pgdata` Docker volume.

2. Install dependencies:

   ```sh
   cd backend
   npm install
   ```

3. Create `backend/.env`. It is gitignored, so each machine needs its own:

   ```
   DATABASE_URL="postgresql://shopwith:shopwith@localhost:5432/shopwith"
   PORT=3000
   ```

4. Create `backend/.env.test` for the tests:

   ```sh
   cp .env.test.example .env.test
   ```

5. Apply the migrations and generate the Prisma client:

   ```sh
   npx prisma migrate dev
   npx prisma generate
   ```

   The generated client lives in `src/generated/` and is gitignored. Rerun `npx prisma generate` after changing `prisma/schema.prisma`.

### Day to day

From the repo root, make sure the database is running, then start the server in watch mode:

```sh
docker compose up -d
cd backend
npm run dev
```

The API listens on `http://localhost:3000` under `/api`.

### Tests

```sh
cd backend
npm test
```

The tests use a separate database, `shopwith_test`, which is created automatically. Each run wipes and re-migrates it; the setup refuses to reset any database whose name does not end in `_test`.

### Stopping the database

```sh
docker compose down      # stop the container, keep the data
docker compose down -v   # stop it and delete all data
```
