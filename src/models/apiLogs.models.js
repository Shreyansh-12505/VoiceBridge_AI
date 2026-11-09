import mongoose from "mongoose"

const apiLogsSchema=mongoose.Schema({
    jobId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'Job',
        required:true
    },
    serviceName:{
        type:String,
        enum:['GNANI_STT', 'GNANI_TTS'],
        required: true
    },
    endPoint:{
        type:String,
        required:true
    },
    statusCode:{
    type:Number,
    required:true
},
   
},

{timestamps:true}
)

const logsModel=mongoose.model("apiLogs",apiLogsSchema)
export default logsModel