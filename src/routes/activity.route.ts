import express from 'express';
import { getActivities, getAnalytics } from '../controllers/activity.controller';

const router = express.Router();

router.get('/', getActivities);
router.get('/analytics', getAnalytics);

export default router;
