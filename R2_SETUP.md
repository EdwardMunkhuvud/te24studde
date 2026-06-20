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
