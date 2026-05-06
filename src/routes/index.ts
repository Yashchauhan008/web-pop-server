import express from 'express';
import { authMiddleware } from '@/middlewares/auth.middleware.js';
import withDatabase from '@/shared/utilities/with-database.js';
import validate from '@/shared/middlewares/request-validator.js';

import * as remindersController from '@/modules/reminders/reminders.controller.js';
import * as tagsController from '@/modules/reminders/tags.controller.js';
import * as devicesController from '@/modules/devices/devices.controller.js';
import * as notificationsController from '@/modules/notifications/notifications.controller.js';
import fileUpload from '@/shared/middlewares/multer/file-upload.js';
import { Controller as uploadFile } from '@/modules/file/controllers/upload-file.js';

const router = express.Router();

// Auth routes (mostly handled by middleware + firebase)
router.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ success: true, data: (req as any).user });
});

// Reminders
router.post('/reminders', authMiddleware, validate(remindersController.reminderSchema), withDatabase(remindersController.createReminder));
router.get('/reminders', authMiddleware, withDatabase(remindersController.getReminders));
router.patch('/reminders/:id', authMiddleware, withDatabase(remindersController.updateReminder));
router.delete('/reminders/:id', authMiddleware, withDatabase(remindersController.deleteReminder));
router.patch('/reminders/:id/status', authMiddleware, withDatabase(remindersController.toggleReminderStatus));

// Tags
router.post('/tags', authMiddleware, validate(tagsController.tagSchema), withDatabase(tagsController.createTag));
router.get('/tags', authMiddleware, withDatabase(tagsController.getTags));
router.delete('/tags/:id', authMiddleware, withDatabase(tagsController.deleteTag));

// Devices
router.post('/devices/register', authMiddleware, validate(devicesController.deviceSchema), withDatabase(devicesController.registerDevice));
router.delete('/devices/:id', authMiddleware, withDatabase(devicesController.unregisterDevice));

// Notifications
router.get('/notifications/history', authMiddleware, withDatabase(notificationsController.getNotificationHistory));
router.post('/reminders/:id/test', authMiddleware, withDatabase(notificationsController.testReminderNotification));

// Files
router.post('/files/upload', authMiddleware, fileUpload.single('file'), withDatabase(uploadFile));

export default router;
