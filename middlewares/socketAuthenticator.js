import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const socketAuthenticator = async (err, socket, next) => {
    try {
        if (err) {
            return next(new Error("Please login to access the route"));
        }
        const authToken = socket.request.cookies?.token;
        if (!authToken) {
            return next(new Error("Please login to access the route"));
        }

        const decodedData = jwt.verify(authToken, process.env.JWT_SECRET);
        const user = await User.findById(decodedData._id);

        if (!user) {
            return next(new Error("Please login to access the route"));
        }

        socket.user = user;
        next();
    } catch (err) {
        console.log(err);
        return next(new Error("Please login to access the route"));
    }
};
