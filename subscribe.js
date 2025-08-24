/**
 * Netlify Function - Email Subscription Handler
 * Handles form submissions, sends emails, and stores signups
 */

const { Resend } = require('resend');
const fs = require('fs').promises;
const path = require('path');

// Rate limiting storage (in-memory for serverless)
const rateLimitMap = new Map();

// Configuration
const config = {
    emailProvider: process.env.EMAIL_PROVIDER || 'resend',
    emailApiKey: process.env.EMAIL_API_KEY,
    emailFrom: process.env.EMAIL_FROM || 'noreply@revanx.com',
    emailTo: process.env.EMAIL_TO || 'hello@revanx.com',
    storageMode: process.env.STORAGE_MODE || 'json',
    isDryRun: !process.env.EMAIL_API_KEY,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 5 // max 5 submissions per IP per window
};

/**
 * Main handler function
 */
exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Method not allowed'
            })
        };
    }
    
    try {
        // Get client IP for rate limiting
        const clientIP = getClientIP(event);
        
        // Check rate limit
        if (!checkRateLimit(clientIP)) {
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Too many requests. Please try again later.'
                })
            };
        }
        
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Invalid JSON in request body'
                })
            };
        }
        
        // Validate and sanitize input
        const validationResult = validateInput(body);
        if (!validationResult.isValid) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: validationResult.message
                })
            };
        }
        
        const { name, email, consent, timestamp, userAgent, referrer } = validationResult.data;
        
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
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Successfully subscribed! Check your email for confirmation.'
            })
        };
        
    } catch (error) {
        console.error('Subscription error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Internal server error. Please try again later.'
            })
        };
    }
};

/**
 * Get client IP address
 */
function getClientIP(event) {
    return event.headers['x-forwarded-for']?.split(',')[0] ||
           event.headers['x-real-ip'] ||
           event.headers['client-ip'] ||
           'unknown';
}

/**
 * Check rate limiting
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - config.rateLimitWindow;
    
    // Clean old entries
    for (const [key, timestamps] of rateLimitMap.entries()) {
        const validTimestamps = timestamps.filter(t => t > windowStart);
        if (validTimestamps.length === 0) {
            rateLimitMap.delete(key);
        } else {
            rateLimitMap.set(key, validTimestamps);
        }
    }
    
    // Check current IP
    const ipTimestamps = rateLimitMap.get(ip) || [];
    const recentRequests = ipTimestamps.filter(t => t > windowStart);
    
    if (recentRequests.length >= config.rateLimitMax) {
        return false;
    }
    
    // Add current request
    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);
    
    return true;
}

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
 * Store signup data
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
 * Store signup in JSON file
 */
async function storeInJsonFile(signup) {
    try {
        // For Netlify, we'll try to write to /tmp first, then fallback to logging
        const dataDir = '/tmp';
        const filePath = path.join(dataDir, 'signups.json');
        
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
    } catch (error) {
        console.error('Error storing signup, logging instead:', error);
        console.log('Signup data:', JSON.stringify(signup, null, 2));
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
