import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name : {
        type : String,
        required : true
    },
    username : {
        type : String,
        required : true,
        unique : true
    },
    bio : {
        type : String,
        required : true
    },
    password : {
        type : String,
        required : true,
        select : false
    },
    avatar : {
        public_id : {
            type : String,
            required : true
        },
        url : {
            type : String,
            required : true
        }
    }
},{
    timestamps : true
})

const User = mongoose.model('User',userSchema);
export default User;