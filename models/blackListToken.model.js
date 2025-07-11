import mongoose from "mongoose";

const blackListTokenSchema = new mongoose.Schema({
    token : {
        type : String,
        required : true,
        unique : true
    },
    createAt : {
        type : Date,
        dafault : Date.now,
        expires : 86400
    }
})

const BlackListToken = mongoose.model('BlackListToken',blackListTokenSchema);
export default BlackListToken;