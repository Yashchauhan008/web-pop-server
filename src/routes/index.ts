import express from 'express';
import { authMiddleware } from '@/middlewares/auth.middleware.js';
import { RemindersService } from '@/modules/reminders/reminders.service.js';
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
router.get('/reminders/preview', authMiddleware, (req, res) => {
  const { startAt, recurrenceType, recurrenceInterval, timezone } = req.query as any;
  if (!startAt || !recurrenceType) {
    return res.status(400).json({ success: false, message: 'Missing parameters' });
  }
  const occurrences = RemindersService.getUpcomingOccurrences({
    startAt: new Date(startAt),
    recurrenceType,
    recurrenceInterval: recurrenceInterval ? parseInt(recurrenceInterval, 10) : 1,
    timezone: timezone || 'UTC'
  });
  res.json({ success: true, data: occurrences });
});

router.post('/reminders', authMiddleware, validate(remindersController.reminderSchema), withDatabase(remindersController.createReminder));
router.get('/reminders', authMiddleware, withDatabase(remindersController.getReminders));
router.patch('/reminders/:id', authMiddleware, validate(remindersController.updateReminderSchema), withDatabase(remindersController.updateReminder));
router.delete('/reminders/:id', authMiddleware, withDatabase(remindersController.deleteReminder));
router.patch('/reminders/:id/status', authMiddleware, withDatabase(remindersController.toggleReminderStatus));
router.post('/reminders/:id/snooze', authMiddleware, withDatabase(remindersController.snoozeReminder));
router.post('/reminders/:id/complete', authMiddleware, withDatabase(remindersController.completeReminder));

// Tags
router.post('/tags', authMiddleware, validate(tagsController.tagSchema), withDatabase(tagsController.createTag));
router.get('/tags', authMiddleware, withDatabase(tagsController.getTags));
router.delete('/tags/:id', authMiddleware, withDatabase(tagsController.deleteTag));

// Devices
router.get('/devices', authMiddleware, withDatabase(devicesController.getDevices));
router.post('/devices/register', authMiddleware, validate(devicesController.deviceSchema), withDatabase(devicesController.registerDevice));
router.delete('/devices/:id', authMiddleware, withDatabase(devicesController.unregisterDevice));

// Notifications
router.get('/notifications/history', authMiddleware, withDatabase(notificationsController.getNotificationHistory));
router.post('/notifications/test', authMiddleware, withDatabase(notificationsController.testNotification));
router.post('/reminders/:id/test', authMiddleware, withDatabase(notificationsController.testReminderNotification));

// Files
router.post('/files/upload', authMiddleware, fileUpload.single('file'), withDatabase(uploadFile));

export default router;
