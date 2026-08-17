import express from 'express';
import { getBoardData } from '../controllers/column.controller';
import {
  inviteMember,
  getBoardMembers,
  checkInvite,
  acceptInvite,
  declineInvite,
} from '../controllers/board.controller';

const router = express.Router();

router.get('/', getBoardData);
router.post('/invite', inviteMember);
router.get('/members', getBoardMembers);
router.get('/invite/check', checkInvite);
router.put('/invite/:id/accept', acceptInvite);
router.delete('/invite/:id/decline', declineInvite);

export default router;
