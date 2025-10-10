const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gmail-api-service' });
});

// Archive email endpoint
app.post('/api/archive', async (req, res) => {
  try {
    const { gmail_id, access_token } = req.body;

    if (!gmail_id || !access_token) {
      return res.status(400).json({ 
        error: 'Missing required fields: gmail_id and access_token' 
      });
    }

    // Initialize Gmail API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Remove INBOX label to archive the email
    await gmail.users.messages.modify({
      userId: 'me',
      id: gmail_id,
      requestBody: {
        removeLabelIds: ['INBOX']
      }
    });

    res.json({ 
      success: true, 
      message: 'Email archived successfully',
      gmail_id 
    });

  } catch (error) {
    console.error('Archive error:', error);
    res.status(500).json({ 
      error: 'Failed to archive email',
      details: error.message 
    });
  }
});

// Send email endpoint
app.post('/api/send', async (req, res) => {
  try {
    const { to, subject, body, access_token } = req.body;

    if (!to || !subject || !body || !access_token) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, body, and access_token' 
      });
    }

    // Initialize Gmail API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email in RFC 2822 format
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body
    ].join('\n');

    // Encode email in base64url format
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email and add SENT label
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
        labelIds: ['SENT']
      }
    });

    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: result.data.id 
    });

  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Gmail API service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
