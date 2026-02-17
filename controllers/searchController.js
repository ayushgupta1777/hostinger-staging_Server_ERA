// ============================================
// backend/controllers/searchController.js
// UPDATED - With Subcategory Support
// ============================================
import Product from '../models/Product.js';
import Category from '../models/Category.js';

/**
 * @desc    Global search - Products, Categories, and Subcategories
 * @route   GET /api/search
 * @access  Public
 */
export const globalSearch = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          products: [],
          categories: [],
          subcategories: []
        }
      });
    }

    const searchRegex = new RegExp(query, 'i');

    // Parallel search for better performance
    const [products, allCategories] = await Promise.all([
      // Search products by title and description
      Product.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex }
        ],
        status: 'approved',
        isActive: true
      })
        .populate('category', 'name slug image')
        .populate('subcategory', 'name slug image parent')
        .limit(20),

      // Search all categories (both parent and subcategories)
      Category.find({
        name: searchRegex,
        isActive: true
      })
        .populate('parent', 'name slug image')
        .limit(20)
    ]);

    // Separate root categories and subcategories
    const categories = allCategories.filter(cat => !cat.parent || cat.parent === null);
    const subcategories = allCategories.filter(cat => cat.parent !== null && cat.parent !== undefined);

    res.json({
      success: true,
      data: {
        products,
        categories,
        subcategories,
        query
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get products by category/subcategory from search
 * @route   GET /api/search/category/:categoryId
 * @access  Public
 */
export const searchByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.json({
        success: true,
        data: { products: [], category: null, subcategories: [] }
      });
    }

    let query = { status: 'approved', isActive: true };

    // If it's a parent category, show all products in it and subcategories
    if (!category.parent) {
      const subcats = await Category.find({ parent: categoryId });
      const subcatIds = subcats.map(cat => cat._id);
      query.$or = [
        { category: categoryId },
        { subcategory: { $in: subcatIds } }
      ];
    } else {
      // If it's a subcategory, show only its products
      query.subcategory = categoryId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name slug image')
        .populate('subcategory', 'name slug image')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),

      Product.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        category,
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get subcategories by parent category
 * @route   GET /api/search/category/:parentId/subcategories
 * @access  Public
 */
export const getSubcategoriesByParent = async (req, res, next) => {
  try {
    const { parentId } = req.params;

    const subcategories = await Category.find({
      parent: parentId,
      isActive: true
    })
      .populate('parent', 'name slug image')
      .sort('sortOrder');

    res.json({
      success: true,
      data: { subcategories }
    });
  } catch (error) {
    next(error);
  }
};