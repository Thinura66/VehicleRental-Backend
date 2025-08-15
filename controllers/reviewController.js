const { validationResult } = require('express-validator');
const Review = require('../models/Review');
const Booking = require('../models/Booking');

// @desc    Get all reviews
// @route   GET /api/reviews
// @access  Public
const getReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      vehicleId,
      userId,
      sort = '-date',
      minRating,
      maxRating
    } = req.query;

    // Build filter
    let filter = {};
    
    if (vehicleId) filter.vehicleId = vehicleId;
    if (userId) filter.userId = userId;
    
    // Rating filter
    if (minRating || maxRating) {
      filter.rating = {};
      if (minRating) filter.rating.$gte = Number(minRating);
      if (maxRating) filter.rating.$lte = Number(maxRating);
    }

    // Pagination
    const skip = (page - 1) * limit;

    const reviews = await Review.find(filter)
      .populate('userId', 'name avatar')
      .populate('vehicleId', 'name brand images')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      data: reviews
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reviews'
    });
  }
};

// @desc    Get single review
// @route   GET /api/reviews/:id
// @access  Public
const getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('userId', 'name avatar')
      .populate('vehicleId', 'name brand images')
      .populate('bookingId', 'startDate endDate');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching review'
    });
  }
};

// @desc    Create new review
// @route   POST /api/reviews
// @access  Private
const createReview = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { vehicleId, bookingId, rating, comment } = req.body;

    // Check if booking exists and belongs to user
    const booking = await Booking.findOne({
      _id: bookingId,
      userId: req.user.id,
      vehicleId: vehicleId,
      status: 'completed'
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Completed booking not found or does not belong to you'
      });
    }

    // Check if user has already reviewed this booking
    const existingReview = await Review.findOne({
      userId: req.user.id,
      bookingId: bookingId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this booking'
      });
    }

    // Create review
    const review = await Review.create({
      userId: req.user.id,
      vehicleId,
      bookingId,
      rating,
      comment
    });

    // Populate the review before sending response
    await review.populate('userId', 'name avatar');
    await review.populate('vehicleId', 'name brand images');

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating review'
    });
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
const updateReview = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    let review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns this review
    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    const { rating, comment } = req.body;

    // Update review
    review = await Review.findByIdAndUpdate(
      req.params.id,
      { rating, comment },
      {
        new: true,
        runValidators: true
      }
    )
    .populate('userId', 'name avatar')
    .populate('vehicleId', 'name brand images');

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating review'
    });
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns this review or is admin
    if (review.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    await Review.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting review'
    });
  }
};

// @desc    Get reviews for a vehicle
// @route   GET /api/reviews/vehicle/:vehicleId
// @access  Public
const getVehicleReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-date'
    } = req.query;

    const skip = (page - 1) * limit;

    const reviews = await Review.find({ vehicleId: req.params.vehicleId })
      .populate('userId', 'name avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ vehicleId: req.params.vehicleId });

    // Get rating distribution
    const ratingStats = await Review.aggregate([
      { $match: { vehicleId: mongoose.Types.ObjectId(req.params.vehicleId) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      ratingStats,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      data: reviews
    });
  } catch (error) {
    console.error('Get vehicle reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching vehicle reviews'
    });
  }
};

// @desc    Add admin response to review
// @route   PUT /api/reviews/:id/response
// @access  Private (Admin only)
const addAdminResponse = async (req, res) => {
  try {
    const { response } = req.body;

    if (!response || response.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Response content is required'
      });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update review with admin response
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      {
        adminResponse: {
          response: response.trim(),
          respondedAt: new Date(),
          respondedBy: req.user.id
        }
      },
      {
        new: true,
        runValidators: true
      }
    )
    .populate('userId', 'name avatar')
    .populate('vehicleId', 'name brand images')
    .populate('adminResponse.respondedBy', 'name');

    res.status(200).json({
      success: true,
      data: updatedReview
    });
  } catch (error) {
    console.error('Add admin response error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding admin response'
    });
  }
};

module.exports = {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  getVehicleReviews,
  addAdminResponse
};
