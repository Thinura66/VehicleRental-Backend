const express = require('express');
const { body } = require('express-validator');
const {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  getVehicleReviews,
  addAdminResponse
} = require('../controllers/reviewController');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const reviewValidation = [
  body('vehicleId')
    .notEmpty()
    .withMessage('Vehicle ID is required')
    .isMongoId()
    .withMessage('Invalid vehicle ID'),
  body('bookingId')
    .notEmpty()
    .withMessage('Booking ID is required')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters')
    .trim()
];

const updateReviewValidation = [
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters')
    .trim()
];

const adminResponseValidation = [
  body('response')
    .notEmpty()
    .withMessage('Response is required')
    .isLength({ min: 1, max: 300 })
    .withMessage('Response must be between 1 and 300 characters')
    .trim()
];

// Public routes
router.get('/', optionalAuth, getReviews);
router.get('/:id', optionalAuth, getReview);
router.get('/vehicle/:vehicleId', optionalAuth, getVehicleReviews);

// Protected routes
router.post('/', protect, reviewValidation, createReview);
router.put('/:id', protect, updateReviewValidation, updateReview);
router.delete('/:id', protect, deleteReview);

// Admin only routes
router.put('/:id/response', protect, restrictTo('admin'), adminResponseValidation, addAdminResponse);

module.exports = router;
