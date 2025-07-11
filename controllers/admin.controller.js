import User from '../models/user.model.js';
import Chat from '../models/chat.model.js';
import Message from '../models/message.model.js';
import jwt from 'jsonwebtoken';
import BlackListToken from '../models/blackListToken.model.js';

async function getAllUsers(req,res){
    try{
        const users = await User.find({});
        const transformedUsers = await Promise.all(
            users.map(async({name,username,avatar,_id})=>{
                const [groups,friends] = await Promise.all([
                    Chat.countDocuments({groupChat:true,members:_id}),
                    Chat.countDocuments({groupChat:false,members:_id})
                ])
                return {
                    name,
                    username,
                    avatar : avatar.url,
                    _id,
                    groups,
                    friends
                }
            })
        )
        return res.status(200).json({
            msg : "Users Received successfully",
            users : transformedUsers
        })
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal server error",
            err : err.message
        })      
    }
}

async function getAllChats(req,res){
    try{
        const chats = await Chat.find({})
            .populate("members","name avatar")
            .populate("creator","name avatar");

        const transformedChats = await Promise.all(
            chats.map(async({members,_id,groupChat,groupName,creator})=>{
                const totalMessages = await Message.countDocuments({chat:_id});
                return {
                    _id,
                    groupChat,
                    groupName,
                    avatar : members.slice(0,3).map((member)=>member.avatar.url),
                    members : members.map(({_id,name,avatar})=>({
                        _id,
                        name,
                        avatar : avatar.url
                    })),
                    creator : {
                        name : creator?.name || "None",
                        avatar : creator?.avatar.url || ""
                    },
                    totalMembers : members.length,
                    totalMessages : totalMessages
                }
            })
        )

        return res.status(200).json({
            msg : "Chats received successfully",
            chats : transformedChats
        })
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal server error",
            err : err.message
        })      
    }
}

async function getAllMessages(req, res) {
  try {
    const messages = await Message.find({})
      .populate("sender", "name avatar")
      .populate("chat", "groupChat");

    const transformedMessages = messages
      .filter(msg => msg.sender && msg.chat)
      .map(({ _id, content, attachments, sender, chat, createdAt }) => ({
        _id,
        attachments,
        content,
        createdAt,
        chat: chat._id,
        groupChat: chat.groupChat,
        sender: {
          _id: sender._id,
          name: sender.name,
          avatar: sender.avatar?.url || null
        }
      }));

    return res.status(200).json({
      msg: "Messages received successfully",
      messages: transformedMessages
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      msg: "Internal server error",
      err: err.message
    });
  }
}


async function getDashboardStats(req, res) {
  try {
    const [groupsCount, usersCount, messagesCount, totalChatsCount] = await Promise.all([
      Chat.countDocuments({ groupChat: true }),
      User.countDocuments(),
      Message.countDocuments(),
      Chat.countDocuments()
    ]);

    // Align 'today' to midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 6);

    const last7DaysMessages = await Message.find({
      createdAt: {
        $gte: last7Days,
        $lte: new Date() 
      }
    }).select("createdAt");

    const messages = new Array(7).fill(0);
    const dayInMilliseconds = 1000 * 60 * 60 * 24;

    last7DaysMessages.forEach((message) => {
      const msgDate = new Date(message.createdAt);
      msgDate.setHours(0, 0, 0, 0); // Align message date to midnight
      const diff = msgDate.getTime() - last7Days.getTime();
      const dayIndex = Math.floor(diff / dayInMilliseconds);
      if (dayIndex >= 0 && dayIndex < 7) {
        messages[dayIndex]++;
      }
    });

    const stats = {
      groupsCount,
      usersCount,
      messagesCount,
      totalChatsCount,
      messagesChart: messages
    };

    return res.status(200).json({
      msg: "Dashboard stats received successfully",
      stats
    });
  } catch (err) {
    return res.status(500).json({
      msg: "Internal server error",
      err: err.message
    });
  }
}


async function adminLogin(req,res){
    try{
        const secretKey = req.body?.secretKey;
        if(!secretKey){
            return res.status(400).json({
                msg : "Please provide secret key"
            })
        }
        const adminSecretKey = process.env.ADMIN_SECRET_KEY;
        const isMatch = secretKey === adminSecretKey;
        if(!isMatch){
            return res.status(401).json({
                msg : "Invalid secret key"
            })
        }
        const token = jwt.sign(secretKey,process.env.JWT_SECRET);
        res.cookie("admintoken", token, {
          httpOnly: true,
          secure: true,           
          sameSite: "None",     
          maxAge: 7 * 24 * 60 * 60 * 1000 
        });
        return res.status(200).json({
            msg : "Admin has successfully logged In",
            token : token
        })
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal server error",
            err : err.message
        })      
    }
}

async function adminLogout(req,res){
    try{
        const token = req.cookies.admintoken;
        res.clearCookie(token);
        res.status(200).json({
            msg : "Logged out"
        })
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal server error",
            err : err.message
        })      
    }
}

async function getAdminData(req,res){
    return res.status(200).json({
        admin : true
    })
}

export {getAllUsers, getAllChats, getAllMessages, getDashboardStats, adminLogin, adminLogout, getAdminData};