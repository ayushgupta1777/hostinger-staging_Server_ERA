import 'dotenv/config';
import express from 'express';
import cors from 'cors';
// import dotenv from 'dotenv';

import helmet from 'helmet';
import morgan from 'morgan';
import connectDB from './config/database.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';

import Product from './models/Product.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import resellerRoutes from './routes/resellerRoutes.js';
// import walletRoutes from './routes/walletRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import chatRoutes from './routes/chatRoutes.js'; // NEW: Chat routes
import aiAssistantRoutes from './routes/aiAssistantRoutes.js'; // AI ASSISTANT FEATURE
import adminResellerRoutes from './routes/adminResellerRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import shiprocketRoutes from './routes/shiprocketRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

import paymentRoutes from './routes/paymentRoutes.js';

import bannerRoutes from './routes/bannerRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import adminProductRoutes from './routes/adminProductRoutes.js';
import couponRoutes from './routes/couponRoutes.js';

import wishlistRoutes from './routes/wishlistRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import appSettingRoutes from './routes/appSettingRoutes.js';

import developerRoutes from './routes/developerRoutes.js';


// dotenv.config();
// Initialize express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
})); // Security headers
// CORS Configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['*'] // Allow all in production (for mobile apps)
  : [process.env.CLIENT_URL, process.env.ADMIN_URL]; // Specific in development

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? '*' : allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve uploaded files
// Explicitly allow cross-origin access for static files
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads') || req.path.startsWith('/temp') || req.path.startsWith('/products') || req.path.startsWith('/users') || req.path.startsWith('/banners') || req.path.startsWith('/categories') || req.path.startsWith('/logos')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  next();
});

app.use('/uploads', express.static('/root/uploads'));
app.use('/uploads/temp', express.static('/root/uploads/temp'));
app.use('/uploads/products', express.static('/root/uploads/products'));
app.use('/uploads/banners', express.static('/root/uploads/banners'));
app.use('/uploads/categories', express.static('/root/uploads/categories'));
app.use('/uploads/logos', express.static('/root/uploads/logos'));

// Support direct access (as seen in PM2 logs)
app.use('/temp', express.static('/root/uploads/temp'));
app.use('/products', express.static('/root/uploads/products'));
app.use('/users', express.static('/root/uploads/users'));
app.use('/banners', express.static('/root/uploads/banners'));
app.use('/categories', express.static('/root/uploads/categories'));
app.use('/logos', express.static('/root/uploads/logos'));

