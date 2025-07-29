# Shopify Standalone App

A complete Shopify standalone application with OAuth authentication, webhook management, and advanced analytics. This app allows merchants to install your Shopify app and be redirected to a standalone web application hosted on your own infrastructure.

## Features

- 🔐 **OAuth 2.0 Authentication** - Secure Shopify app installation flow
- 📊 **Advanced Analytics** - Real-time dashboard with charts and metrics
- 🔔 **Webhook Management** - Monitor and manage webhook events
- 🏪 **Shop Management** - View and manage connected Shopify stores
- 📱 **Responsive UI** - Modern React frontend with Tailwind CSS
- 🗄️ **Database Integration** - MongoDB with Mongoose ODM
- 🔒 **Security** - HMAC verification, rate limiting, and session management
- 📈 **Real-time Monitoring** - Track webhook success rates and performance

## Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** with Prisma ORM
- **JWT** for authentication
- **Axios** for HTTP requests
- **Helmet** for security headers
- **Rate limiting** and CORS protection

### Frontend
- **React 18** with React Router
- **React Query** for data fetching
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for icons
- **React Hook Form** for form handling

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL database (local or cloud)
- Shopify Partner account
- Domain name for your app

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd shopify-standalone-app
npm install
cd client && npm install
cd ..
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
SHOPIFY_SCOPES=read_orders,read_customers,read_products,write_script_tags,read_script_tags

# App URLs
APP_URL=https://your-app-domain.com
REDIRECT_URI=https://your-app-domain.com/auth/callback

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/shopify-app

# Session Configuration
SESSION_SECRET=your_session_secret_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here

# Webhook Configuration
WEBHOOK_SECRET=your_webhook_secret_here

# Environment
NODE_ENV=development
PORT=3001
```

### 3. Shopify Partner Setup

1. Go to your [Shopify Partner Dashboard](https://partners.shopify.com)
2. Create a new app
3. Set the **App URL** to your domain (e.g., `https://yourapp.com`)
4. Set the **Allowed redirection URL(s)** to `https://yourapp.com/auth/callback`
5. Copy the API key and secret to your `.env` file
6. Configure the required scopes for your app

### 4. Database Setup

Ensure PostgreSQL is running and accessible. Run the following commands to set up the database:

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (recommended for existing databases)
npm run db:push

# Or reset database (WARNING: This will delete all data)
npm run db:reset
```

**Note:** The app is configured to use the `ab_optimizer_db` database. Make sure this database exists in your PostgreSQL instance.

### 5. Start Development Servers

```bash
# Option 1: Start both backend and frontend together
npm run dev:full

# Option 2: Start them separately
# Terminal 1 - Backend server
npm run dev

# Terminal 2 - Frontend
cd client && npm start
```

The app will be available at:
- Backend API: http://localhost:3001
- Frontend: http://localhost:3000

## API Endpoints

### Authentication
- `GET /auth` - Initiate OAuth flow
- `GET /auth/callback` - Handle OAuth callback
- `POST /auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Shops
- `GET /api/shops` - List all shops
- `GET /api/shops/:shop` - Get shop details
- `GET /api/shops/:shop/orders` - Get shop orders
- `GET /api/shops/:shop/customers` - Get shop customers
- `GET /api/shops/:shop/products` - Get shop products
- `GET /api/shops/:shop/analytics` - Get shop analytics

### Webhooks
- `GET /api/webhooks` - List webhook events
- `GET /api/webhooks/stats/summary` - Get webhook statistics
- `POST /api/webhooks/:id/retry` - Retry failed webhook
- `POST /api/webhooks/cleanup` - Clean old webhook events

### Analytics
- `GET /api/analytics/dashboard` - Dashboard overview
- `GET /api/analytics/shops/performance` - Shop performance
- `GET /api/analytics/webhooks/topics` - Webhook topic analytics
- `GET /api/analytics/timeseries` - Time series data

