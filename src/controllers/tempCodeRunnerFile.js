const getWatchHistory = asyncHandler(async(req, res)=> {
    const user = User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        }
    ])
}