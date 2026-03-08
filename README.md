# Studde

Studde ar en Next.js-app for klasskassan till studenten. Varje elev loggar in och ser sin egen historik, medan admin kan registrera nya poster och skapa eller uppdatera elevkonton.

## Ingår

- Elevinloggning med personlig oversikt
- Adminkonto for Edvin Moberg
- SQLite-databas via Prisma
- Importerad startdata fran den klasskassa som byggdes utifran excelfilen
- Historikgraf och klassoversikt

## Lokalt

1. Installera beroenden:

```bash
npm install
```

2. Skapa databasen:

```bash
npm run db:push
```

3. Lagg in startdatan:

```bash
npm run db:seed
```

4. Starta utvecklingsservern:

```bash
npm run dev
```

Appen kor pa [http://localhost:3000](http://localhost:3000).

## Loginuppgifter

Efter seed skapas filen `generated-login-uppgifter.md` i projektroten. Dar finns anvandarnamn och losenord for alla konton.

Admin:

- Anvandarnamn: `edvin.moberg`
- Losenord: `Edvin2026!`

## Deploy

Jag har byggt appen sa att den fungerar lokalt direkt och kan deployas enklast pa Railway med persistent disk.

Det som behovs i produktion:

- `DATABASE_URL`
- `SESSION_SECRET`
- en persistent volym sa att SQLite-filen inte forsvinner mellan deployer

Rekommenderad Railway-sekvens:

```bash
git init
git checkout -b main
git add .
git commit -m "Initial deploy"
```

1. Skapa ett GitHub-repo och pusha projektet.
2. Skapa en ny Railway-tjanst fran GitHub-repot.
3. Lagg till en Volume och montera den pa `/app/data`.
4. Satt `DATABASE_URL=file:../data/dev.db`.
5. Satt en egen `SESSION_SECRET`.
6. Railway kan sedan starta med `npm start`, vilket nu skapar tabeller och seedar databasen automatiskt forsta gangen.

Netlify:

Next.js-delen fungerar pa Netlify, men den nuvarande SQLite-losningen ar inte den snabbaste vagen dit. Om du vill deploya pa Netlify ar nasta steg att flytta lagringen till Postgres eller Netlify DB.
