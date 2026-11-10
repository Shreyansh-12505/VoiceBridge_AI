import mongoose from "mongoose";

const userSchema=new mongoose.Schema({
     username:{
        type:String,
        required:true,
        unique:true,
        trim:true
     },
     email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true
     },
     passwordHash:{
        type:String,
        required:true,
        select:false
     },
     creditTotal:{
        type:Number,
        default:5000,
        min:0
     },
     creditsUsed:{
      type:Number,
      default:0
     }
   
},
{timestamps:true}
)

const userModel=mongoose.model("users",userSchema)
export default userModel

