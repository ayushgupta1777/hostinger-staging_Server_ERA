import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus
} from '../controllers/adminProductController.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getAllProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.patch('/:id/toggle', toggleProductStatus);

export default router;