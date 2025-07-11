import BlackListToken from '../models/blackListToken.model.js'
import User from "../models/user.model.js";
import jwt from 'jsonwebtoken';

export async function authUser(req,res,next){
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if(!token){
        return res.status(401).json({
            msg : "Unauthorized"
        })
    }
    const isBlacklisted = await BlackListToken.findOne({token});
    if(isBlacklisted){
        return res.status(401).json({
            msg : "Unauthorized"
        })
    }
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded._id);
        req.user = user;
        return next();
    }
    catch(err){
        return res.status(401).json({
            msg : "Unauthorized"
        })
    }
}


export async function authAdmin(req,res,next){
    const token = req.cookies.admintoken;
    if(!token){
        return res.status(401).json({
            msg : "Unauthorized"
        })
    }
    try{
        const secretKey = jwt.verify(token, process.env.JWT_SECRET);
        const isMatch = secretKey === process.env.ADMIN_SECRET_KEY;
        if(!isMatch){
            return res.status(401).json({
                msg : "Unauthorized"
            })
        }
        return next();
    }
    catch(err){
        return res.status(401).json({
            msg : "Unauthorized"
        })
    }
}
