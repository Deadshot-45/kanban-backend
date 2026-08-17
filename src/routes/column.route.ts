import express from 'express';
import { 
  createColumn, 
  updateColumn, 
  deleteColumn 
} from '../controllers/column.controller';

const router = express.Router();

router.post('/', createColumn);
router.put('/:id', updateColumn);
router.delete('/:id', deleteColumn);

export default router;
