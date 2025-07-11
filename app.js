import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import {Server} from 'socket.io';
import http from 'http';
import {v4 as uuid} from 'uuid';
import cors from 'cors';
import {v2 as cloudinary} from 'cloudinary';
import { corsOptions } from './constants/config.js';



const app = express();
const server = http.createServer(app);
const io = new Server(server,{
    cors:corsOptions
});
app.set("io",io);
const port = process.env.PORT || 4000;
import cookieParser from 'cookie-parser';



import connectToDB from "./utils/conn.js";
connectToDB(process.env.DB_CONNECT)
cloudinary.config({
    cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
    api_key : process.env.CLOUDINARY_API_KEY,
    api_secret : process.env.CLOUDINARY_API_SECRET,
})


app.use(express.json());
app.use(express.urlencoded({extended : true}));
app.use(cookieParser());
app.use(cors(corsOptions))


import userRoutes from './routes/user.route.js';
import chatRoutes from './routes/chat.route.js';
import adminRoutes from './routes/admin.route.js';
import { NEW_MESSAGE, NEW_MESSAGE_ALERT, START_TYPING, STOP_TYPING } from './constants/events.js';
import { getSockets } from './utils/features.js';
import Message from './models/message.model.js';
import { socketAuthenticator } from './middlewares/socketAuthenticator.js';


const userSocketIDs = new Map();


app.use('/api/v1/user', userRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/admin', adminRoutes);

io.use((socket,next)=>{
    cookieParser()(socket.request, socket.request.res,async(err)=>{
        await socketAuthenticator(err,socket,next);
    });
})

io.on("connection",(socket)=>{
    const user = socket.user;
    userSocketIDs.set(user._id.toString(), socket.id);    
    console.log(userSocketIDs);
    socket.on(NEW_MESSAGE,async({chatId,members,message})=>{
        const messageForRealTime ={
            content : message,
            _id : uuid(),
            sender : {
                _id : user._id,
                name : user.name
            },
            chat : chatId,
            createdAt : new Date().toISOString()
        }
        const messageForDB = {
            content : message,
            sender : user._id,
            chat : chatId
        }
        const membersSockets = getSockets(members);
        console.log(membersSockets);
        io.to(membersSockets).emit(NEW_MESSAGE,{
            chatId,
            message : messageForRealTime
        })
        io.to(membersSockets).emit(NEW_MESSAGE_ALERT,{
            chatId        
        })

        try{
            await Message.create(messageForDB)
        }
        catch(err){
            console.log(err);
        }
        
    })
    socket.on(START_TYPING,({members,chatId})=>{
        const membersSockets = getSockets(members);
        socket.to(membersSockets).emit(START_TYPING,{chatId});  
    })
    socket.on(STOP_TYPING,({members,chatId})=>{
        const membersSockets = getSockets(members);
        socket.to(membersSockets).emit(STOP_TYPING,{chatId});
    })
    socket.on("disconnect",()=>{
        userSocketIDs.delete(user._id.toString());
        console.log("Socket disconnected");
    })
})

server.listen(port,()=>{
    console.log(`Server is listening on the port ${port}`);
})

export {userSocketIDs};