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

// Fetch Google Contacts endpoint
app.get('/contacts', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Missing authorization header' 
      });
    }

    const { access_token } = req.query;

    if (!access_token) {
      return res.status(400).json({ 
        error: 'Missing access_token query parameter' 
      });
    }

    // Initialize Google People API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token });

    const people = google.people({ version: 'v1', auth: oauth2Client });

    // Fetch contacts
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers,photos'
    });

    res.json({ 
      success: true,
      contacts: response.data.connections || [],
      totalResults: response.data.totalItems || 0
    });

  } catch (error) {
    console.error('Contacts fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contacts',
      details: error.message 
    });
  }
});

// Send email endpoint
app.post('/api/send', async (req, res) => {
  try {
    const { to, subject, body, access_token, from_name } = req.body;

    if (!to || !subject || !body || !access_token) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, body, and access_token' 
      });
    }

    // Initialize Gmail API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get user profile to retrieve email
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = profile.data.emailAddress;

    // Use provided from_name or try to get display name from Gmail settings
    let fromHeader = userEmail;
    
    if (from_name) {
      // Use the provided name from the profiles table
      fromHeader = `${from_name} <${userEmail}>`;
      console.log('Using provided from_name:', from_name);
    } else {
      // Fallback: try to get the user's display name from Gmail settings
      try {
        const sendAs = await gmail.users.settings.sendAs.list({ userId: 'me' });
        const primarySendAs = sendAs.data.sendAs?.find(s => s.isPrimary || s.isDefault);
        if (primarySendAs?.displayName) {
          fromHeader = `${primarySendAs.displayName} <${userEmail}>`;
        }
      } catch (err) {
        console.warn('Could not fetch display name, using email only:', err?.message);
      }
    }

    // Convert line breaks to HTML if body contains plain text
    const formattedBody = body.replace(/\n/g, '<br>');

    // Create email in RFC 2822 format with proper MIME headers
    const email = [
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      formattedBody
    ].join('\n');

    // Encode email in base64url format
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    const sendResult = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    // Ensure the message appears in the Gmail "Sent" label
    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: sendResult.data.id,
        requestBody: {
          addLabelIds: ['SENT']
        }
      });
    } catch (labelError) {
      console.warn('Failed to explicitly add SENT label (Gmail usually applies it automatically):', labelError?.message || labelError);
    }

    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: sendResult.data.id 
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
