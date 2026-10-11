# Studde

Studde ar en Next.js-app for klasskassan till studenten. Varje elev loggar in och ser sin egen historik, medan admin kan registrera nya poster och skapa eller uppdatera elevkonton.

## Ingår

- Elevinloggning med personlig oversikt
- Adminkonto for Edvin Moberg
- SQLite-databas via Prisma
- Importerad startdata fran den klasskassa som byggdes utifran excelfilen
- Historikgraf och klassoversikt
- Studiehubb för TE24 med provschema, studiematerial och privata anteckningar

## Studiehubb

Öppna fliken **Studiehubb** som elev eller admin. Schemat innehåller de 13 kommande TE24-tillfällen som lästes från skolkalendern **Skrivschema TE** den 11 oktober 2026, inklusive ett tydligt märkt övnings-PM. Datum och tider visas i svensk tid. Kalendern är en startimport; admin sköter fortsatta ändringar i **Hantera**.

Admin kan skapa och ändra prov, lägga upp flera PDF-, bild- eller ljudfiler samtidigt och lägga till webblänkar. Material kan namnges, beskrivas, sorteras och flyttas mellan prov. Arkivering döljer innehållet för elever och bevarar filer och anteckningar; admin kan återställa det. **Ta bort material** kräver en bekräftelse och raderar filen/länken samt alla användares anteckningar, markeringar och avbockningar för materialet permanent.

Tre studiestöd ingår:

- **Privata anteckningar:** markera text för överstrykning i en PDF, eller välj **Markera område** och dra en ruta i PDF:en/bilden. Markeringen kan sparas med anteckningen och följer med mellan besök och enheter, även vid annan skärmstorlek. Sparade markeringar visas när filen öppnas; deras sifferknappar öppnar motsvarande anteckning. Avmarkera **Spara markeringen med anteckningen** för att enbart spara texten. Punktmarkeringar, ljudtider och avsnitt fungerar också. Även admin ser bara sina egna anteckningar.
- **Personlig checklista:** bocka av genomgånget material och se framsteg inför varje prov. Status sparas i databasen och följer kontot mellan enheter.
- **Fokustimer:** välj ett fokuspass på 15, 25 eller 45 minuter, eller en femminuterspaus. Timern kan pausas och fortsättas medan hubben är öppen.

Filer är högst 40 MB per fil. Format: PDF, JPG, PNG, WebP, GIF, MP3, WAV, OGG och M4A. Alla materialfiler kräver inloggning och hålls utanför klassens bildalbum. Befintlig R2-konfiguration används när den finns. Annars lagras filer bredvid SQLite-databasen på dess beständiga volym; `STUDY_STORAGE_DIR` kan ange en annan beständig katalog. Behåll lagringsplatsen vid flytt eller återställning, eftersom varje material behåller sin ursprungliga lagringstyp.

Databastabeller skapas automatiskt vid normal Railway-start med `npm start`. Startimporten körs utan att skriva över admins ändringar. PDF-läsarens resurser kopieras från den låsta `pdfjs-dist`-versionen vid `npm run dev` och `npm run build`, så läsaren behöver ingen extern PDF-tjänst. Läsaren använder [Mozillas PDF.js](https://mozilla.github.io/pdf.js/).

Kontrollera funktionerna efter `npm run build` med `npm run test:study`. Testet använder en tillfällig databas och tillfällig lokal/S3-lagring och kontrollerar behörighet, privata anteckningar, checklistor, filuppladdning, strömning, arkivering och upprepad start. Det läser eller ändrar inga produktionsdata.

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
