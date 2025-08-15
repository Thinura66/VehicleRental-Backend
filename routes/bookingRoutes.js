const express = require('express');
const { body } = require('express-validator');
const {
  getBookings,
  getBooking,
  createBooking,
  updateBookingStatus,
  cancelBooking,
  getBookingStats
} = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const bookingValidation = [
  body('vehicleId')
    .notEmpty()
    .withMessage('Vehicle ID is required')
    .isMongoId()
    .withMessage('Invalid vehicle ID'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Invalid start date format')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('Invalid end date format')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('pickupLocation')
    .notEmpty()
    .withMessage('Pickup location is required')
    .isLength({ max: 200 })
    .withMessage('Pickup location cannot exceed 200 characters'),
  body('dropoffLocation')
    .notEmpty()
    .withMessage('Dropoff location is required')
    .isLength({ max: 200 })
    .withMessage('Dropoff location cannot exceed 200 characters'),
  body('specialRequests')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Special requests cannot exceed 500 characters')
];

const statusUpdateValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('adminNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Admin notes cannot exceed 500 characters')
];

const cancelValidation = [
  body('cancellationReason')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Cancellation reason cannot exceed 200 characters')
];

// Protected routes
router.get('/', protect, getBookings);
router.get('/stats', protect, restrictTo('admin'), getBookingStats);
router.get('/:id', protect, getBooking);
router.post('/', protect, bookingValidation, createBooking);

// Admin only routes
router.put('/:id/status', protect, restrictTo('admin'), statusUpdateValidation, updateBookingStatus);

// User and admin routes
router.put('/:id/cancel', protect, cancelValidation, cancelBooking);

module.exports = router;
