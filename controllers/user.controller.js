import User from "../models/user.model.js";
import {UserRegisterValidationSchema, UserLoginValidationSchema} from '../validators/user.validator.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import BlackListToken from '../models/blackListToken.model.js'
import Chat from "../models/chat.model.js";
import Request from "../models/request.model.js";
import {emitEvent, uploadFilesToCloudinary} from '../utils/features.js'
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { request } from "express";

async function registerUser(req, res) {
  try {
    const { name, username, password, bio } = req.body;
    const file = req.file;

    // Check if any required field is missing
    if (!name || !username || !password || !bio || !file) {
      return res.status(400).json({
        msg: "All fields including avatar are required",
      });
    }

    // Validate input fields
    const result = UserRegisterValidationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        msg: "Please enter valid input data",
        error: result.error.errors,
      });
    }

    // Check if username is already taken
    const isUserAlreadyExists = await User.findOne({ username });
    if (isUserAlreadyExists) {
      return res.status(400).json({
        msg: "Username is already registered",
      });
    }

    // Upload avatar to Cloudinary
    let avatar;
    try {
      const fileUploader = await uploadFilesToCloudinary([file]);
      if (!fileUploader || !fileUploader[0]) {
        throw new Error("File upload failed");
      }
      avatar = {
        public_id: fileUploader[0].public_id,
        url: fileUploader[0].url,
      };
    } catch (cloudErr) {
      return res.status(500).json({
        msg: "Failed to upload avatar image",
        error: cloudErr.message || cloudErr,
      });
    }

    // Hash the password
    const saltRounds = parseInt(process.env.SALT_ROUNDS) || 8;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const user = await User.create({
      name,
      username,
      bio,
      password: hashedPassword,
      avatar,
    });

    // Generate JWT token
    const token = jwt.sign(
      { _id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Set token cookie
    res.cookie("token", token);

    // Send response
    return res.status(201).json({
      msg: `${user.name} has successfully registered`,
      user,
      token,
    });
  } 
  catch (err) {
    return res.status(500).json({
      msg: "Internal server error",
      error: err.message || err,
    });
  }
}


