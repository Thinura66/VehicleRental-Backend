const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: [true, 'Vehicle ID is required']
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be a whole number'
    }
  },
  comment: {
    type: String,
    maxlength: [500, 'Comment cannot be more than 500 characters'],
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  helpfulVotes: {
    type: Number,
    default: 0,
    min: 0
  },
  adminResponse: {
    response: {
      type: String,
      maxlength: [300, 'Admin response cannot be more than 300 characters']
    },
    respondedAt: {
      type: Date
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
reviewSchema.index({ vehicleId: 1, rating: -1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ date: -1 });
reviewSchema.index({ isVerified: 1 });

// Compound index to ensure one review per user per booking
reviewSchema.index({ userId: 1, bookingId: 1 }, { unique: true });

// Static method to calculate average rating for a vehicle
reviewSchema.statics.calcAverageRating = async function(vehicleId) {
  const stats = await this.aggregate([
    {
      $match: { vehicleId: vehicleId }
    },
    {
      $group: {
        _id: '$vehicleId',
        avgRating: { $avg: '$rating' },
        numRatings: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await mongoose.model('Vehicle').findByIdAndUpdate(vehicleId, {
      averageRating: Math.round(stats[0].avgRating * 10) / 10, // Round to 1 decimal
      totalReviews: stats[0].numRatings
    });
  } else {
    await mongoose.model('Vehicle').findByIdAndUpdate(vehicleId, {
      averageRating: 0,
      totalReviews: 0
    });
  }
};

// Update vehicle's average rating after save
reviewSchema.post('save', function() {
  this.constructor.calcAverageRating(this.vehicleId);
});

// Update vehicle's average rating after remove
reviewSchema.post('remove', function() {
  this.constructor.calcAverageRating(this.vehicleId);
});

// Pre-save validation to ensure user has completed booking
reviewSchema.pre('save', async function(next) {
  if (this.isNew) {
    const booking = await mongoose.model('Booking').findOne({
      _id: this.bookingId,
      userId: this.userId,
      vehicleId: this.vehicleId,
      status: 'completed'
    });

    if (!booking) {
      const error = new Error('You can only review vehicles from completed bookings');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Review', reviewSchema);
