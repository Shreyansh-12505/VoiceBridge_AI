import mongoose from "mongoose"

const apiLogsSchema = mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    serviceName: {
        type: String,
        enum: ['GNANI_STT', 'GNANI_TTS'],
        required: true
    },
    endpoint: {
        type: String,
        required: true
    },
    statusCode: {
        type: Number,
        required: true
    },
    latencyMs: {
        type: Number
    },
    creditsBilled: {
        type: Number,
        default: 0
    }
},

{ timestamps: true }
)

const logsModel = mongoose.model("apiLogs", apiLogsSchema)
export default logsModel
