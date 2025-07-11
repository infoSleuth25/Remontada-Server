import mongoose from "mongoose";

const connectToDB = (uri) =>{
    mongoose.connect(uri)
    .then(()=>{
        console.log('Connection Successful');
    })
    .catch((err)=>{
        console.log("No Connection");
        console.log(err);
    })
}

export default connectToDB;