## Deployment Options

### Free Hosting Providers

#### 1. **Render** (Recommended)
- Free tier with 750 hours/month
- Automatic deployments from Git
- Built-in PostgreSQL support
- Custom domains

**Setup:**
1. Connect your GitHub repo to Render
2. Create a new Web Service
3. Set build command: `npm install && cd client && npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables in Render dashboard

#### 2. **Railway**
- Free tier with $5 credit
- Easy deployment from GitHub
- Built-in database support
- Automatic HTTPS

#### 3. **Vercel** (Frontend only)
- Free tier with generous limits
- Perfect for React apps
- Automatic deployments
- Global CDN

#### 4. **Netlify** (Frontend only)
- Free tier with 100GB bandwidth
- Easy deployment
- Custom domains
- Form handling

### Production Deployment

#### Backend Deployment (Render/Railway)

1. **Environment Variables:**
   ```env
   NODE_ENV=production
   DATABASE_URL=postgresql://username:password@host:port/ab_optimizer_db
   SHOPIFY_API_KEY=your_production_api_key
   SHOPIFY_API_SECRET=your_production_api_secret
   APP_URL=https://your-app-domain.com
   REDIRECT_URI=https://your-app-domain.com/auth/callback
   ```

2. **Build Configuration:**
   - Build Command: `npm install && cd client && npm install && npm run build`
   - Start Command: `npm start`

#### Frontend Deployment (Vercel/Netlify)

1. **Environment Variables:**
   ```env
   REACT_APP_API_URL=https://your-backend-domain.com
   ```

2. **Build Settings:**
   - Build Command: `npm run build`
   - Output Directory: `build`

## Webhook Configuration

The app automatically handles these webhook topics:
- `orders/create`
- `orders/updated`
- `orders/cancelled`
- `customers/create`
- `customers/updated`
- `products/create`
- `products/updated`

To add more webhooks, modify the `server.js` file and add new webhook handlers.

## Security Features

- **HMAC Verification** - All webhook requests are verified
- **Rate Limiting** - Prevents abuse
- **CORS Protection** - Configurable cross-origin requests
- **Session Management** - Secure session handling
- **Input Validation** - All inputs are validated
- **Error Handling** - Comprehensive error handling

## Monitoring and Analytics

The app includes comprehensive monitoring:

- **Real-time Dashboard** - Live metrics and charts
- **Webhook Success Rates** - Track webhook delivery
- **Shop Performance** - Monitor individual store performance
- **Error Tracking** - Identify and resolve issues
- **User Activity** - Track user engagement

## Customization

### Adding New Features

1. **New API Routes:** Add routes in the `routes/` directory
2. **New Models:** Create models in the `models/` directory
3. **New Pages:** Add React components in `client/src/pages/`
4. **Styling:** Modify Tailwind classes or add custom CSS

### Theming

The app uses Tailwind CSS for styling. You can customize:
- Colors in `client/tailwind.config.js`
- Components in `client/src/index.css`
- Layout in `client/src/components/Layout.js`

## Troubleshooting

### Common Issues

1. **OAuth Redirect Error**
   - Verify redirect URI in Shopify Partner Dashboard
   - Check environment variables

2. **Database Connection**
   - Ensure PostgreSQL is running
   - Check connection string in `.env`
   - Run `npm run db:generate` and `npm run db:push`

3. **Webhook Failures**
   - Verify webhook URL is accessible
   - Check HMAC verification
   - Review webhook payload handling

4. **CORS Errors**
   - Update CORS configuration in `server.js`
   - Check frontend API URL

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=shopify-app:*
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review Shopify's developer documentation

## Changelog

### v1.0.0
- Initial release
- OAuth authentication
- Webhook management
- Analytics dashboard
- Shop management
- Responsive UI

---

**Note:** This is a production-ready Shopify standalone app. Make sure to test thoroughly in development before deploying to production.
