const { validationResult } = require('express-validator');
const Vehicle = require('../models/Vehicle');
const { uploadToFirebase, deleteFromFirebase } = require('../config/firebase');

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Public
const getVehicles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      brand,
      minPrice,
      maxPrice,
      availability = true,
      sort = '-createdAt',
      search,
      lat,
      lng,
      radius = 10 // km
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (category) filter.category = category.toLowerCase();
    if (brand) filter.brand = new RegExp(brand, 'i');
    if (availability !== undefined) filter.availability = availability === 'true';
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter.pricePerDay = {};
      if (minPrice) filter.pricePerDay.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerDay.$lte = Number(maxPrice);
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    let query = Vehicle.find(filter).populate('owner', 'name phone email');

    // Location-based search
    if (lat && lng) {
      const longitude = parseFloat(lng);
      const latitude = parseFloat(lat);
      const radiusInRadians = radius / 6371; // Convert km to radians

      query = Vehicle.find({
        ...filter,
        location: {
          $geoWithin: {
            $centerSphere: [[longitude, latitude], radiusInRadians]
          }
        }
      }).populate('owner', 'name phone email');
    }

    // Sort
    query = query.sort(sort);

    // Pagination
    const skip = (page - 1) * limit;
    query = query.skip(skip).limit(limit);

    const vehicles = await query;
    const total = await Vehicle.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: vehicles.length,
      total,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      data: vehicles
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching vehicles'
    });
  }
};

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Public
const getVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('owner', 'name phone email')
      .populate({
        path: 'reviews',
        populate: {
          path: 'userId',
          select: 'name avatar'
        }
      });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching vehicle'
    });
  }
};

// @desc    Create new vehicle
// @route   POST /api/vehicles
// @access  Private (Admin only)
const createVehicle = async (req, res) => {
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

    // Add owner to req.body
    req.body.owner = req.user.id;

    // Handle image uploads
    let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToFirebase(file, 'vehicles');
          images.push(uploadResult);
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          return res.status(400).json({
            success: false,
            message: 'Error uploading images'
          });
        }
      }
    }

    req.body.images = images;

    // Parse location coordinates
    if (req.body.latitude && req.body.longitude) {
      req.body.location = {
        type: 'Point',
        coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
      };
      delete req.body.latitude;
      delete req.body.longitude;
    }

    const vehicle = await Vehicle.create(req.body);

    res.status(201).json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating vehicle'
    });
  }
};

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private (Admin only)
const updateVehicle = async (req, res) => {
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

    let vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      const newImages = [];
      for (const file of req.files) {
        try {
          const uploadResult = await uploadToFirebase(file, 'vehicles');
          newImages.push(uploadResult);
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          return res.status(400).json({
            success: false,
            message: 'Error uploading images'
          });
        }
      }
      
      // Add new images to existing ones or replace them
      if (req.body.replaceImages === 'true') {
        // Delete old images from Firebase
        for (const image of vehicle.images) {
          try {
            await deleteFromFirebase(image.filename);
          } catch (deleteError) {
            console.error('Error deleting old image:', deleteError);
          }
        }
        req.body.images = newImages;
      } else {
        req.body.images = [...vehicle.images, ...newImages];
      }
    }

    // Parse location coordinates if provided
    if (req.body.latitude && req.body.longitude) {
      req.body.location = {
        type: 'Point',
        coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
      };
      delete req.body.latitude;
      delete req.body.longitude;
    }

    vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('owner', 'name phone email');

    res.status(200).json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating vehicle'
    });
  }
};

// @desc    Delete vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private (Admin only)
const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Delete images from Firebase
    for (const image of vehicle.images) {
      try {
        await deleteFromFirebase(image.filename);
      } catch (deleteError) {
        console.error('Error deleting image:', deleteError);
      }
    }

    await Vehicle.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting vehicle'
    });
  }
};

// @desc    Get vehicles near location
// @route   GET /api/vehicles/near
// @access  Public
const getNearbyVehicles = async (req, res) => {
  try {
    const { lat, lng, radius = 10, limit = 20 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);
    const radiusInRadians = radius / 6371; // Convert km to radians

    const vehicles = await Vehicle.find({
      availability: true,
      location: {
        $geoWithin: {
          $centerSphere: [[longitude, latitude], radiusInRadians]
        }
      }
    })
    .populate('owner', 'name phone')
    .limit(limit);

    res.status(200).json({
      success: true,
      count: vehicles.length,
      data: vehicles
    });
  } catch (error) {
    console.error('Get nearby vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching nearby vehicles'
    });
  }
};

module.exports = {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getNearbyVehicles
};