async function loginUser(req,res){
    try{
        const username = req.body?.username;
        const password = req.body?.password;
        if(!username || !password){
            return res.status(400).json({
                msg : "All fields are required"
            })
        }
        const result = UserLoginValidationSchema.safeParse(req.body);
        if(!result.success){
            return res.status(400).json({
                msg : "Invalid username or password"
            })
        }
        const user =await User.findOne({username}).select('+password');
        if(!user){
            return res.status(400).json({
                msg : "User is not registered"
            })
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(400).json({
                msg : "Invalid password"
            })
        }
        const token = jwt.sign({_id: user._id},process.env.JWT_SECRET,{expiresIn : '24h'});
        res.cookie('token',token);
        return res.status(200).json({
            msg : `Welcome back ${user.name}`,
            user : user,
            token : token
        })
    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function getUserProfile(req,res){
    try{
        res.status(200).json({
            user : req.user
        });
    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function logoutUser(req,res){
    try{
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        await BlackListToken.create({token});
        res.clearCookie('token');
        res.status(200).json({
            msg : "Logged out successfully"
        })
    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function searchUser(req,res){
    try{
        const {name=""} = req.query;
        const chats = await Chat.find({groupChat:false, members:req.user._id});
        const allFriends = chats.flatMap((chat)=> chat.members);
        if(allFriends.length === 0){
            allFriends.push(req.user._id);
        }
        const otherUsers = await User.find({
            _id: { $nin: allFriends },
            $or: [
                { name: { $regex: name, $options: "i" } },
                { username: { $regex: name, $options: "i" } }
            ]
        });
        const users = otherUsers.map(({_id,name,avatar})=>({
            _id,
            name,
            avatar : avatar.url
        }));
        return res.status(200).json({
            msg : "Searching a user",
            users : users
        })
    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function sendRequest(req,res){
    try{
        const userId = req.body?.userId;
        if(!userId){
            return res.status(400).json({
                msg : "Please provide userId to send friend request"
            })
        }
        const user = await User.findById(userId);
        if(!user){
            return res.status(400).json({
                msg : "Please enter valid userId to send friend request"
            })
        }
        const isRequestExists1 = await Request.findOne({
            sender: req.user._id, 
            receiver : userId
        });
        const isRequestExists2 = await Request.findOne({
            sender: userId, 
            receiver : req.user._id
        })
        if(isRequestExists1){
            return res.status(400).json({
                msg : "Request is already sent"
            })
        }
        if(isRequestExists2){
            return res.status(400).json({
                msg : "User has already sent you a request, Check in Notifications..."
            })
        }
        const request = await Request.create({
            sender : req.user._id,
            receiver : userId
        })
        emitEvent(req,NEW_REQUEST,[userId]);
        return res.status(200).json({
            msg : "Request sent successfully",
            request : request
        })
    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function acceptRequest(req, res) {
    try {
        const requestId = req.body?.requestId;
        const accept = req.body?.accept;

        if (!requestId || typeof accept !== "boolean") {
            return res.status(400).json({
                msg: "Please provide all the details to accept friend request"
            });
        }

        const request = await Request.findById(requestId)
            .populate("sender", "name")
            .populate("receiver", "name");

        if (!request) {
            return res.status(400).json({
                msg: "Request is not valid"
            });
        }

        if (request.receiver._id.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                msg: "You are not authorized to accept the request"
            });
        }

        if (!accept) {
            await request.deleteOne();
            return res.status(200).json({
                msg: "Friend request rejected",
                request
            });
        }

        const members = [request.sender._id, request.receiver._id];

        const chat = await Chat.create({
            members,
            groupName: `${request.sender.name}-${request.receiver.name}`,
            groupChat: false
        });

        await request.deleteOne();

        emitEvent(req, REFETCH_CHATS, members);

        return res.status(200).json({
            msg: "Friend request accepted successfully",
            chat
        });
    } 
    catch (err) {
        return res.status(500).json({
            msg: "Internal server error",
            err: err.message
        });
    }
}


async function getAllNotifications(req,res){
    try{
        const requests = await Request.find({receiver : req.user._id}).populate("sender","name avatar");
        const allRequests = requests.map(({_id,sender})=>({
            _id,
            sender :{
                _id : sender._id,
                name : sender.name,
                avatar : sender.avatar.url
            }
        }))
        return res.status(200).json({
            msg : "Notifications received successfully",
            allRequests : allRequests
        })
    }
    catch (err) {
        return res.status(500).json({
            msg: "Internal server error",
            err: err.message
        });
    }
}

async function getAllFriends(req,res){
    try{
        const chatId = req.query.chatId;
        const chat = await Chat.find({members:req.user._id,groupChat:false}).populate("members","name avatar");
        const friends = chat.map(({members})=>{
            const otherMember = members.find((member)=>member._id.toString() !== req.user._id.toString());
            return {
                _id : otherMember._id,
                name : otherMember.name,
                avatar : otherMember.avatar.url
            }
        })
        if(chatId){
            const chat = await Chat.findById(chatId);
            const availableFriends = friends.filter(
                (friend)=> !chat.members.includes(friend._id)
            )
            return res.status(200).json({
                msg : "Available friends received successfully",
                availableFriends : availableFriends
            })
        }
        else{
            return res.status(200).json({
                msg : "All friends received successfully",
                friends : friends
            })
        }
    }
    catch (err) {
        return res.status(500).json({
            msg: "Internal server error",
            err: err.message
        });
    }
}



export {registerUser, loginUser, getUserProfile, logoutUser, searchUser,sendRequest, acceptRequest,getAllNotifications,getAllFriends};