import express from 'express';
const router = express.Router();
import {registerUser, loginUser, getUserProfile, logoutUser, searchUser,sendRequest,acceptRequest,getAllNotifications,getAllFriends} from '../controllers/user.controller.js';
import { singleAvatar } from '../middlewares/multer.js';
import { authUser } from '../middlewares/auth.middleware.js';

router.post('/register',singleAvatar,registerUser);
router.post('/login',loginUser);
router.get('/profile',authUser, getUserProfile);
router.get('/logout',authUser, logoutUser);
router.get('/search',authUser, searchUser);
router.put('/sendrequest',authUser, sendRequest);
router.put('/acceptrequest',authUser, acceptRequest);
router.get('/notifications',authUser, getAllNotifications);
router.get('/friends',authUser, getAllFriends);

export default router;