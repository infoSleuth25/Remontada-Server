import express from 'express';
import { getAllUsers, getAllChats, getAllMessages,getDashboardStats, adminLogin, adminLogout, getAdminData } from '../controllers/admin.controller.js';
import { authAdmin } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.post('/verify',adminLogin);
router.get('/users',authAdmin,getAllUsers);
router.get('/chats',authAdmin,getAllChats);
router.get('/messages',authAdmin,getAllMessages);
router.get('/dashboard',authAdmin,getDashboardStats);
router.get('/logout',authAdmin,adminLogout);
router.get('/',authAdmin,getAdminData);

export default router;