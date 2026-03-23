# AyurSutra Clinic – Full-Stack App

React frontend (port 3000) + Node.js/Express backend (port 8000) + MySQL.

## Prerequisites

- **Node.js** 18+
- **MySQL** (e.g. MySQL Workbench) running locally
- Database: `ayursutra_db`

## 1. Database setup

1. Create the database and run the schema:

   ```sql
   CREATE DATABASE IF NOT EXISTS ayursutra_db;
   USE ayursutra_db;
   ```

   Then run all statements in **`backend/schema.sql`** (in MySQL Workbench or CLI).

2. Create the admin user (run once from the `backend` folder after `npm install`):

   ```bash
   cd backend
   npm install
   node src/scripts/createAdmin.js
   ```

   This creates:

   - **Email:** `admin@ayursutra.local`
   - **Password:** `admin@1234`

   Use these to log in as Admin (Admin Panel → Auth).

## 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit **`.env`** and set:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (e.g. `ayursutra_db`)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (long random strings, e.g. 32+ chars)
- Optional: `PORT=8000`, `FRONTEND_URL=http://localhost:3000`

Then:

```bash
npm install
npm run dev
```

API runs at **http://localhost:8000**.

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:3000**.

Optional: create **`frontend/.env`** with:

```env
VITE_API_URL=http://localhost:8000
```

if the API is not on the same host (Vite proxy is set for `/api` → `http://localhost:8000` when using default dev server).

## 4. Using the app

1. Open **http://localhost:3000**.
2. **Landing:** Click “Login as Patient”, “Login as Doctor”, or “Admin Panel”.
3. **Auth:** Sign up (Patient/Doctor) or log in. Admin: use `admin@ayursutra.local` / `admin@1234`.
4. **Dashboards:** After login you are redirected to the correct dashboard (Patient / Doctor / Admin).
5. **Help:** Use “Help Chat” / “Support” in the dashboard header to open AyurBot.

## Project structure

- **`frontend/`** – React (Vite), React Router, one CSS file per page/component.
- **`backend/`** – Express, raw MySQL (`mysql2`), JWT in httpOnly cookies (access 30 min, refresh 7 days).
- **`backend/schema.sql`** – Tables: users, doctors, appointments, doctor_availability, clinic_settings.
- **`backend/src/scripts/createAdmin.js`** – One-time script to create the admin user.

## Auth

- **Register:** Patient and Doctor only (Admin is created via script).
- **Login:** Email + password; cookies are set by the API (httpOnly, sameSite).
- **Refresh:** Frontend calls `/api/auth/refresh` when the access token expires; no need to log in again until the refresh token expires or user logs out.
