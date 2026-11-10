# Event Scheduler

Schedule HTTP requests from a React UI. A Node server stores jobs in Postgres and `node-cron` sends them on time, optionally through a proxy you save.

## Stack

- React (Vite) at `client/`
- Express + `node-cron` + Axios at `server/`
- Postgres via Docker

## Start

1. Start the database:

```bash
docker compose up -d
```

2. Install and run the API:

```bash
cd server
copy .env.example .env
npm install
npm run dev
```

3. Install and run the UI:

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

## First job

1. **Proxies** — save `host`, `port`, protocol (`http` / `https` / `socks5`), and optional auth. If your provider already rotates IPs, one gateway URL is enough.
2. **Jobs** — set method, URL, headers, body, and datetime, or paste a raw HTTP request and click **Parse request**.
3. Attach a proxy (or leave direct). Save. Cron checks every minute.
4. **Run now** sends immediately. **History** shows status codes and a response preview.

Jobs keep running after you close the browser; only the Node process needs to stay up.
