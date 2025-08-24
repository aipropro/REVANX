# REVANX Coming Soon Page

A modern, responsive coming soon landing page with email subscription functionality. Built with vanilla HTML, CSS, and JavaScript, with serverless backend options for Vercel and Netlify.

## Features

- ✨ **Modern Design**: Clean, responsive design with gradient backgrounds and smooth animations
- 📧 **Email Subscription**: Collect email signups with consent management
- 🔒 **Privacy Compliant**: GDPR-friendly consent handling with privacy policy links
- ♿ **Accessible**: WCAG compliant with proper ARIA labels and keyboard navigation
- 📱 **Responsive**: Mobile-first design that works on all devices
- 🚀 **Serverless Ready**: Deploy to Vercel or Netlify with zero configuration
- 📊 **Analytics**: Built-in event tracking (console-based, easily extensible)
- 🛡️ **Security**: Rate limiting, input validation, and XSS protection
- 📨 **Email Notifications**: Automatic admin notifications and user confirmations
- 💾 **Data Storage**: JSON file storage with file locking (Express) or cloud storage options

## Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd revanx-coming-soon
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```env
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your_resend_api_key_here
EMAIL_FROM=noreply@yourdomain.com
EMAIL_TO=hello@yourdomain.com
```

### 3. Run Locally

**Option A: Static Files (Recommended for development)**
```bash
# Serve static files (no backend functionality)
python -m http.server 8000
# or
npx serve .
```

**Option B: Express Server**
```bash
npm run dev
```

Visit `http://localhost:8000` (static) or `http://localhost:3001` (Express)

## Deployment

### Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Set Environment Variables** in Vercel dashboard:
   - `EMAIL_PROVIDER=resend`
   - `EMAIL_API_KEY=your_resend_api_key`
   - `EMAIL_FROM=noreply@yourdomain.com`
   - `EMAIL_TO=hello@yourdomain.com`

4. **Custom Domain** (optional):
   - Add your domain in Vercel dashboard
   - Update DNS records as instructed

### Netlify

1. **Install Netlify CLI**:
   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

3. **Set Environment Variables** in Netlify dashboard:
   - Same variables as Vercel above

4. **Custom Domain** (optional):
   - Add domain in Netlify dashboard
   - Configure DNS as instructed

### Traditional Hosting (Express)

For VPS or traditional hosting:

```bash
# Install dependencies
npm install

# Set environment variables
export EMAIL_API_KEY=your_key_here
export EMAIL_FROM=noreply@yourdomain.com
export EMAIL_TO=hello@yourdomain.com

# Start server
npm start
```

Use a process manager like PM2 for production:

```bash
npm i -g pm2
pm2 start server.js --name revanx-coming-soon
```

## Email Providers

### Resend (Recommended)

