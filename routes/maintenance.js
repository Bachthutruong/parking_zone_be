const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { auth: authenticateToken, requireRole } = require('../middleware/auth');

// Get all maintenance days
router.get('/', authenticateToken, requireRole(['admin', 'staff']), maintenanceController.getAllMaintenanceDays);

// Check maintenance days for date range (MUST be before /:id route) - Public endpoint
router.get('/check/range', maintenanceController.checkMaintenanceDays);

// Create maintenance day
router.post('/', authenticateToken, requireRole(['admin']), maintenanceController.createMaintenanceDay);

// Update maintenance day
router.put('/:id', authenticateToken, requireRole(['admin']), maintenanceController.updateMaintenanceDay);

// Delete maintenance day
router.delete('/:id', authenticateToken, requireRole(['admin']), maintenanceController.deleteMaintenanceDay);

// Get maintenance day by ID (MUST be last to avoid conflict with /check/range)
router.get('/:id', authenticateToken, requireRole(['admin', 'staff']), maintenanceController.getMaintenanceDayById);

module.exports = router; 