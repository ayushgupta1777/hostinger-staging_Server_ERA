// ============================================
// backend/routes/productRoutes.js
// UPDATED - With Subcategory Support
// ============================================
import express from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getVendorProducts,
  getSubcategoriesByParent
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/auth.js';
import { productValidation, validate } from '../middleware/validation.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/:id', getProduct);

// Get subcategories by parent category
router.get('/categories/:parentId/subcategories', getSubcategoriesByParent);

// Protected vendor routes
router.post('/', 
  protect, 
  authorize('vendor', 'admin'), 
  productValidation, 
  validate, 
  createProduct
);

router.put('/:id', 
  protect, 
  authorize('vendor', 'admin'), 
  updateProduct
);

router.delete('/:id', 
  protect, 
  authorize('vendor', 'admin'), 
  deleteProduct
);

router.get('/vendor/my-products', 
  protect, 
  authorize('vendor'), 
  getVendorProducts
);

// Image upload route
router.post('/:id/images', 
  protect, 
  authorize('vendor', 'admin'), 
  upload.array('images', 5), 
  async (req, res) => {
    try {
      const imageUrls = req.files.map(file => `/uploads/${file.filename}`);
      res.json({
        success: true,
        data: { images: imageUrls }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

export default router;