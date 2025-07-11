import User from "../models/user.model.js";
import {faker} from '@faker-js/faker'

export const createUser = async(numUsers)=>{
    try{
        const userPromise = [];
        for(let i=0;i<numUsers;i++){
            const tempUsers = User.create({
                name : faker.person.fullName(),
                username : faker.internet.username(),
                bio : faker.lorem.sentence(),
                password : "password",
                avatar :{
                    public_id : faker.system.fileName(),
                    url : faker.image.avatar()
                }
            })
            userPromise.push(tempUsers);
        }
        await Promise.all(userPromise);
        console.log(numUsers," Users created!");
        process.exit(1);
    }
    catch(err){
        console.log(err);
        process.exit(1);
    }
}

