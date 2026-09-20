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

// External Account Deletion Page
app.get('/delete-account', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delete Account | New Raj Fancy Store</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet">
    <style>
        :root {
            --gold-primary: #d4af37;
            --gold-dark: #b59223;
            --bg-cream: #fffaf0;
            --text-dark: #1a1a1a;
            --text-muted: #5a5a5a;
            --white: #ffffff;
            --shadow-premium: 0 20px 40px rgba(0, 0, 0, 0.06);
            --danger: #e53e3e;
            --danger-hover: #c53030;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Outfit', sans-serif;
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
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            border: 1px solid rgba(212, 175, 55, 0.2);
            box-shadow: var(--shadow-premium);
            padding: 32px;
        }

        .brand-header {
            text-align: center;
            margin-bottom: 24px;
        }

        .brand-title {
            font-family: 'Playfair Display', serif;
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--text-dark);
            text-transform: uppercase;
        }

        h2 {
            font-size: 1.4rem;
            margin-bottom: 12px;
            text-align: center;
            color: var(--danger);
        }

        p {
            font-size: 0.95rem;
            color: var(--text-muted);
            margin-bottom: 20px;
            text-align: center;
            line-height: 1.5;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 0.9rem;
        }

        input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 1rem;
            outline: none;
            transition: border-color 0.2s;
            font-family: 'Outfit', sans-serif;
        }

        input:focus {
            border-color: var(--gold-primary);
        }

        .btn {
            width: 100%;
            padding: 14px;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 700;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            font-family: 'Outfit', sans-serif;
        }

        .btn-primary {
            background: var(--gold-primary);
            color: var(--white);
        }

        .btn-primary:hover {
            background: var(--gold-dark);
        }

        .btn-danger {
            background: var(--danger);
            color: var(--white);
        }

        .btn-danger:hover {
            background: var(--danger-hover);
        }

        #otp-step, #success-step {
            display: none;
        }

        .error-msg {
            color: var(--danger);
            font-size: 0.85rem;
            margin-top: 8px;
            display: none;
            text-align: center;
        }

        .success-icon {
            font-size: 48px;
            text-align: center;
            color: #38a169;
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="brand-header">
            <h1 class="brand-title">New Raj Fancy</h1>
        </div>

        <!-- Step 1: Request OTP -->
        <div id="email-step">
            <h2>Delete Your Account</h2>
            <p>Enter your registered email address. We will send an OTP to verify your request.</p>
            
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" placeholder="e.g. yourname@email.com" required>
            </div>
            
            <button class="btn btn-danger" onclick="requestOtp()">Send Verification OTP</button>
            <div id="email-error" class="error-msg"></div>
        </div>

        <!-- Step 2: Verify OTP & Delete -->
        <div id="otp-step">
            <h2>Verify Request</h2>
            <p>An OTP has been sent to your email. Enter it below to permanently delete your account.</p>
            
            <div class="form-group">
                <label for="otp">Enter 6-digit OTP</label>
                <input type="text" id="otp" placeholder="XXXXXX" maxlength="6" required>
            </div>
            
            <button class="btn btn-danger" onclick="verifyAndDelete()">Confirm Deletion</button>
            <div id="otp-error" class="error-msg"></div>
        </div>

        <!-- Step 3: Success -->
        <div id="success-step">
            <div class="success-icon">✓</div>
            <h2>Account Deleted</h2>
            <p>Your account has been successfully deleted. Your personal data has been removed and order history anonymized as per our privacy policy.</p>
        </div>
    </div>

    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
    <script>
        // Initialize Firebase
        const firebaseConfig = {
            apiKey: "${process.env.FIREBASE_WEB_API_KEY || ''}",
            authDomain: "new-raj-fancy-store.firebaseapp.com",
            projectId: "new-raj-fancy-store"
        };
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // Action Code Settings for Firebase Email Link
        const actionCodeSettings = {
            url: window.location.href.split('?')[0], // The current URL without query params
            handleCodeInApp: true,
        };

        window.onload = async function() {
            // Check if user is returning from the email link
            if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
                let email = window.localStorage.getItem('emailForSignIn');
                
                // If missing, prompt user for email
                if (!email) {
                    email = window.prompt('Please provide your email for confirmation');
                }
                
                if (email) {
                    document.getElementById('email-step').style.display = 'none';
                    document.getElementById('otp-step').innerHTML = '<h2>Verifying Link...</h2><p>Please wait while we securely process your deletion request.</p><div id="otp-error" class="error-msg"></div>';
                    document.getElementById('otp-step').style.display = 'block';
                    
                    const errorDiv = document.getElementById('otp-error');
                    
                    try {
                        // Sign in with the email link
                        const result = await firebase.auth().signInWithEmailLink(email, window.location.href);
                        
                        // Clear email from storage
                        window.localStorage.removeItem('emailForSignIn');
                        
                        // Get the ID Token
                        const idToken = await result.user.getIdToken();
                        
                        // Send ID Token to our backend
                        const response = await fetch('/api/users/public-delete-verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token: idToken })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            document.getElementById('otp-step').style.display = 'none';
                            document.getElementById('success-step').style.display = 'block';
                        } else {
                            errorDiv.innerText = data.message || 'Account deletion failed.';
                            errorDiv.style.display = 'block';
                        }
                    } catch (err) {
                        console.error(err);
                        errorDiv.innerText = err.message || 'Error signing in with email link. The link may have expired.';
                        errorDiv.style.display = 'block';
                    }
                }
            }
        };

        async function requestOtp() {
            const emailInput = document.getElementById('email').value.trim();
            const errorDiv = document.getElementById('email-error');
            errorDiv.style.display = 'none';

            if (!emailInput || !emailInput.includes('@')) {
                errorDiv.innerText = 'Please enter a valid email address.';
                errorDiv.style.display = 'block';
                return;
            }

            try {
                // Save email to localStorage so it can be retrieved after clicking the link
                window.localStorage.setItem('emailForSignIn', emailInput);
                
                // Send the email link using Firebase Client SDK
                await firebase.auth().sendSignInLinkToEmail(emailInput, actionCodeSettings);
                
                // The frontend handled sending the email, so we don't strictly need to hit the backend OTP endpoint.
                // But if the backend relies on recording the intent or preventing spam, we could call it here.
                
                document.getElementById('email-step').style.display = 'none';
                document.getElementById('otp-step').innerHTML = '<h2>Check Your Email</h2><p>A secure verification link has been sent to your email. Click the link to permanently delete your account.</p><p>You can close this tab.</p>';
                document.getElementById('otp-step').style.display = 'block';

            } catch (err) {
                console.error(err);
                if (err.code === 'auth/operation-not-allowed') {
                    errorDiv.innerText = 'Email link authentication is disabled. Please enable it in Firebase Console.';
                } else {
                    errorDiv.innerText = 'Failed to send verification email. Please try again.';
                }
                errorDiv.style.display = 'block';
            }
        }
    </script>
