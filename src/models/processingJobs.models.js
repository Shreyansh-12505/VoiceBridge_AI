import mongoose from "mongoose";

const jobsSchema=mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"users",
        required:true
    },
    jobType:{
        type:String,
        enum:['STT_ONLY', 'TTS_ONLY', 'FULL_CYCLE'],
required:true
    },
    status:{
        type:String,
        enum:['pending','processing','failed','completed'],
        default:"pending"
    },
    inputMediaId:{
         type:mongoose.Schema.Types.ObjectId,
         ref:'mediaAssets'
    },
    outputMediaId:{
         type:mongoose.Schema.Types.ObjectId,
        ref:'mediaAssets'
    },
      transcriptText: {
      type: String
    },

},

{timestamps:true}
)

const jobsModel=mongoose.model("Job",jobsSchema)
export default jobsModel