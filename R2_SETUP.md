# Coola bilder på Cloudflare R2

Cloudflare R2 lagrar media medan Railway kör webbappen. Bucketen kan vara privat.

## R2-konfiguration

1. Skapa bucketen `studde-coolabilder` i [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2/overview).
2. Skapa ett R2 API-token med **Object Read & Write**, begränsat till endast denna bucket.
3. Spara Access Key ID och Secret Access Key. Secret visas bara en gång.

Använd inte ett globalt Cloudflare-token och lägg aldrig Secret Access Key i Git.

## Lokala miljövariabler

Lägg följande i `.env.local`:

```env
R2_ACCOUNT_ID="ditt-cloudflare-account-id"
R2_ACCESS_KEY_ID="ditt-access-key-id"
R2_SECRET_ACCESS_KEY="din-secret-access-key"
R2_BUCKET_NAME="studde-coolabilder"
R2_ENDPOINT="https://DITT_ACCOUNT_ID.r2.cloudflarestorage.com"
COOLABILDER_UPLOAD_PASSWORD="ett-separat-delbart-lösenord"
```

För en bucket med EU jurisdiction används i stället:

```env
R2_ENDPOINT="https://DITT_ACCOUNT_ID.eu.r2.cloudflarestorage.com"
```

`R2_PUBLIC_BASE_URL` är valfri. Om den lämnas tom genererar appen privata signerade länkar som gäller i sju dagar.

## Migrera

```powershell
npm run media:migrate:r2
```

Scriptet:

1. Hittar bilder och videor i `public/coolabilder-media`.
2. Bevarar datum och ordning i R2-nyckeln.
3. Hoppar över filer som redan finns med samma storlek.
4. Verifierar antal objekt och total storlek efter uppladdningen.

Lokalfiler tas inte bort automatiskt. Ta bort dem först efter lyckad verifiering och test på Railway.

## Railway-variabler

Lägg dessa i Railway-service -> **Variables**:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `COOLABILDER_UPLOAD_PASSWORD`

Efter deploy läser `/coolabilder` automatiskt från R2. Visning använder signerade R2-länkar direkt, medan
“Spara i Bilder” och dags-ZIP använder appens säkra serverroute.

Om R2-variablerna saknas används den lokala mappen som fallback.

## Studentbilder och bilder i inlägg

Fliken **Studentbilder** använder samma R2-anslutning, men separata objekt:

- `student-photos/gallery/`: klassens studentalbum.
- `student-photos/attachments/`: adminbilder i meddelanden och omröstningar.
- `media/` och `thumbnails/`: befintliga Coola bilder, oförändrade.

Ingen ny bucket eller uppladdningskod behövs om R2 redan är anslutet. Studentbilder använder klassens vanliga inloggning. Alla inloggade kan se albumet och lägga upp bilder; uppladdarens namn följer med automatiskt. Elever kan ta bort sina egna bilder och admin kan ta bort alla albumbilder.

JPG, PNG, WebP och GIF stöds, högst 25 MB och 40 megapixel per bild. Originalet sparas tillsammans med en mindre WebP-förhandsvisning. HEIC behöver exporteras som JPG. Admin kan bifoga upp till fyra bilder per inlägg, även vid redigering. Utkast och bortkopplade bilder visas inte i albumet eller offentligt. Publicerade inläggsbilder visas även på den befintliga offentliga startsidan.

Appens startscript skapar den nya `StudentPhoto`-tabellen och index utan att ändra befintliga tabeller. Databasen ska ligga på Railways beständiga volume, precis som tidigare. Bildernas metadata och uppladdare finns i databasen, själva bildfilerna i R2. Övergivna eller bortkopplade inläggsbilder behålls i lagringen; albumbilder raderas när ägaren eller admin tar bort dem.

Kör `npm run test:photos` för isolerade kontroller med en tillfällig databas och lokal S3-testserver. Testet använder aldrig den riktiga bucketen.
