# Gmail API Service

REST API service für Gmail - Archivieren und Versenden von E-Mails.

## Features

- ✉️ E-Mails versenden
- 📥 E-Mails archivieren
- 🔒 OAuth2 Token-basierte Authentifizierung
- 🚀 Docker-ready für Railway deployment

## Deployment auf Railway

### 1. GitHub Repository erstellen

1. Gehe zu [GitHub](https://github.com/new)
2. Erstelle ein neues Repository (z.B. `gmail-api-service`)
3. Lade alle Dateien aus diesem Ordner hoch:
   - `Dockerfile`
   - `package.json`
   - `index.js`
   - `README.md`

### 2. Mit Railway verbinden

1. Gehe zu [Railway.app](https://railway.app)
2. Klicke auf "New Project"
3. Wähle "Deploy from GitHub repo"
4. Wähle dein `gmail-api-service` Repository
5. Railway erkennt automatisch das Dockerfile und deployed es
6. Warte bis der Deployment abgeschlossen ist
7. Klicke auf "Generate Domain" um eine öffentliche URL zu bekommen

### 3. Service URL notieren

Nach dem Deployment bekommst du eine URL wie:
`https://dein-service.up.railway.app`

Diese URL brauchst du für die API Calls.

## API Endpoints

### Health Check

```bash
GET /health
```

Antwort:
```json
{
  "status": "ok",
  "service": "gmail-api-service"
}
```

### E-Mail archivieren

```bash
POST /api/archive
Content-Type: application/json

{
  "gmail_id": "18f1a2b3c4d5e6f7",
  "access_token": "ya29.a0AfH6..."
}
```

### E-Mail versenden

```bash
POST /api/send
Content-Type: application/json

{
  "to": "empfaenger@example.com",
  "subject": "Betreff",
  "body": "<p>HTML E-Mail Body</p>",
  "access_token": "ya29.a0AfH6..."
}
```

## Verwendung in deiner Lovable App

```typescript
const RAILWAY_URL = 'https://dein-service.up.railway.app';

// E-Mail archivieren
const archiveEmail = async (gmailId: string, accessToken: string) => {
  const response = await fetch(`${RAILWAY_URL}/api/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gmail_id: gmailId,
      access_token: accessToken
    })
  });
  return response.json();
};

// E-Mail versenden
const sendEmail = async (to: string, subject: string, body: string, accessToken: string) => {
  const response = await fetch(`${RAILWAY_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body, access_token: accessToken })
  });
  return response.json();
};
```

## OAuth2 Access Token

Der `access_token` muss von deiner Lovable App bereitgestellt werden. Du kannst ihn aus der Supabase `email_accounts` Tabelle holen, wo er als `provider_token` gespeichert ist.

## Kosten

Railway bietet:
- $5 gratis Credits pro Monat
- Danach ca. $0.000463 pro Minute CPU-Zeit

Geschätzte Kosten für niedrige Last: ~$2-5/Monat

## Support

Bei Problemen:
1. Prüfe die Railway Logs
2. Teste den `/health` endpoint
3. Stelle sicher, dass der access_token gültig ist