// Deep Linking Verification
app.use('/.well-known', express.static('.well-known', {
  setHeaders: (res, path) => {
    if (path.endsWith('apple-app-site-association') || path.endsWith('assetlinks.json')) {
      res.set('Content-Type', 'application/json');
    }
  }
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reseller', resellerRoutes);
// app.use('/api/wallet', walletRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use(
  '/api/webhooks',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

app.use('/api/categories', categoryRoutes);
app.use('/api/chat', chatRoutes); // NEW: Chat API mount
app.use('/api/ai-assistant', aiAssistantRoutes); // AI ASSISTANT FEATURE
app.use('/api/admin/resellers', adminResellerRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/shiprocket', shiprocketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dev', developerRoutes);

app.use('/api/banners', bannerRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/coupons', couponRoutes);


app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/settings', appSettingRoutes);


// console.log('🔑 Razorpay Key:', process.env.RAZORPAY_KEY_ID);


// Product Landing Page (Dynamic fallback for browser/deep links)
app.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    // 1. Fetch product
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send(`
        <div style="text-align: center; padding: 50px; font-family: sans-serif;">
          <h1>Product Not Found</h1>
          <p>We couldn't find the product you're looking for.</p>
          <a href="/" style="color: #d4af37; text-decoration: none; font-weight: bold;">Return to Home</a>
        </div>
      `);
    }

    // 2. Prepare metadata
    const title = product.title || 'Product';
    const description = product.description || 'View this product on New Raj Fancy Store';

    // Improved Image URL logic
    let firstImage = 'https://newrajfancystore.adsngrow.in/logo.png';
    if (product.images && product.images.length > 0) {
      let imgPath = product.images[0];
      if (imgPath.startsWith('http')) {
        firstImage = imgPath;
      } else {
        // Consistently remove ALL leading slashes
        while (imgPath.startsWith('/')) {
          imgPath = imgPath.substring(1);
        }
        // If it already includes 'uploads/', it's a full relative path
        if (imgPath.startsWith('uploads/')) {
          firstImage = `https://newrajfancystore.adsngrow.in/${imgPath}`;
        } else if (imgPath.startsWith('temp-')) {
          firstImage = `https://newrajfancystore.adsngrow.in/temp/${imgPath}`;
        } else {
          // Default to /products/ if it's just a filename
          firstImage = `https://newrajfancystore.adsngrow.in/products/${imgPath}`;
        }
      }
    }
    console.log(`Generated firstImage for product ${productId}: ${firstImage}`);

    const price = product.price ? `₹${product.price}` : '';
    const mrp = product.mrp ? `₹${product.mrp}` : '';
    const discount = (product.mrp && product.price && product.mrp > product.price)
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;
    const productUrl = `https://newrajfancystore.adsngrow.in/product/${productId}`;
    const appDeepLink = `rajfancy://product/${productId}`;

    // 3. Render Landing Page
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | New Raj Fancy Store</title>
    
    <!-- Open Graph (WhatsApp, Telegram, FB) -->
    <meta property="og:title" content="${title} - ${price}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${firstImage}">
    <meta property="og:url" content="${productUrl}">
    <meta property="og:type" content="product">
    
    <!-- Smart Banner for iOS -->
    <meta name="apple-itunes-app" content="app-id=com.mobile, app-argument=${appDeepLink}">

    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">

    <style>
        :root {
            --gold-primary: #d4af37;
            --gold-light: #f2d06b;
            --gold-dark: #b59223;
            --bg-cream: #fffaf0;
            --text-dark: #1a1a1a;
            --text-muted: #5a5a5a;
            --white: #ffffff;
            --shadow-premium: 0 20px 40px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(212, 175, 55, 0.15);
            --gold-gradient: linear-gradient(135deg, #d4af37 0%, #f2d06b 100%);
            --transition-smooth: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Outfit', -apple-system, sans-serif;
            background: linear-gradient(135deg, var(--bg-cream) 0%, #ffffff 100%);
            color: var(--text-dark);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 24px;
        }

        .container {
            width: 100%;
            max-width: 450px;
            animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: translateY(20px);
        }

        .brand-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 24px;
            gap: 4px;
        }

        .brand-title {
            font-family: 'Playfair Display', serif;
            font-size: 1.8rem;
            font-weight: 700;
            letter-spacing: 2.5px;
            color: var(--text-dark);
            text-transform: uppercase;
        }

        .card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 24px;
            border: 1px solid rgba(212, 175, 55, 0.2);
            box-shadow: var(--shadow-premium);
            padding: 24px;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .image-wrapper {
            position: relative;
            width: 100%;
            aspect-ratio: 1;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid rgba(212, 175, 55, 0.1);
        }

        .product-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: var(--transition-smooth);
        }

        .image-wrapper:hover .product-img {
            transform: scale(1.05);
        }

        .discount-badge {
            position: absolute;
            top: 12px;
            right: 12px;
            background: var(--gold-gradient);
            color: var(--white);
            font-weight: 700;
            font-size: 0.75rem;
            padding: 6px 12px;
            border-radius: 100px;
            box-shadow: 0 4px 10px rgba(212, 175, 55, 0.3);
            letter-spacing: 0.5px;
        }

        .product-title {
            font-size: 1.35rem;
            font-weight: 700;
            color: var(--text-dark);
            line-height: 1.4;
            margin-top: 8px;
            padding: 0 8px;
        }

        .price-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 4px;
        }

        .price-current {
            font-size: 1.75rem;
            font-weight: 800;
            color: var(--gold-dark);
        }

        .price-mrp {
            font-size: 1.1rem;
            color: var(--text-muted);
            text-decoration: line-through;
            opacity: 0.65;
        }

        .product-desc {
            font-size: 0.9rem;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 12px;
            padding: 0 12px;
        }

        .actions {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 8px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 16px 28px;
            border-radius: 14px;
            font-size: 1rem;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
            transition: var(--transition-smooth);
        }

        .btn-primary {
            background: var(--gold-gradient);
            color: var(--white);
            box-shadow: 0 10px 20px rgba(212, 175, 55, 0.25);
            border: none;
            position: relative;
            overflow: hidden;
        }

        .btn-primary::after {
            content: '';
            position: absolute;
            top: 0;
            left: -50%;
            width: 200%;
            height: 100%;
            background: linear-gradient(
                to right,
                rgba(255, 255, 255, 0) 0%,
                rgba(255, 255, 255, 0.3) 50%,
                rgba(255, 255, 255, 0) 100%
            );
            transform: skewX(-25deg);
            transition: 0.75s;
            opacity: 0;
        }

        .btn-primary:hover::after {
            left: 125%;
            opacity: 1;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 28px rgba(212, 175, 55, 0.35);
        }

        .btn-primary:active {
            transform: translateY(1px);
        }

        .btn-secondary {
            background: transparent;
            color: var(--gold-dark);
            border: 2px solid var(--gold-primary);
        }

        .btn-secondary:hover {
            background: rgba(212, 175, 55, 0.08);
            transform: translateY(-2px);
        }

        .btn-secondary:active {
            transform: translateY(1px);
        }

        .footer-logo {
            font-family: 'Playfair Display', serif;
            font-size: 0.75rem;
            letter-spacing: 2px;
            opacity: 0.4;
            text-transform: uppercase;
            margin-top: 16px;
            color: var(--text-dark);
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @media (max-width: 480px) {
            body {
                padding: 16px;
            }
            .card {
                padding: 20px;
                border-radius: 20px;
            }
            .product-title {
                font-size: 1.2rem;
            }
            .price-current {
                font-size: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="brand-header">
            <h1 class="brand-title">New Raj Fancy</h1>
        </div>

        <div class="card">
            <div class="image-wrapper">
                <img src="${firstImage}" class="product-img" alt="${title}">
                ${discount > 0 ? `<span class="discount-badge">${discount}% OFF</span>` : ''}
            </div>
            
            <h2 class="product-title">${title}</h2>
            
            <div class="price-container">
                <span class="price-current">${price}</span>
                ${mrp && mrp !== price ? `<span class="price-mrp">${mrp}</span>` : ''}
            </div>
            
            <p class="product-desc">${description.substring(0, 150)}${description.length > 150 ? '...' : ''}</p>
            
            <div class="actions">
                <a href="${appDeepLink}" class="btn btn-primary" id="open-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    Open in App
                </a>
                <a href="https://newrajfancy.adsngrow.in/" class="btn btn-secondary" id="download-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Download App
                </a>
            </div>
            
            <div class="footer-logo">New Raj Fancy Store</div>
        </div>
    </div>

    <script>
        const appDeepLink = "${appDeepLink}";
        const downloadUrl = "https://newrajfancy.adsngrow.in/";

        function getOS() {
            const userAgent = window.navigator.userAgent || window.navigator.vendor || window.opera;
            if (/android/i.test(userAgent)) {
                return "Android";
            }
            if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
                return "iOS";
            }
            return "Desktop";
        }

        // Attempt redirection to download page if the app fails to open
        function triggerFallback() {
            const start = Date.now();
            setTimeout(function() {
                const elapsed = Date.now() - start;
                // If the app opened, the tab went to background (hidden).
                // Do not redirect in that case.
                if (document.hidden || document.webkitHidden || elapsed > 2500) {
                    return;
                }
                window.location.href = downloadUrl;
            }, 2000);
        }

        // Attach click handler to "Open in App" button (no preventDefault to allow native custom scheme execution)
        document.getElementById('open-btn').addEventListener('click', function(event) {
            triggerFallback();
        });

        // Auto-redirect Attempt on page load for mobile users
        window.onload = function() {
            const os = getOS();
            if (os === "Android" || os === "iOS") {
                setTimeout(function() {
                    window.location.href = appDeepLink;
                }, 500);
            }
        };
    </script>
</body>
</html>
    `);
  } catch (error) {
    console.error('Landing page error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'E-Commerce Reseller API',
    version: '1.0.0',
    docs: '/api-docs'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

import { initSocket } from './utils/socket.js'; // NEW: Socket.io

// Start server
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

// Initialize Socket.io
initSocket(server);


// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;