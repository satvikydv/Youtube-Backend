import {v2 as cloudinary} from "cloudinary";
import fs, { unlink } from "fs";    //filesystem

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        //upload on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        })
        //file is now uploaded on cloudinary
        // console.log("File uploaded successfully on cloudinary ", response.url);
        fs.unlinkSync(localFilePath);    //remove the locally saved temporary file
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath);    //remove the locally saved temporary file as the upload operation failed
        return null;
    }
}

export {uploadOnCloudinary}