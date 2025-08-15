const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vehicle name is required'],
    trim: true,
    maxlength: [100, 'Vehicle name cannot be more than 100 characters']
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
    maxlength: [50, 'Brand name cannot be more than 50 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['car', 'bike', 'scooter', 'bicycle', 'truck', 'van'],
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  pricePerDay: {
    type: Number,
    required: [true, 'Price per day is required'],
    min: [0, 'Price cannot be negative']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Location coordinates are required'],
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Invalid coordinates format'
      }
    }
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    maxlength: [200, 'Address cannot be more than 200 characters']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  availability: {
    type: Boolean,
    default: true
  },
  features: [{
    type: String,
    trim: true
  }],
  fuelType: {
    type: String,
    enum: ['petrol', 'diesel', 'electric', 'hybrid', 'manual'],
    lowercase: true
  },
  seatingCapacity: {
    type: Number,
    min: [1, 'Seating capacity must be at least 1'],
    max: [50, 'Seating capacity cannot exceed 50']
  },
  transmission: {
    type: String,
    enum: ['manual', 'automatic'],
    lowercase: true
  },
  year: {
    type: Number,
    min: [1900, 'Invalid year'],
    max: [new Date().getFullYear() + 1, 'Year cannot be in the future']
  },
  licensePlate: {
    type: String,
    required: [true, 'License plate is required'],
    unique: true,
    uppercase: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance
vehicleSchema.index({ location: '2dsphere' }); // Geospatial index
vehicleSchema.index({ category: 1, availability: 1 });
vehicleSchema.index({ pricePerDay: 1 });
vehicleSchema.index({ brand: 1 });
vehicleSchema.index({ averageRating: -1 });

// Virtual populate for reviews
vehicleSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'vehicleId'
});

// Ensure virtual fields are serialized
vehicleSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