</body>
</html>
  `);
});

// Privacy Policy Page
app.get('/privacy-policy', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy | New Raj Fancy Store</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --gold-primary: #d4af37;
            --bg-cream: #fffaf0;
            --text-dark: #1a1a1a;
            --text-muted: #4B5563;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Outfit', sans-serif;
            background: #F8F9FA;
            color: var(--text-dark);
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 40px auto;
            background: #fff;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #E5E7EB; }
        .header h1 { font-family: 'Playfair Display', serif; font-size: 2rem; color: #4F46E5; margin-bottom: 10px; }
        .subtitle { color: var(--text-muted); font-size: 0.95rem; }
        .section { margin-bottom: 30px; }
        .section h2 { font-size: 1.25rem; color: #111827; margin-bottom: 12px; display: flex; align-items: center; }
        .section h2 span { background: #EEF2FF; color: #4F46E5; width: 32px; height: 32px; border-radius: 16px; display: inline-flex; justify-content: center; align-items: center; margin-right: 12px; font-size: 1rem; }
        .section p, .section ul { color: var(--text-muted); margin-bottom: 12px; font-size: 1rem; }
        .section ul { padding-left: 20px; list-style-type: disc; }
        .section ul li { margin-bottom: 6px; }
        .btn-delete { display: inline-block; background: #fff5f5; color: #e53e3e; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; border: 1px solid #fed7d7; margin-top: 10px; }
        .btn-delete:hover { background: #fee2e2; }
        .contact { background: #EEF2FF; padding: 20px; border-radius: 12px; margin-top: 40px; }
        .contact strong { color: #4F46E5; }
        @media (max-width: 600px) {
            .container { margin: 0; border-radius: 0; padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Privacy Policy</h1>
            <p class="subtitle">Effective Date: September 20, 2026</p>
        </div>

        <div class="section">
            <h2><span>1</span> Information Collected</h2>
            <p>We collect the following personal and non-personal data to provide you with a safe, efficient, and customized experience:</p>
            <ul>
                <li>Name, phone number, and email address</li>
                <li>Shipping and billing address details</li>
                <li>Order history and payment transaction information</li>
                <li>Reseller bank/payment information (UPI, Bank Account)</li>
                <li>Profile/photo information (Avatars)</li>
                <li>Chat/messages and product reviews</li>
                <li>App activity (browsing/cart) and FCM/push notification tokens</li>
            </ul>
        </div>

        <div class="section">
            <h2><span>2</span> Usage of Data</h2>
            <p>We use your data strictly for order processing, product delivery, and customer support. With your explicit consent, we may send marketing communications and push notifications via FCM.</p>
        </div>

        <div class="section">
            <h2><span>3</span> Data Sharing</h2>
            <p>We only share your data with trusted third-party services that are essential to our operations:</p>
            <ul>
                <li><strong>Razorpay:</strong> For secure payment processing.</li>
                <li><strong>Shiprocket:</strong> For shipping logistics and delivery updates.</li>
                <li><strong>Firebase/FCM:</strong> For delivering push notifications.</li>
            </ul>
            <p>Data may also be shared with legal authorities if strictly required under applicable laws.</p>
        </div>

        <div class="section">
            <h2><span>4</span> Data Security</h2>
            <p>We implement industry-standard security practices and encryption protocols to protect your sensitive personal and financial data from unauthorized access, disclosure, or alteration.</p>
        </div>

        <div class="section">
            <h2><span>5</span> User Rights & Account Deletion</h2>
            <p>You may request access to your data, corrections, or complete deletion by using the 'Delete Account' feature in your app profile.</p>
            <ul>
                <li>If you delete your account, your personal data will be completely removed.</li>
                <li>Historical orders and transactions will be anonymized to maintain our financial referential integrity without identifying you.</li>
            </ul>
            <p>You can instantly request account deletion via our secure public portal without logging in:</p>
            <a href="https://newrajfancystore.adsngrow.in/delete-account" class="btn-delete">Request Account Deletion</a>
        </div>

        <div class="contact">
            <p><strong>Questions About Privacy?</strong></p>
            <p>Contact our privacy team directly at Newrajfancystore@gmail.com</p>
        </div>
    </div>
</body>
</html>
  `);
});

