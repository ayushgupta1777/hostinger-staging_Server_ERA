// backend/routes/uploadRoutes.js
import express from 'express';
import { upload } from '../config/cloudinary.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/image', protect, authorize('admin'), upload.single('image'), (req, res) => {
  res.json({
    success: true,
    data: { url: req.file.path }
  });
});

router.post('/images', protect, authorize('admin'), upload.array('images', 5), (req, res) => {
  const urls = req.files.map(file => file.path);
  res.json({
    success: true,
    data: { urls }
  });
});

export default router;