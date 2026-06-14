# Media till `/coolabilder`

Lägg bilder och videor i den här mappen. Sidan `/coolabilder` läser mappen automatiskt när den laddas.

Format som visas:

- Bilder: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
- Videor: `.mp4`, `.mov`, `.m4v`, `.webm`

Sortering:

- Om filnamnet innehåller ett datum som `2026-06-14`, `20260614` eller `14-06-2026` används det datumet.
- Annars försöker sidan läsa originaldatum ur JPG/JPEG EXIF-data och MP4/MOV/M4V metadata.
- Om inget metadata-datum finns används filens ändringsdatum.
- Om två filer får exakt samma datum sorteras de stabilt efter filnamn.

Du kan också skapa undermappar, till exempel `italien/` eller `spanien/`; sidan hittar filerna ändå.
