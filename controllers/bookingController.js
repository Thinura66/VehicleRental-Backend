const { validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');

// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private
const getBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      userId,
      vehicleId,
      sort = '-createdAt'
    } = req.query;

    // Build filter
    let filter = {};

    // If user is not admin, only show their bookings
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    } else {
      // Admin can filter by userId
      if (userId) filter.userId = userId;
    }

    if (vehicleId) filter.vehicleId = vehicleId;
    if (status) filter.status = status;

    // Pagination
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('userId', 'name email phone')
      .populate('vehicleId', 'name brand pricePerDay images')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      data: bookings
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings'
    });
  }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('vehicleId', 'name brand pricePerDay images location address');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking or is admin
    if (req.user.role !== 'admin' && booking.userId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this booking'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking'
    });
  }
};

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
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

    const { vehicleId, startDate, endDate, pickupLocation, dropoffLocation, specialRequests } = req.body;

    // Check if vehicle exists and is available
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    if (!vehicle.availability) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is not available'
      });
    }

    // Check date availability
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const isAvailable = await Booking.checkAvailability(vehicleId, start, end);
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is not available for the selected dates'
      });
    }

    // Calculate total price
    const timeDiff = end.getTime() - start.getTime();
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const totalPrice = days * vehicle.pricePerDay;

    // Create booking
    const booking = await Booking.create({
      userId: req.user.id,
      vehicleId,
      startDate: start,
      endDate: end,
      totalPrice,
      pickupLocation,
      dropoffLocation,
      specialRequests,
      status: 'pending'
    });

    // Populate the booking before sending response
    await booking.populate('userId', 'name email phone');
    await booking.populate('vehicleId', 'name brand pricePerDay images');

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating booking'
    });
  }
};

// @desc    Update booking status
// @route   PUT /api/bookings/:id/status
// @access  Private (Admin only)
const updateBookingStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    if (!['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Update booking
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(adminNotes && { adminNotes })
      },
      {
        new: true,
        runValidators: true
      }
    )
    .populate('userId', 'name email phone')
    .populate('vehicleId', 'name brand pricePerDay images');

    res.status(200).json({
      success: true,
      data: updatedBooking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating booking status'
    });
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking or is admin
    if (req.user.role !== 'admin' && booking.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // Check if booking can be cancelled
    if (!['pending', 'approved'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be cancelled in current status'
      });
    }

    // Update booking
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        status: 'cancelled',
        cancellationReason
      },
      {
        new: true,
        runValidators: true
      }
    )
    .populate('userId', 'name email phone')
    .populate('vehicleId', 'name brand pricePerDay images');

    res.status(200).json({
      success: true,
      data: updatedBooking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling booking'
    });
  }
};

// @desc    Get booking stats (Admin only)
// @route   GET /api/bookings/stats
// @access  Private (Admin only)
const getBookingStats = async (req, res) => {
  try {
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    const totalBookings = await Booking.countDocuments();
    const totalRevenue = await Booking.aggregate([
      {
        $match: { status: { $in: ['completed'] } }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalPrice' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        statusBreakdown: stats
      }
    });
  } catch (error) {
    console.error('Get booking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking statistics'
    });
  }
};

module.exports = {
  getBookings,
  getBooking,
  createBooking,
  updateBookingStatus,
  cancelBooking,
  getBookingStats
};
