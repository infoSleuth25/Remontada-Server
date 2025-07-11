import { userSocketIDs } from "../app.js";
import {v4 as uuid} from 'uuid';
import {v2 as cloudinary} from 'cloudinary';


export const emitEvent = (req,event,users,data) =>{
    const io = req.app.get("io");
    const usersSocket = getSockets(users);
    io.to(usersSocket).emit(event,data);
    console.log("Emiting event", event);
}

export const deleteFilesFromCloudinary = async(public_ids) =>{
    
}

export const getSockets = (users=[]) =>{
    const sockets = users.map(user=>userSocketIDs.get(user.toString()));
    return sockets;
} 

export const uploadFilesToCloudinary = async(files =[]) =>{
    const uploadPromises = files.map((file)=>{
        return new Promise((resolve,reject)=>{
            cloudinary.uploader.upload(getBase64(file),{
                resource_type : "auto",
                public_id : uuid()
            },(error,result)=>{
                if(error) return reject(error);
                resolve(result);
            })
        })
    })
    try{
        const results = await Promise.all(uploadPromises);
        const  formattedResult = results.map((result)=>({
            public_id : result.public_id,
            url : result.secure_url
        }))
        return formattedResult;
    }
    catch(err){
        throw new Error("Error while uploading files to cloudinary",err);
    }
}

const getBase64 = (file)=>{
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
}