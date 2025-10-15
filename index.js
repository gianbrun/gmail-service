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
  console.log('=== RAILWAY SEND EMAIL START ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const { to, subject, body, access_token, from_name } = req.body;

    console.log('Request params:', {
      to,
      subject,
      body_length: body?.length || 0,
      has_access_token: !!access_token,
      from_name
    });

    if (!to || !subject || !body || !access_token) {
      console.error('Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, body, and access_token' 
      });
    }

    // Initialize Gmail API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    console.log('Fetching user Gmail profile...');
    // Get user profile to retrieve email
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = profile.data.emailAddress;
    console.log('User email from Gmail:', userEmail);

    // Use provided from_name or try to get display name from Gmail settings
    let fromHeader = userEmail;
    
    if (from_name) {
      // Use the provided name from the profiles table
      fromHeader = `${from_name} <${userEmail}>`;
      console.log('Using provided from_name:', from_name);
      console.log('Final From header:', fromHeader);
    } else {
      // Fallback: try to get the user's display name from Gmail settings
      console.log('No from_name provided, fetching from Gmail settings...');
      try {
        const sendAs = await gmail.users.settings.sendAs.list({ userId: 'me' });
        const primarySendAs = sendAs.data.sendAs?.find(s => s.isPrimary || s.isDefault);
        if (primarySendAs?.displayName) {
          fromHeader = `${primarySendAs.displayName} <${userEmail}>`;
          console.log('Using Gmail display name:', primarySendAs.displayName);
        }
      } catch (err) {
        console.warn('Could not fetch display name, using email only:', err?.message);
      }
      console.log('Final From header:', fromHeader);
    }

    // Convert line breaks to HTML if body contains plain text
    const formattedBody = body.replace(/\n/g, '<br>');

    console.log('Building email message...');
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

    console.log('Email headers:', {
      from: fromHeader,
      to,
      subject
    });

    // Encode email in base64url format
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    console.log('Sending email via Gmail API...');
    // Send the email
    const sendResult = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    console.log('Gmail API send result. Message ID:', sendResult.data.id);

    // Ensure the message appears in the Gmail "Sent" label
    console.log('Adding SENT label...');
    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: sendResult.data.id,
        requestBody: {
          addLabelIds: ['SENT']
        }
      });
      console.log('SENT label added successfully');
    } catch (labelError) {
      console.warn('Failed to explicitly add SENT label (Gmail usually applies it automatically):', labelError?.message || labelError);
    }

    console.log('Email sent successfully!');
    console.log('=== RAILWAY SEND EMAIL END ===');

    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: sendResult.data.id 
    });

  } catch (error) {
    console.error('=== RAILWAY SEND EMAIL ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('API response error:', error.response.data);
    }
    console.error('=== ERROR END ===');
    
    res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});

// Fetch Gmail signatures endpoint
app.post('/api/signatures', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ 
        error: 'Missing required field: access_token' 
      });
    }

    // Initialize Gmail API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get all send-as settings (including signatures)
    const sendAsResponse = await gmail.users.settings.sendAs.list({ userId: 'me' });
    
    const signatures = sendAsResponse.data.sendAs?.map(sendAs => ({
      email: sendAs.sendAsEmail,
      displayName: sendAs.displayName || '',
      signature: sendAs.signature || '',
      isDefault: sendAs.isDefault || false,
      isPrimary: sendAs.isPrimary || false,
    })) || [];

    res.json({ 
      success: true,
      signatures 
    });

  } catch (error) {
    console.error('Signatures fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch signatures',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Gmail API service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
