/**
 * Express Server - Email Subscription Handler (Fallback Option)
 * Handles form submissions, sends emails, and stores signups
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Resend } = require('resend');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration
const config = {
    emailProvider: process.env.EMAIL_PROVIDER || 'resend',
    emailApiKey: process.env.EMAIL_API_KEY,
    emailFrom: process.env.EMAIL_FROM || 'noreply@revanx.com',
    emailTo: process.env.EMAIL_TO || 'hello@revanx.com',
    storageMode: process.env.STORAGE_MODE || 'json',
    isDryRun: !process.env.EMAIL_API_KEY,
    dataDir: path.join(__dirname, 'data')
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.', { 
    index: 'index.html',
    extensions: ['html', 'htm']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to subscription endpoint
app.use('/subscribe', limiter);

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        isDryRun: config.isDryRun
    });
});

/**
 * Subscription endpoint
 */
app.post('/subscribe', async (req, res) => {
    try {
        // Validate and sanitize input
        const validationResult = validateInput(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                message: validationResult.message
            });
        }
        
        const { name, email, consent, timestamp, userAgent, referrer } = validationResult.data;
        
        // Get client IP
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        
        // Create signup record
        const signup = {
            id: generateId(),
            name: name || null,
            email,
            consent,
            timestamp,
            userAgent,
            referrer,
            ip: clientIP,
            createdAt: new Date().toISOString()
        };
        
        // Store signup
        await storeSignup(signup);
        
        // Send notification email
        await sendNotificationEmail(signup);
        
        // Send confirmation email to user (optional)
        if (!config.isDryRun) {
            await sendConfirmationEmail(signup);
        }
        
        res.json({
            success: true,
            message: 'Successfully subscribed! Check your email for confirmation.'
        });
        
    } catch (error) {
        console.error('Subscription error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
});

/**
 * Get signups endpoint (for admin use)
 */
app.get('/admin/signups', async (req, res) => {
    try {
        const signups = await getSignups();
        res.json({
            success: true,
            count: signups.length,
            signups: signups.map(signup => ({
                ...signup,
                ip: signup.ip ? signup.ip.substring(0, 8) + '***' : 'unknown' // Mask IP for privacy
            }))
        });
    } catch (error) {
        console.error('Error fetching signups:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching signups'
        });
    }
});

/**
 * Validate and sanitize input
 */
function validateInput(body) {
    if (!body || typeof body !== 'object') {
        return { isValid: false, message: 'Invalid request body' };
    }
    
    const { name, email, consent, timestamp, userAgent, referrer } = body;
    
    // Validate email
    if (!email || typeof email !== 'string') {
        return { isValid: false, message: 'Email is required' };
    }
    
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const cleanEmail = email.trim().toLowerCase();
    
    if (!emailRegex.test(cleanEmail)) {
        return { isValid: false, message: 'Invalid email format' };
    }
    
    // Validate consent
    if (!consent) {
        return { isValid: false, message: 'Consent is required' };
    }
    
    // Sanitize name
    const cleanName = name ? stripHtml(name.trim()).substring(0, 100) : null;
    
    return {
        isValid: true,
        data: {
            name: cleanName,
            email: cleanEmail,
            consent: Boolean(consent),
            timestamp: timestamp || new Date().toISOString(),
            userAgent: userAgent ? stripHtml(userAgent.substring(0, 500)) : null,
            referrer: referrer ? stripHtml(referrer.substring(0, 500)) : null
        }
    };
}

/**
 * Strip HTML tags from string
 */
