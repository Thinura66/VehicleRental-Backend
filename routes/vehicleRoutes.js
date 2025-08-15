const express = require('express');
const { body } = require('express-validator');
const {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getNearbyVehicles
} = require('../controllers/vehicleController');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');
const { uploadMultiple, handleMulterError } = require('../config/multer');

const router = express.Router();

// Validation rules
const vehicleValidation = [
  body('name')
    .notEmpty()
    .withMessage('Vehicle name is required')
    .isLength({ max: 100 })
    .withMessage('Vehicle name cannot exceed 100 characters'),
  body('brand')
    .notEmpty()
    .withMessage('Brand is required')
    .isLength({ max: 50 })
    .withMessage('Brand name cannot exceed 50 characters'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['car', 'bike', 'scooter', 'bicycle', 'truck', 'van'])
    .withMessage('Invalid category'),
  body('pricePerDay')
    .isNumeric()
    .withMessage('Price per day must be a number')
    .isFloat({ min: 0 })
    .withMessage('Price per day must be positive'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('address')
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ max: 200 })
    .withMessage('Address cannot exceed 200 characters'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('licensePlate')
    .notEmpty()
    .withMessage('License plate is required'),
  body('seatingCapacity')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Seating capacity must be between 1 and 50'),
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Invalid year'),
  body('fuelType')
    .optional()
    .isIn(['petrol', 'diesel', 'electric', 'hybrid', 'manual'])
    .withMessage('Invalid fuel type'),
  body('transmission')
    .optional()
    .isIn(['manual', 'automatic'])
    .withMessage('Invalid transmission type')
];

// Public routes
router.get('/', optionalAuth, getVehicles);
router.get('/near', getNearbyVehicles);
router.get('/:id', optionalAuth, getVehicle);

// Protected routes (Admin only)
router.post('/', 
  protect, 
  restrictTo('admin'), 
  uploadMultiple, 
  handleMulterError, 
  vehicleValidation, 
  createVehicle
);

router.put('/:id', 
  protect, 
  restrictTo('admin'), 
  uploadMultiple, 
  handleMulterError, 
  vehicleValidation.map(validation => validation.optional()), // Make all validations optional for updates
  updateVehicle
);

router.delete('/:id', protect, restrictTo('admin'), deleteVehicle);

module.exports = router;
