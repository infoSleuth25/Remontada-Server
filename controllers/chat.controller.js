import { ALERT, NEW_MESSAGE, NEW_MESSAGE_ALERT, REFETCH_CHATS } from "../constants/events.js";
import Chat from "../models/chat.model.js";
import Message from '../models/message.model.js';
import User from "../models/user.model.js";
import { deleteFilesFromCloudinary, emitEvent, uploadFilesToCloudinary } from "../utils/features.js";
import { GroupCreateSchema } from "../validators/chat.validator.js";

async function newGroupChat(req,res){
    try{
        const groupName = req.body?.groupName;
        const groupMembers = req.body?.groupMembers;
        if(!groupName || !groupMembers){
            return res.status(400).json({
                msg : "All fields are required"
            })
        }
        const result = GroupCreateSchema.safeParse(req.body);
        if(!result.success){
            return res.status(400).json({
                msg : "Please enter valid input data",
                error : result.error.errors
            })
        }
        const allGroupMembers = [...groupMembers, req.user._id]; 
        const chat = await Chat.create({
            groupName : groupName,
            groupChat : true,
            creator : req.user._id,
            members : allGroupMembers
        })
        emitEvent(req,ALERT,allGroupMembers,{message:`Welcome to ${groupName} group`,chatId});
        emitEvent(req,REFETCH_CHATS,groupMembers);
        return res.status(201).json({
            msg : "Group is successfully created",
            group : chat
        })
    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function getChats(req,res){
    try{
        const chats = await Chat.find({members : req.user._id}).populate(
            "members",
            "name avatar"
        )
        const transformChats = chats.map(({_id,groupName,groupChat,members})=>{
            const otherMember = members.find((member)=>member._id.toString() !== req.user._id.toString());
            return {
                _id,
                groupChat,
                avatar : groupChat ? members.slice(0,3).map(({avatar})=> avatar.url): [otherMember.avatar.url],
                name : groupChat ? groupName : otherMember.name,
                members : members.reduce((prev,curr)=>{
                    if(curr._id.toString() != req.user._id.toString()){
                        prev.push(curr._id);
                    }
                    return prev;
                },[])
            }
        })
        return res.status(200).json({
            msg : "Chats received successfully",
            chats : transformChats
        })
    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function getGroups(req,res){
    try{
        const groups = await Chat.find({
            members: req.user._id,
            groupChat : true,
            creator : req.user._id
        }).populate("members","name avatar")

        const transformGroups = groups.map(({_id,members,groupChat,groupName})=>{
            return {
                _id,
                groupName,
                groupChat,
                avatar : members.slice(0,3).map(({avatar})=> avatar.url),
                members : members.reduce((prev,curr)=>{
                    if(curr._id.toString() != req.user._id.toString()){
                        prev.push(curr._id);
                    }
                    return prev;
                },[])
            }
        })

        return res.status(200).json({
            msg : "Group Details received successfully",
            groups : transformGroups
        })

    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function addMembers(req,res){
    try{
        const chatId = req.body?.chatId;
        const members = req.body?.members;
        if(!chatId || !members){
            return res.status(400).json({
                msg : "ChatId and members are required"
            })
        }
        const chat = await Chat.findById(chatId);
        if(!chat){
            return res.status(404).json({
                msg : "Group is not created"
            })
        }
        if(!chat.groupChat){
            return res.status(400).json({
                msg : "This is not a group chat"
            })
        }
        if(chat.creator.toString() != req.user._id.toString()){
            return res.status(403).json({
                msg : "You are not allowed to add group members"
            })
        }
        
        const existingMemberIds = new Set(chat.members.map(id => id.toString()));
        const newMemberIds = members.filter(id => !existingMemberIds.has(id.toString()));

        if (newMemberIds.length === 0) {
            return res.status(400).json({
                msg: "All provided users are already group members"
            })
        }

        const allNewMembersPromise = newMemberIds.map(id => User.findById(id, "name"));
        const allNewMembers = await Promise.all(allNewMembersPromise);

        chat.members.push(...allNewMembers.map((i)=> i._id));
        if(chat.members.length > 100){
            return res.status(400).json({
                msg : "Group members limit reached (100)"
            })
        }
        await chat.save();

        const allUsersName = allNewMembers.map((i)=>i.name).join(", ");
        emitEvent(req,ALERT,chat.members,{message:`${allUsersName} have been added to the group`,chatId});
        emitEvent(req,REFETCH_CHATS,chat.members);

        return res.status(200).json({
            msg : "All members are added to the group successfully",
            groupDetails : chat 
        })
    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function removeMember(req,res){
    try{
        const chatId = req.body?.chatId;
        const userId = req.body?.userId;
        if(!chatId || !userId){
            return res.status(400).json({
                msg : "Please provide both chatId and userId"
            })
        }

        const user = await User.findById(userId,"name");
        if(!user){
            return res.status(400).json({
                msg : "User has not registered"
            })
        }

        const chat = await Chat.findById(chatId);
        if(!chat){
            return res.status(404).json({
                msg : "Group is not created"
            })
        }
        if(!chat.groupChat){
            return res.status(400).json({
                msg : "This is not a group chat"
            })
        }
        if(chat.creator.toString() != req.user._id.toString()){
            return res.status(403).json({
                msg : "You are not allowed to remove group members"
            })
        }
        if(chat.members.length <=3){
            return res.status(400).json({
                msg : "Group must have at least 3 members"
            })
        }
        if (!chat.members.some(id => id.toString() === userId.toString())) {
            return res.status(400).json({
                msg: "User is not a member of the group"
            })
        }
        const allChatMembers = chat.members.map((i)=>i.toString());
        chat.members = chat.members.filter(id => id.toString() !== userId.toString());
        chat.save();

        emitEvent(req,ALERT,chat.members,{message:`${user.name} has been removed from the group`,chatId});
        emitEvent(req,REFETCH_CHATS,allChatMembers);
        return res.status(200).json({
            msg: "User has been removed from the group successfully",
            groupDetails: chat
        })
    }   
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function leaveGroup(req,res){
    try{
        const chatId = req.params.chatId;
        const chat = await Chat.findById(chatId);
        if(!chat){
            return res.status(404).json({
                msg : "Group is not created"
            })
        }
        if(!chat.groupChat){
            return res.status(400).json({
                msg : "This is not a group chat"
            })
        }
        if (!chat.members.some(id => id.toString() === req.user._id.toString())) {
            return res.status(400).json({
                msg: "User is not a member of the group"
            })
        }
        const remainingMembers = chat.members.filter(id => id.toString() !== req.user._id.toString());
        if (remainingMembers.length < 3) {
            await Chat.findByIdAndDelete(chat._id);
            emitEvent(req,ALERT,chat.members,{message:`${req.user.name} has left the group & Group had less than 3 members after removal. Group has been deleted.`,chatId});
            emitEvent(req,REFETCH_CHATS,chat.members);
            return res.status(200).json({
                msg: "Group had less than 3 members after removal. Group has been deleted.",
                deletedGroupId: chat._id
            });
        }
        if(chat.creator.toString() == req.user._id.toString()){
            const randomElement = Math.floor(Math.random()* remainingMembers.length);
            const newCreator = remainingMembers[randomElement];
            chat.creator = newCreator;
        }
        chat.members = remainingMembers;
        await chat.save();
        emitEvent(req,ALERT,chat.members,{message:`${req.user.name} has left the group`,chatId});
        return res.status(200).json({
            msg : "User has successfully left the group",
            groupDetails : chat
        })        
    }
    catch(err){
        return res.status(500).json({
            err : err,
            msg : "Internal server error"
        })
    }
}

async function sendAttachments(req,res){
    try{
        const chatId = req.body?.chatId;
        if(!chatId){
            return res.status(400).json({
                msg : "Please provide chatId"
            })
        }
        const chat = await Chat.findById(chatId);
        if(!chat){
            return res.status(400).json({
                msg : "Chat not found"
            })
        }
        const user = await User.findById(req.user._id);
        if(!user){
            return res.status(400).json({
                msg : "User not found"
            })
        }
        const files = req.files || [];
        if(files.length < 1){
            return res.status(400).json({
                msg : "No files were uploaded"
            })
        }
        const attachments = await uploadFilesToCloudinary(files);
        const messageForRealTime = {content:"",attachments,sender:{_id:user._id,name:user.name},chat:chatId};
        const messageForDB = {content:"",attachments,sender:user._id, chat:chatId};
        const message = await Message.create(messageForDB);
        emitEvent(req,NEW_MESSAGE,chat.members,{message : messageForRealTime, chatId});
        emitEvent(req,NEW_MESSAGE_ALERT,chat.members,{chatId});
        return res.status(200).json({
            msg : "Attachements send successfully",
            message : message
        })
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal server error",
            err : err
        })
    }
}

async function getChatDetails(req,res){
    try{
        const chatId = req.params?.id;
        if(!chatId){
            return res.status(400).json({
                msg : "Please provide chat Id"
            })
        }
        if(req.query.populate === 'true'){
            console.log('ji')
            const chat = await Chat.findById(chatId).populate("members","name avatar").lean();
            if(!chat){
                return res.status(400).json({
                    msg : "Chat not found"
                })
            }
            chat.members = chat.members.map(({_id,name,avatar})=>({_id,name,avatar:avatar.url}));
            return res.status(200).json({
                msg : "Received Chat details successfully",
                chatDetails : chat
            })
        }
        else{
            const chat = await Chat.findById(chatId);
            if(!chat){
                return res.status(400).json({
                    msg : "Chat not found"
                })
            }
            return res.status(200).json({
                msg : "Received Chat details successfully",
                chatDetails : chat
            })
        }
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal server error",
            err : err
        })
    }
}

async function renameGroup(req,res){
    try{
        const chatId = req.params?.id;
        if(!chatId){
            return res.status(400).json({
                msg : "Please provide chat Id"
            })
        }
        const name = req.body?.name;
        if(!name){
            return res.status(400).json({
                msg : "Please provide updated name of group"
            })
        }
        const chat = await Chat.findById(chatId);
        if(!chat){
            return res.status(400).json({
                msg : "Chat not found"
            })
        }
        if(!chat.groupChat){
            return res.status(400).json({
                msg : "ChatName can not be updated because it is not a group chat"
            })
        }
        if(chat.creator.toString() !== req.user._id.toString()){
            return res.status(403).json({
                msg : "You are not allowed to rename the group"
            })
        }
        chat.groupName = name;
        await chat.save();
        emitEvent(req,REFETCH_CHATS,chat.members);
        return res.status(200).json({
            msg : "Group name renamed successfully",
            groupDetails : chat
        })
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal server error",
            err : err
        })
    }
}

async function deleteChat(req,res){
    try{
        const chatId = req.params?.id;
        if(!chatId){
            return res.status(400).json({
                msg : "Please provide chat Id"
            })
        }
        const chat = await Chat.findById(chatId);
        if(!chat){
            return res.status(400).json({
                msg : "Chat not found"
            })
        }  
        const members = chat.members;
        if(chat.groupChat && chat.creator.toString() !== req.user._id.toString()){
            return res.status(400).json({
                msg : "You are not allowed to delete the group"
            })
        }   
        const messageWithAttachment = await Message.find({
            chat: chatId, 
            attachments : {$exists:true,$ne:[]}
        });
        const public_ids = [];
        messageWithAttachment.forEach(({attachments})=>
            attachments.forEach(({public_id})=>
                public_ids.push(public_id)
        ))
        await Promise.all([
            deleteFilesFromCloudinary(public_ids),
            chat.deleteOne(),
            Message.deleteMany({chat:chatId})
        ])
        emitEvent(req,REFETCH_CHATS,members);
        return res.status(200).json({
            msg : "Chat is deleted Successfully",
            chatDetails : chat
        })
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal server error",
            err : err
        })      
    }
}

async function getMessages(req,res){
    try{
        const chatId = req.params?.id;
        if(!chatId){
            return res.status(400).json({
                msg : "Please provide chat Id"
            })
        }
        const chat = await Chat.findById(chatId);
        if(!chat){
            return res.status(400).json({
                msg : "Chat not found"
            })
        }
        if(!chat.members.includes(req.user._id.toString())){
            return res.status(400).json({
                msg : "You are not allowed to access the chat"
            })
        }
        const {page =1} = req.query;
        const limit = parseInt(process.env.LIMIT) || 15;
        const skip = (page - 1) * limit;

        const [messages,totalMessagesCount] = await Promise.all(
            [Message.find({chat : chatId})
            .sort({createdAt : -1})
            .skip(skip)
            .limit(limit)
            .populate("sender","name")
            .lean()
            ,
            Message.countDocuments({chat:chatId})
        ])
        const totalPages = Math.ceil(totalMessagesCount/ limit);
        return res.status(200).json({
            msg : "Messages received successfully",
            messages : messages.reverse(),
            totalPages : totalPages
        })
    }
    catch(err){
        return res.status(500).json({
            msg : "Internal server error",
            err : err
        })      
    }
}

export { addMembers, deleteChat, getChatDetails, getChats, getGroups, getMessages, leaveGroup, newGroupChat, removeMember, renameGroup, sendAttachments };
