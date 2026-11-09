import userModel from "../models/user.models.js";

async function countCredits(req,res,next) {
    try {
        const user=await userModel.findById(req.user._id);
        if(!user){
            return res.status(401).json({error:"user not found"})
        }
        if(!user.isActive){
            return res.status(401).json({error:"user account is disabled"})
        }
        const cost=1;
        if(user.creditsUsed + cost > creditTotal){
            return res.status(401).json({
                message:"insufficient api credits",
                used:user.creditsUsed,
                limit:user.creditTotal
            })
        }
 req.userDoc=user;
 next();


    } catch (error) {
        console.log(error);
        res.status(500).json({error:"failed to verify credit"})
    }
}
export default countCredits
 