1. Sign up at [resend.com](https://resend.com)
2. Create an API key
3. Verify your domain
4. Set environment variables:
   ```env
   EMAIL_PROVIDER=resend
   EMAIL_API_KEY=re_xxxxxxxxxx
   EMAIL_FROM=noreply@yourdomain.com
   ```

### SendGrid (Alternative)

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create an API key
3. Verify sender identity
4. Set environment variables:
   ```env
   EMAIL_PROVIDER=sendgrid
   EMAIL_API_KEY=SG.xxxxxxxxxx
   EMAIL_FROM=noreply@yourdomain.com
   ```

### Other Providers

The system is designed to support multiple email providers. Currently implemented:
- ✅ Resend
- 🚧 SendGrid (planned)
- 🚧 Mailgun (planned)
- 🚧 Amazon SES (planned)
- 🚧 SMTP (planned)

## Testing

### Test Email Sending

**Dry Run Mode** (no EMAIL_API_KEY set):
```bash
# Emails will be logged to console instead of sent
npm run dev
```

**Test with curl**:
```bash
curl -X POST http://localhost:3001/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "consent": true
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Successfully subscribed! Check your email for confirmation."
}
```

### Frontend Testing

1. Open the page in a browser
2. Try submitting the form with:
   - Invalid email formats
   - Missing consent checkbox
   - Valid data

3. Check browser console for analytics events:
   - `page_loaded`
   - `signup_submitted`
   - `signup_success`/`signup_error`
   - `link_click`

## File Structure

```
revanx-coming-soon/
├── index.html              # Main landing page
├── global.css              # Base styles and resets
├── index.css               # Page-specific styles
├── js/
│   └── main.js             # Client-side JavaScript
├── api/
│   └── subscribe.js        # Vercel serverless function
├── netlify/
│   └── functions/
│       └── subscribe.js    # Netlify function
├── server.js               # Express server (fallback)
├── package.json            # Dependencies and scripts
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_PROVIDER` | No | `resend` | Email service provider |
| `EMAIL_API_KEY` | Yes* | - | API key for email provider |
| `EMAIL_FROM` | No | `noreply@revanx.com` | Sender email address |
| `EMAIL_TO` | No | `hello@revanx.com` | Admin notification email |
| `STORAGE_MODE` | No | `json` | Data storage method |
| `PORT` | No | `3001` | Server port (Express only) |

*Required for production. If not set, runs in dry-run mode.

### Customization

**Branding**:
- Update `REVANX` in `index.html` to your brand name
- Modify colors in `index.css` (search for `#667eea`, `#764ba2`)
- Replace social media links in footer
- Update meta tags and title

**Content**:
- Hero title and subtitle in `index.html`
- Feature cards content
- Email templates in backend files
- Privacy policy and terms links

**Styling**:
- Modify CSS custom properties in `global.css`
- Adjust responsive breakpoints in `index.css`
- Update gradient backgrounds and animations

## Privacy & GDPR Compliance

### Data Collection
- **Email addresses**: Required for subscription
- **Names**: Optional, user-provided
- **IP addresses**: Collected for rate limiting (masked in admin view)
- **User agents**: Collected for analytics
- **Timestamps**: Collected for record keeping

### Consent Management
- ✅ Explicit consent required via checkbox
- ✅ Unchecked by default
- ✅ Clear privacy policy link
- ✅ Purpose clearly stated
- ✅ Easy to understand language

### Data Rights
Users have the right to:
- **Access**: View their stored data
- **Rectification**: Correct inaccurate data
- **Erasure**: Request data deletion
- **Portability**: Export their data

### Data Deletion
To delete user data:

**Serverless (JSON storage)**:
```bash
# Manually edit the JSON file to remove entries
# Or implement an admin endpoint
```

**Express server**:
```bash
# Access admin endpoint (implement authentication first)
curl -X DELETE http://localhost:3001/admin/signups/email@example.com
```

## Security Features

- 🛡️ **Rate Limiting**: 5 requests per 15 minutes per IP
- 🔒 **Input Validation**: Server-side email and data validation
- 🚫 **XSS Protection**: HTML stripping and sanitization
- 🔐 **CORS**: Configurable cross-origin policies
- 📝 **Logging**: Security events and errors logged
- 🎯 **Minimal Attack Surface**: No database, minimal dependencies

## Analytics Events

The system logs the following events to console:

```javascript
// Page loaded
{ event: 'page_loaded', page: 'coming_soon' }

// Form submitted
{ event: 'signup_submitted', hasName: true, email: 'te***@example.com' }

// Successful signup
{ event: 'signup_success', email: 'te***@example.com' }

// Signup error
{ event: 'signup_error', error: 'validation_failed', fields: ['email'] }

// Link clicked
{ event: 'link_click', type: 'social', platform: 'twitter', href: '...' }
```

To integrate with external analytics:
1. Modify `logAnalyticsEvent()` in `js/main.js`
2. Add your analytics SDK
3. Send events to your preferred service

## Troubleshooting

### Common Issues

**Emails not sending**:
- Check `EMAIL_API_KEY` is set correctly
- Verify domain is configured with email provider
- Check server logs for error messages
- Test in dry-run mode first

**Form not submitting**:
- Check browser console for JavaScript errors
- Verify backend endpoint is accessible
- Check network tab for failed requests
- Ensure CORS is configured correctly

**Styling issues**:
- Clear browser cache
- Check for CSS syntax errors
- Verify file paths are correct
- Test in different browsers

**Rate limiting triggered**:
- Wait 15 minutes and try again
- Check if IP is correct in logs
- Adjust rate limits in backend code

### Debug Mode

Enable debug logging:

```javascript
// In js/main.js, add:
window.DEBUG = true;

// In backend files, add:
console.log('Debug:', ...);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- 📧 Email: hello@revanx.com
- 🐛 Issues: GitHub Issues
- 📖 Docs: This README

---

Built with ❤️ by the REVANX Team
