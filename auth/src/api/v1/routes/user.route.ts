import verifyToken from '@/middleware/verifyToken';
import express from 'express';
import getUsers from '../controllers/user.controller';

const router = express.Router();

router.get('/', verifyToken, getUsers);

export default router;