function stripHtml(str) {
    return str.replace(/<[^>]*>/g, '');
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Store signup data with file locking
 */
async function storeSignup(signup) {
    if (config.storageMode === 'json') {
        await storeInJsonFile(signup);
    } else {
        console.log('Storage mode not implemented:', config.storageMode);
        console.log('Signup data:', signup);
    }
}

/**
 * Store signup in JSON file with basic locking
 */
async function storeInJsonFile(signup) {
    const filePath = path.join(config.dataDir, 'signups.json');
    const lockPath = path.join(config.dataDir, 'signups.lock');
    
    // Simple file locking mechanism
    let lockAcquired = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!lockAcquired && attempts < maxAttempts) {
        try {
            // Try to create lock file
            await fs.writeFile(lockPath, process.pid.toString(), { flag: 'wx' });
            lockAcquired = true;
        } catch (error) {
            // Lock file exists, wait and retry
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    if (!lockAcquired) {
        throw new Error('Could not acquire file lock');
    }
    
    try {
        // Ensure data directory exists
        await fs.mkdir(config.dataDir, { recursive: true });
        
        // Read existing data
        let signups = [];
        try {
            const data = await fs.readFile(filePath, 'utf8');
            signups = JSON.parse(data);
        } catch (error) {
            // File doesn't exist or is invalid, start with empty array
        }
        
        // Add new signup
        signups.push(signup);
        
        // Write back to file
        await fs.writeFile(filePath, JSON.stringify(signups, null, 2));
        
        console.log('Signup stored successfully:', signup.email);
    } finally {
        // Release lock
        try {
            await fs.unlink(lockPath);
        } catch (error) {
            console.error('Error releasing lock:', error);
        }
    }
}

/**
 * Get all signups
 */
async function getSignups() {
    const filePath = path.join(config.dataDir, 'signups.json');
    
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

/**
 * Send notification email to admin
 */
async function sendNotificationEmail(signup) {
    const subject = `New REVANX Signup: ${signup.email}`;
    const html = `
        <h2>New Coming Soon Page Signup</h2>
        <p><strong>Email:</strong> ${signup.email}</p>
        ${signup.name ? `<p><strong>Name:</strong> ${signup.name}</p>` : ''}
        <p><strong>Timestamp:</strong> ${signup.timestamp}</p>
        <p><strong>IP Address:</strong> ${signup.ip}</p>
        <p><strong>User Agent:</strong> ${signup.userAgent || 'Not provided'}</p>
        <p><strong>Referrer:</strong> ${signup.referrer || 'Direct'}</p>
        <p><strong>Consent:</strong> ${signup.consent ? 'Yes' : 'No'}</p>
        
        <hr>
        <p><small>This email was sent automatically from the REVANX coming soon page.</small></p>
    `;
    
    await sendEmail({
        to: config.emailTo,
        subject,
        html
    });
}

/**
 * Send confirmation email to user
 */
async function sendConfirmationEmail(signup) {
    const subject = 'Welcome to REVANX - You\'re on the list!';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #667eea;">Welcome to REVANX!</h1>
            
            <p>Hi${signup.name ? ` ${signup.name}` : ''},</p>
            
            <p>Thank you for signing up for updates about REVANX! We're excited to have you on board.</p>
            
            <p>We're working hard to bring you something amazing, and you'll be among the first to know when we launch.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">What's Next?</h3>
                <ul>
                    <li>We'll keep you updated on our progress</li>
                    <li>You'll get early access when we launch</li>
                    <li>Exclusive updates and behind-the-scenes content</li>
                </ul>
            </div>
            
            <p>Stay tuned!</p>
            
            <p>Best regards,<br>The REVANX Team</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
                You received this email because you signed up for updates at our coming soon page.
                If you didn't sign up, you can safely ignore this email.
            </p>
        </div>
    `;
    
    await sendEmail({
        to: signup.email,
        subject,
        html
    });
}

/**
 * Send email using configured provider
 */
async function sendEmail({ to, subject, html }) {
    if (config.isDryRun) {
        console.log('DRY RUN - Email would be sent:');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('HTML:', html.substring(0, 200) + '...');
        return;
    }
    
    try {
        if (config.emailProvider === 'resend') {
            await sendWithResend({ to, subject, html });
        } else {
            throw new Error(`Email provider not implemented: ${config.emailProvider}`);
        }
    } catch (error) {
        console.error('Email sending error:', error);
        // Don't throw - we don't want to fail the signup if email fails
    }
}

/**
 * Send email with Resend
 */
async function sendWithResend({ to, subject, html }) {
    const resend = new Resend(config.emailApiKey);
    
    const result = await resend.emails.send({
        from: config.emailFrom,
        to,
        subject,
        html
    });
    
    console.log('Email sent via Resend:', result);
    return result;
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

/**
 * Start server
 */
app.listen(PORT, () => {
    console.log(`REVANX Coming Soon Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Dry run mode: ${config.isDryRun}`);
    
    if (config.isDryRun) {
        console.log('⚠️  EMAIL_API_KEY not set - running in dry-run mode');
        console.log('   Emails will be logged to console instead of sent');
    }
});

module.exports = app;
