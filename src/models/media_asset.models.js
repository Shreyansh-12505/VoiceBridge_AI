import mongoose from "mongoose";

const mediaSchema=new mongoose.Schema({
userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"users",
    required:true
},
jobId:{
    type:mongoose.Schema.Types.ObjectId 
,
ref:"Job"
},
fileUrl:{
    type:String,
    required:true
},

assetType:{
    type:String,
    enum:['upload_stt', 'generated_tts'],
required:true
}
,
fileFormat:{
    type:String,
    enum:['wav', 'mp3', 'm4a', 'flac'],
    required:true
},



},

{timestamps:true}
)

const mediaModel=mongoose.model("mediaAssets",mediaSchema)
export default mediaModel

