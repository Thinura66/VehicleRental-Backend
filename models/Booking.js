const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
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
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    validate: {
      validator: function(date) {
        return date >= new Date();
      },
      message: 'Start date cannot be in the past'
    }
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(date) {
        return date > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  pickupLocation: {
    type: String,
    required: [true, 'Pickup location is required'],
    maxlength: [200, 'Pickup location cannot be more than 200 characters']
  },
  dropoffLocation: {
    type: String,
    required: [true, 'Dropoff location is required'],
    maxlength: [200, 'Dropoff location cannot be more than 200 characters']
  },
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot be more than 500 characters']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'digital_wallet', 'bank_transfer']
  },
  paymentId: {
    type: String // For storing external payment gateway transaction ID
  },
  cancellationReason: {
    type: String,
    maxlength: [200, 'Cancellation reason cannot be more than 200 characters']
  },
  adminNotes: {
    type: String,
    maxlength: [500, 'Admin notes cannot be more than 500 characters']
  }
}, {
  timestamps: true
});

// Indexes for better performance
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ vehicleId: 1, status: 1 });
bookingSchema.index({ startDate: 1, endDate: 1 });
bookingSchema.index({ status: 1 });

// Virtual for booking duration in days
bookingSchema.virtual('durationDays').get(function() {
  if (this.startDate && this.endDate) {
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
  return 0;
});

// Static method to check vehicle availability
bookingSchema.statics.checkAvailability = async function(vehicleId, startDate, endDate, excludeBookingId = null) {
  const query = {
    vehicleId,
    status: { $in: ['approved', 'active'] },
    $or: [
      {
        startDate: { $lt: endDate },
        endDate: { $gt: startDate }
      }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBooking = await this.findOne(query);
  return !conflictingBooking;
};

// Pre-save middleware to validate booking dates don't conflict
bookingSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('startDate') || this.isModified('endDate')) {
    const isAvailable = await this.constructor.checkAvailability(
      this.vehicleId, 
      this.startDate, 
      this.endDate, 
      this._id
    );
    
    if (!isAvailable) {
      const error = new Error('Vehicle is not available for the selected dates');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

// Ensure virtual fields are serialized
bookingSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Booking', bookingSchema);
