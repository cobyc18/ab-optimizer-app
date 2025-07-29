# A/B Optimizer Shopify App

A complete Shopify standalone application with OAuth authentication, webhook management, and A/B testing capabilities. This app allows merchants to install your Shopify app and be redirected to a standalone web application hosted on your own infrastructure.

## Features

- 🔐 **OAuth 2.0 Authentication** - Secure Shopify app installation flow
- 📊 **A/B Testing** - Create and manage A/B tests for products
- 🔔 **Webhook Management** - Monitor and manage webhook events
- 🏪 **Shop Management** - View and manage connected Shopify stores
- 📱 **Responsive UI** - Modern React frontend with Polaris
- 🗄️ **Database Integration** - PostgreSQL with Prisma ORM
- 🔒 **Security** - HMAC verification, rate limiting, and session management
- 📈 **Real-time Analytics** - Track A/B test performance and conversions

## Tech Stack

### Backend
- **Node.js** with Remix
- **PostgreSQL** with Prisma ORM
- **Shopify App Bridge** for authentication
- **Axios** for HTTP requests
- **Security** headers and CORS protection

### Frontend
- **React 18** with Remix
- **Shopify Polaris** for UI components
- **Shopify App Bridge** for app integration
- **Modern CSS** for styling

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL database (local or cloud)
- Shopify Partner account
- Domain name for your app

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd ab-optimizer-app
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your variables:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Shopify App Configuration
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_SCOPES=write_products,read_themes,write_themes,write_app_proxy,read_orders,write_orders,read_products

# App URLs
SHOPIFY_APP_URL=https://your-app-domain.com

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/ab_optimizer_db
```

### 3. Database Setup

Ensure PostgreSQL is running and accessible. Run the following commands to set up the database:

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Set up initial data
npm run setup
```

### 4. Start Development Server

```bash
# Start the development server
shopify app dev
```

The app will be available at the URL provided by Shopify CLI.

## Deployment

### Render.com Deployment

1. **Create Render Account** at [render.com](https://render.com)
2. **Connect GitHub Repository**
3. **Create Web Service** with these settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. **Add Environment Variables** in Render dashboard
5. **Deploy** and get your app URL

### Update Shopify App URLs

Once deployed, update your `shopify.app.toml` with the actual Render URL:

```toml
application_url = "https://your-app-name.onrender.com"
redirect_urls = ["https://your-app-name.onrender.com/auth/callback"]
url = "https://your-app-name.onrender.com"
```

## API Endpoints

### Authentication
- `GET /auth/callback` - Handle OAuth callback

### App Routes
- `GET /app` - Main app dashboard
- `GET /app/additional` - Additional page
- `GET /app/ab-testing` - A/B testing interface
- `GET /app/ab-analytics` - A/B test analytics

### Webhooks
- `POST /webhooks/app/uninstalled` - Handle app uninstall
- `POST /webhooks/app/scopes_update` - Handle scope updates

## Database Schema

The app uses PostgreSQL with the following main tables:
- `Session` - Shopify session management
- `ABTest` - A/B test configurations
- `ABEvent` - A/B test events and conversions
- `WidgetConfig` - Widget configurations

## Security Features

- **HMAC Verification** - All webhook requests are verified
- **Session Management** - Secure session handling
- **Input Validation** - All inputs are validated
- **Error Handling** - Comprehensive error handling

## Customization

### Adding New Features

1. **New Routes:** Add routes in the `app/routes/` directory
2. **New Components:** Create React components in `app/routes/`
3. **Database Models:** Add models to `prisma/schema.prisma`
4. **Styling:** Use Polaris components or custom CSS

## Troubleshooting

### Common Issues

1. **OAuth Redirect Error**
   - Verify redirect URI in Shopify Partner Dashboard
   - Check environment variables

2. **Database Connection**
   - Ensure PostgreSQL is running
   - Check connection string in `.env`
   - Run `npm run db:generate` and `npm run db:push`

3. **Build Errors**
   - Check Node.js version (16+ required)
   - Verify all dependencies are installed
   - Check for TypeScript errors

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review Shopify's developer documentation