// Terms & Conditions Page
app.get('/terms-and-conditions', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms & Conditions | New Raj Fancy Store</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --gold-primary: #d4af37;
            --bg-cream: #fffaf0;
            --text-dark: #1a1a1a;
            --text-muted: #4B5563;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Outfit', sans-serif;
            background: #F8F9FA;
            color: var(--text-dark);
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 40px auto;
            background: #fff;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #E5E7EB; }
        .header h1 { font-family: 'Playfair Display', serif; font-size: 2rem; color: #4F46E5; margin-bottom: 10px; }
        .subtitle { color: var(--text-muted); font-size: 0.95rem; }
        .section { margin-bottom: 30px; }
        .section h2 { font-size: 1.25rem; color: #111827; margin-bottom: 12px; display: flex; align-items: center; }
        .section h2 span { background: #EEF2FF; color: #4F46E5; width: 32px; height: 32px; border-radius: 16px; display: inline-flex; justify-content: center; align-items: center; margin-right: 12px; font-size: 1rem; }
        .section p, .section ul { color: var(--text-muted); margin-bottom: 12px; font-size: 1rem; }
        .section ul { padding-left: 20px; list-style-type: disc; }
        .section ul li { margin-bottom: 6px; }
        .footer-note { background: #ECFDF5; color: #065F46; padding: 16px; border-radius: 12px; margin-top: 40px; font-size: 0.95rem; font-weight: 500; }
        @media (max-width: 600px) {
            .container { margin: 0; border-radius: 0; padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Terms & Conditions</h1>
            <p class="subtitle">Effective Date: September 20, 2026</p>
        </div>

        <div class="section">
            <h2><span>1</span> Business Information</h2>
            <p><strong>Business Name:</strong> New Raj Fancy<br>
            <strong>Address:</strong> Infront of Balaji Parisar, Beside Sai Astha Marriage Garden, Gotegaon, Narsinghpur, M.P 487118<br>
            <strong>Contact:</strong> 07649830348<br>
            <strong>Email:</strong> Newrajfancystore@gmail.com</p>
        </div>

        <div class="section">
            <h2><span>2</span> Use of Platform & Account Deletion</h2>
            <p>By accessing our platform, you agree to use it lawfully. You may request account deletion at any time. Upon deletion, your personal data is permanently removed. However, to maintain financial and legal compliance, your historical transaction and order records will be retained in an anonymized format.</p>
        </div>

        <div class="section">
            <h2><span>3</span> Product & Pricing</h2>
            <ul>
                <li>Prices are inclusive of GST as per Government regulations</li>
                <li>Product images are for representation purposes</li>
                <li>Prices are subject to change without prior notice based on market conditions</li>
            </ul>
        </div>

        <div class="section">
            <h2><span>4</span> Orders & Returns</h2>
            <p>Orders are confirmed after successful payment verification. We offer a <strong>7-day return window</strong> from the date of delivery. Return requests must be made within this timeframe. Refunds for approved returns will be credited according to your original payment method or wallet.</p>
        </div>

        <div class="section">
            <h2><span>5</span> Reseller Terms</h2>
            <ul>
                <li>Resellers can sell products using our catalog without holding physical inventory</li>
                <li>Profit margins are set by resellers at their own discretion</li>
                <li>New Raj Fancy is not responsible for reseller customer communication or pricing differences</li>
                <li>Misleading customers or making false commitments may lead to immediate account termination</li>
            </ul>
        </div>

        <div class="section">
            <h2><span>6</span> GST Compliance</h2>
            <ul>
                <li>GST will be applied as per Government of India regulations</li>
                <li>GST invoices will be provided upon request for business accounts</li>
                <li>Resellers are solely responsible for their own GST compliance if selling independently</li>
            </ul>
        </div>

        <div class="section">
            <h2><span>7</span> Intellectual Property</h2>
            <p>All logos, images, product descriptions, and application content belong to New Raj Fancy. Unauthorized reuse, reproduction, or distribution is strictly prohibited without explicit permission.</p>
        </div>

        <div class="section">
            <h2><span>8</span> Limitation of Liability</h2>
            <p>New Raj Fancy is not liable for indirect damages, delivery delays caused by third-party logistics, or business losses caused by platform downtime or third-party service interruptions.</p>
        </div>

        <div class="footer-note">
            By using New Raj Fancy, you acknowledge that you have read and understood these terms.
        </div>
    </div>
</body>
</html>
  `);
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